import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PageLoader } from '@/components/ui/LoadingSpinner'

export function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role, isInitialized, isLoading } = useAuth()

  if (!isInitialized || isLoading) {
    return <PageLoader label="Initializing..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect to their correct dashboard
    const redirects = { patient: '/patient', doctor: '/doctor', mediator: '/mediator' }
    return <Navigate to={redirects[role] || '/login'} replace />
  }

  return children
}

export default ProtectedRoute
