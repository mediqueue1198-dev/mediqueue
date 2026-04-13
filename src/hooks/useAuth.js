import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const { 
    user, profile, isLoading, isInitialized, error, initialize, 
    login, register, logout, updateProfile, clearError 
  } = useAuthStore()

  useEffect(() => {
    if (!isInitialized) initialize()
  }, [isInitialized, initialize])

  // Google OAuth sign-in
  const signInWithGoogle = async (role = null) => {
    try {
      // Initiate Google OAuth flow with role metadata
      const oauthOptions = {
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback/google`,
        },
      }
      
      // If role is provided, pass it in the data so the database trigger can use it
      if (role) {
        oauthOptions.options = {
          ...oauthOptions.options,
          data: JSON.stringify({ role }),
        }
      }
      
      const { data, error } = await supabase.auth.signInWithOAuth(oauthOptions)
      if (error) throw error
      // User will be redirected to Google's OAuth consent screen
      // After consent, they'll be redirected back to the callback URL
      return { success: true }
    } catch (err) {
      throw err
    }
  }

  return {
    user,
    profile,
    isLoading,
    isInitialized,
    error,
    isAuthenticated: !!user,
    role: profile?.role || user?.role || null,
    isPatient: (profile?.role || user?.role) === 'patient',
    isDoctor: (profile?.role || user?.role) === 'doctor',
    isMediator: (profile?.role || user?.role) === 'mediator',
    login,
    signInWithGoogle, // Add Google sign-in
    // Stubs for Phone features not yet implemented
    signInWithPhone: async () => { throw new Error('Phone sign-in not configured') },
    verifyPhoneOtp: async () => { throw new Error('Phone OTP not configured') },
    register,
    logout,
    updateProfile,
    clearError,
  }
}

export default useAuth
