import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import supabase from '@/lib/supabase'
import { isUuid } from '@/utils/uuid'
import { AuthState, UserProfile, UserRole } from '../types/auth'

export const useAuthStore = create<AuthState>()(
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
            
            const fullProfile = profile as UserProfile;
            if (fullProfile) {
              switch (fullProfile.role) {
                case 'doctor':
                case 'patient':
                  const roleTable = fullProfile.role === 'doctor' ? 'doctors' : 'patients'
                  const { data: roleData } = await supabase
                    .from(roleTable)
                    .select('*')
                    .eq('user_id', fullProfile.id)
                    .maybeSingle()
                  
                  if (roleData) {
                    if (fullProfile.role === 'doctor') {
                      fullProfile.doctor_id = roleData.id
                      fullProfile.isOnboarded = !!(roleData.specialization && roleData.department)
                    }
                    if (fullProfile.role === 'patient') fullProfile.patient_id = roleData.id
                  } else if (fullProfile.role === 'doctor') {
                    fullProfile.isOnboarded = false
                  }
                  break
                case 'mediator':
                  const { data: mData } = await supabase
                    .from('mediators')
                    .select('*, creator:users!created_by(full_name)')
                    .eq('user_id', fullProfile.id)
                    .maybeSingle()
                  
                  if (mData) {
                    fullProfile.mediator_id = mData.id
                    fullProfile.isApproved = mData.is_approved
                    fullProfile.hospital_id = mData.hospital_id
                  }
                  break
              }
            }
            
            set({ user: session.user, profile: fullProfile, isInitialized: true, isLoading: false })
          } else {
            set({ isInitialized: true, isLoading: false })
          }
        } catch (err: any) {
          console.error('[Auth] Initialize error:', err)
          set({ isInitialized: true, isLoading: false, error: err.message })
        }
      },

      ensureProfile: async (user, metadata = {}) => {
        const { data: existingProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (existingProfile) return existingProfile as UserProfile

        const role = (metadata.role || user.user_metadata?.role || 'patient') as UserRole
        const fullName = metadata.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
        const email = user.email
        const phone = user.phone || metadata.phone || user.user_metadata?.phone || null
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

        if (role === 'patient' || role === 'doctor') {
          const roleTable = role === 'patient' ? 'patients' : 'doctors'
          const roleData: any = { user_id: user.id, name: fullName }
          if (role === 'patient') roleData.patient_name = fullName
          
          const { error: rError } = await supabase
            .from(roleTable)
            .insert(roleData)
          
          if (rError) console.error(`Failed to create ${role} record:`, rError)
        }
        
        return profile as UserProfile
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
          if (!data.user) throw new Error('Login failed: no user returned')

          const profile = await get().ensureProfile(data.user)

          if (profile.role === 'doctor' || profile.role === 'patient') {
            const roleTable = profile.role === 'doctor' ? 'doctors' : 'patients'
            const { data: roleData } = await supabase
              .from(roleTable)
              .select('id')
              .eq('user_id', profile.id)
              .maybeSingle()
            
            if (roleData) {
              if (profile.role === 'doctor') profile.doctor_id = roleData.id
              if (profile.role === 'patient') profile.patient_id = roleData.id
            }
          }

          set({ user: data.user, profile, isLoading: false })
          return { user: data.user, profile }
        } catch (err: any) {
          set({ isLoading: false, error: err.message })
          throw err
        }
      },

      register: async ({ full_name, email, phone, password, role }) => {
        set({ isLoading: true, error: null })
        try {
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
        } catch (err: any) {
          set({ isLoading: false, error: err.message })
          throw err
        }
      },

      logout: async () => {
        try {
          await supabase.auth.signOut()
        } finally {
          set({ user: null, profile: null, error: null })
        }
      },

      updateProfile: async (updates) => {
        set({ isLoading: true, error: null })
        try {
          const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', get().user?.id)
          if (error) throw error
          set(state => ({
            profile: state.profile ? { ...state.profile, ...updates } : (updates as UserProfile),
            isLoading: false,
          }))
        } catch (err: any) {
          set({ isLoading: false, error: err.message })
          throw err
        }
      },

      refreshProfile: async () => {
        const userId = get().user?.id
        if (!userId) return
        
        set({ isLoading: true })
        try {
          const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single()
          
          if (error) throw error
          
          const fullProfile = profile as UserProfile
          if (fullProfile.role === 'doctor' || fullProfile.role === 'patient' || fullProfile.role === 'mediator') {
            const roleTable = 
              fullProfile.role === 'doctor' ? 'doctors' : 
              fullProfile.role === 'patient' ? 'patients' : 'mediators'
            
            const { data: roleData } = await supabase
              .from(roleTable)
              .select('*')
              .eq('user_id', userId)
              .maybeSingle()
            
            if (roleData) {
              if (fullProfile.role === 'doctor') {
                fullProfile.doctor_id = roleData.id
                fullProfile.isOnboarded = !!(roleData.specialization && roleData.department)
              }
              if (fullProfile.role === 'patient') fullProfile.patient_id = roleData.id
              if (fullProfile.role === 'mediator') {
                fullProfile.mediator_id = roleData.id
                fullProfile.hospital_id = roleData.hospital_id
                
                // Fetch approved doctor assignments
                const { data: assignments } = await supabase
                  .from('mediator_assignments')
                  .select('doctor_id')
                  .eq('mediator_id', roleData.id)
                  .eq('status', 'approved')
                
                fullProfile.approvedDoctorIds = assignments?.map(a => a.doctor_id) || []
                fullProfile.isApproved = fullProfile.approvedDoctorIds.length > 0
              }
            }
          }
          
          set({ profile: fullProfile, isLoading: false })
          return fullProfile
        } catch (err: any) {
          console.error('[Auth] Refresh profile error:', err)
          set({ isLoading: false, error: err.message })
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
