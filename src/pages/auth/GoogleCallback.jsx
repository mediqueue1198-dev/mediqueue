import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getRoleRedirect } from '@/utils/helpers'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import supabase from '@/lib/supabase'

export default function GoogleCallback() {
  const { isAuthenticated, profile, error, initialize, isInitialized, isLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  
  useEffect(() => {
    // Basic lock to prevent double-processing in StrictMode
    if (isProcessing) return
    
    async function handleCallback() {
      setIsProcessing(true)
      try {
        console.log('[GoogleAuth] Callback started. URL:', window.location.href)
        
        let currentSession = null
        
        // 1. Check if we have a PKCE code in the URL
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        
        if (code) {
          console.log('[GoogleAuth] PKCE code detected, exchanging...')
          const { data, error: exchangeError } = await supabase.auth.exchangeOAuthCodeForSession(code)
          if (exchangeError) throw exchangeError
          currentSession = data.session
        } else {
          // 2. Fallback to standard session lookup (for implicit flow/hash)
          console.log('[GoogleAuth] No code in URL, checking getSession...')
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          if (sessionError) throw sessionError
          currentSession = session
        }
        
        if (!currentSession?.user) {
          throw new Error('No valid session found after exchange. Check if your Redirect URI is correct.')
        }
        
        // Get pending role from sessionStorage
        const pendingRole = sessionStorage.getItem('pending_role')
        sessionStorage.removeItem('pending_role')
        
        // Load latest user profile from database
        const { data: dbProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentSession.user.id)
          .single()
        
        if (profileError) {
          console.error('[GoogleCallback] Profile load error:', profileError)
          // If profile doesn't exist, it might still be being created by the trigger
          // Wait a tiny bit and try one more time
          await new Promise(r => setTimeout(r, 1000))
        }

        const { data: finalProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentSession.user.id)
          .single()

        // If there's a pending role and it differs from the current profile role,
        // update it. (The DB trigger handle_new_user should have handled this, 
        // but this is a safety net for OAuth metadata gaps)
        if (pendingRole && currentSession.user.id) {
          // Update role in users table
          await supabase
            .from('users')
            .update({ role: pendingRole })
            .eq('id', currentSession.user.id)
          
          // Ensure role-specific table entry exists
          const roleTable = 
            pendingRole === 'doctor' ? 'doctors' : 
            pendingRole === 'mediator' ? 'mediators' : 'patients'
          
          const { data: exists } = await supabase.from(roleTable).select('id').eq('user_id', currentSession.user.id).maybeSingle()
          
          if (!exists) {
            const fullName = currentSession.user.user_metadata?.full_name || 'User'
            const defaultHospitalId = '00000000-0000-0000-0000-000000000001'
            const roleData = { 
              user_id: currentSession.user.id,
              hospital_id: defaultHospitalId
            }
            
            if (pendingRole === 'doctor') {
              roleData.name = fullName
              roleData.specialization = 'General Practice' // Default to satisfy NOT NULL if exists
            }
            if (pendingRole === 'patient') {
              roleData.patient_name = fullName
            }
            if (pendingRole === 'mediator') {
              roleData.is_approved = false
            }
            
            const { error: insertError } = await supabase.from(roleTable).insert(roleData)
            if (insertError) console.warn('Role table auto-insert failed (expected if record created by trigger):', insertError.message)
          }
        }
        
        // CRITICAL: Synchronize the local auth store before navigating
        const updatedProfile = await refreshProfile()
        
        // Redirect to appropriate dashboard or onboarding
        const role = updatedProfile?.role || pendingRole || 'patient'
        
        console.log('[GoogleAuth] Logic complete. Redirecting role:', role)

        if (role === 'doctor' && updatedProfile && !updatedProfile.isOnboarded) {
          navigate('/complete-profile')
        } else {
          navigate(getRoleRedirect(role))
        }
        
      } catch (err) {
        console.error('CRITICAL Google callback error:', err)
        // Provide more info in URL for debugging if needed
        navigate(`/auth?mode=login&error=google_auth_failed&details=${encodeURIComponent(err.message)}`)
      } finally {
        setLoading(false)
      }
    }
    
    handleCallback()
  }, [navigate, refreshProfile])
  
  if (loading) return <PageLoader label="Authenticating with Google..." />
  return null
}