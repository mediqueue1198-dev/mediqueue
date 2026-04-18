import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import supabase from '@/lib/supabase'
import { UserRole } from '@/types/auth'

export function useAuth() {
  const { 
    user, profile, isLoading, isInitialized, error, initialize, 
    login, register, logout, updateProfile, refreshProfile, clearError 
  } = useAuthStore()

  useEffect(() => {
    if (!isInitialized) initialize()
  }, [isInitialized, initialize])

  const signInWithGoogle = async (role: UserRole | null = null) => {
    try {
      const oauthOptions: any = {
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback/google`,
        },
      }
      
      if (role) {
        oauthOptions.options = {
          ...oauthOptions.options,
          data: { role },
        }
      }
      
      const { error } = await supabase.auth.signInWithOAuth(oauthOptions)
      if (error) throw error
      return { success: true }
    } catch (err) {
      throw err
    }
  }

  const role: UserRole | null = (profile?.role || user?.user_metadata?.role || null) as UserRole | null;

  return {
    user,
    profile,
    isLoading,
    isInitialized,
    error,
    isAuthenticated: !!user,
    role,
    isPatient: role === 'patient',
    isDoctor: role === 'doctor',
    isMediator: role === 'mediator',
    login,
    signInWithGoogle,
    signInWithPhone: async () => { throw new Error('Phone sign-in not configured') },
    verifyPhoneOtp: async () => { throw new Error('Phone OTP not configured') },
    register,
    logout,
    updateProfile,
    refreshProfile,
    clearError,
  }
}

export default useAuth
