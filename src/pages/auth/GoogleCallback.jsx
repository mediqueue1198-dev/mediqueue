import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getRoleRedirect } from '@/utils/helpers'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import supabase from '@/lib/supabase'

export default function GoogleCallback() {
  const { isAuthenticated, profile, error, initialize, isInitialized, isLoading } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function handleCallback() {
      try {
        // Initialize auth if needed
        if (!isInitialized && typeof initialize === 'function') {
          await initialize()
        }
        
        // Wait a moment for initialization
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          // Try to exchange OAuth code for session
          const { data, error } = await supabase.auth.exchangeOAuthCodeForSession()
          if (error) {
            throw new Error('Google authentication cancelled or failed')
          }
        }
        
        // Reload session after exchange
        const { data: { session: updatedSession } } = await supabase.auth.getSession()
        if (!updatedSession?.user) {
          throw new Error('No user session found after OAuth callback')
        }
        
        // Get pending role from sessionStorage
        const pendingRole = sessionStorage.getItem('pending_role')
        sessionStorage.removeItem('pending_role')
        
        // Load user profile from database
        const { data: dbProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', updatedSession.user.id)
          .single()
        
        if (profileError) {
          console.error('Profile load error:', profileError)
          throw profileError
        }
        
        // If there's a pending role and it differs from the current profile role,
        // update to the selected role (this happens for newly created Google users)
        if (pendingRole && pendingRole !== dbProfile?.role) {
          // Update profile with selected role
          await supabase
            .from('users')
            .update({ role: pendingRole })
            .eq('id', updatedSession.user.id)
          
          // Create role-specific record if needed
          if (pendingRole === 'doctor') {
            await supabase.from('doctors').insert({ user_id: updatedSession.user.id })
          } else if (pendingRole === 'patient') {
            await supabase.from('patients').insert({ user_id: updatedSession.user.id })
          }
          
          // Redirect with the new role
          navigate(getRoleRedirect(pendingRole))
        } else {
          // Determine where to redirect
          if (dbProfile?.role) {
            // User has a role, redirect to appropriate dashboard
            navigate(getRoleRedirect(dbProfile.role))
          } else {
            // User has no role (new Google user), redirect to complete profile
            navigate('/complete-profile')
          }
        }
        
      } catch (err) {
        console.error('Google callback error:', err)
        // Navigate to login with error message
        navigate('/login?error=google_auth_failed')
      } finally {
        setLoading(false)
      }
    }
    
    handleCallback()
  }, [isInitialized, initialize, navigate])
  
  if (loading) return <PageLoader label="Authenticating with Google..." />
  return null
}