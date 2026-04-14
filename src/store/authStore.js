import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getRoleRedirect } from '@/utils/helpers'
import { authService } from '@/services/auth.service'
import supabase from '@/lib/supabase'
import { isUuid } from '@/utils/uuid'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      initialize: async () => {
        if (get().isInitialized) return
        set({ isLoading: true })

        // Clear stale mock sessions that have non-UUID user IDs
        const persistedUser = get().user
        if (persistedUser && !isUuid(persistedUser.id)) {
          console.warn('[MediQueue] Clearing stale mock session:', persistedUser.id)
          set({ user: null, profile: null, isInitialized: true, isLoading: false })
          return
        }

        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const { data: profile, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single()
            
            if (error) {
              console.error('Profile load error:', error)
              set({ user: session.user, profile: null, isInitialized: true, isLoading: false })
              return
            }
            
            if (profile) {
              // Fetch specialized ID only for doctor/patient roles
              if (profile.role === 'doctor' || profile.role === 'patient') {
                const roleTable = profile.role === 'doctor' ? 'doctors' : 'patients'
                const { data: roleData } = await supabase
                  .from(roleTable)
                  .select('id')
                  .eq('user_id', profile.id)
                  .maybeSingle()
                
                if (roleData) {
                  profile.doctor_id = profile.role === 'doctor' ? roleData.id : undefined
                  profile.patient_id = profile.role === 'patient' ? roleData.id : undefined
                }
              }
            }
            
            set({ user: session.user, profile, isInitialized: true, isLoading: false })
          } else {
            set({ isInitialized: true, isLoading: false })
          }
        } catch (err) {
          console.error('[Auth] Initialize error:', err)
          set({ isInitialized: true, isLoading: false, error: err.message })
        }
      },

  ensureProfile: async (user, metadata = {}) => {
         // Bug 8 fix: use the top-level static import instead of dynamic import
         
         // 1. Check if profile exists
         const { data: existingProfile } = await supabase
           .from('users')
           .select('*')
           .eq('id', user.id)
           .single()
         
         if (existingProfile) return existingProfile

         // 2. Create profile
         // For Google OAuth, we may have user metadata from Google
         const role = metadata.role || 'patient'
         const fullName = metadata.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
         const email = user.email
         const phone = user.phone || metadata.phone || null
         const avatarUrl = user.user_metadata?.avatar_url || metadata.avatar_url || null

         const newProfile = {
           id: user.id,
           full_name: fullName,
           email: email,
           phone: phone,
           avatar_url: avatarUrl,
           role: role,
         }

         const { data: profile, error: pError } = await supabase
           .from('users')
           .insert(newProfile)
           .select()
           .single()
         
         if (pError) throw pError

         // 3. Create role-specific record if needed
         if (role === 'patient' || role === 'doctor') {
           const roleTable = role === 'patient' ? 'patients' : 'doctors'
           const { error: rError } = await supabase
             .from(roleTable)
             .insert({ user_id: user.id })
           
           if (rError) console.error(`Failed to create ${role} record:`, rError)
         }
         
         return profile
       },

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error

          const profile = await get().ensureProfile(data.user)

          // Fetch specialized ID only for doctor/patient roles
          if (profile.role === 'doctor' || profile.role === 'patient') {
            const roleTable = profile.role === 'doctor' ? 'doctors' : 'patients'
            const { data: roleData } = await supabase
              .from(roleTable)
              .select('id')
              .eq('user_id', profile.id)
              .maybeSingle()
            
            if (roleData) {
              profile.doctor_id = profile.role === 'doctor' ? roleData.id : undefined
              profile.patient_id = profile.role === 'patient' ? roleData.id : undefined
            }
          }

          set({ user: data.user, profile, isLoading: false })
          return { user: data.user, profile }
        } catch (err) {
          set({ isLoading: false, error: err.message })
          throw err
        }
      },


      register: async ({ full_name, email, phone, password, role }) => {
        set({ isLoading: true, error: null })
        try {
          // Bug 8 fix: use the top-level static import
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name, phone, role } },
          })
          if (error) throw error

          if (!data.user) {
            set({ isLoading: false })
            return null
          }

          set({ user: data.user, isLoading: false })
          return data.user
        } catch (err) {
          set({ isLoading: false, error: err.message })
          throw err
        }
      },

      logout: async () => {
        try {
          // Bug 8 fix: use the top-level static import
          await supabase.auth.signOut()
        } finally {
          set({ user: null, profile: null, error: null })
        }
      },

      updateProfile: async (updates) => {
        set({ isLoading: true, error: null })
        try {
          // Bug 8 fix: use the top-level static import
          const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', get().user.id)
          if (error) throw error
          set(state => ({
            profile: state.profile ? { ...state.profile, ...updates } : updates,
            isLoading: false,
          }))
        } catch (err) {
          set({ isLoading: false, error: err.message })
          throw err
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'mq-auth',
      partialize: (state) => ({ user: state.user, profile: state.profile }),
    }
  )
)
