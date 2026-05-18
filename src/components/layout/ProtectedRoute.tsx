import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { UserRole } from '@/types/auth'

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, role, profile, isInitialized, isLoading } = useAuth()

  if (!isInitialized || isLoading) {
    return <PageLoader label="Initializing..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Doctor onboarding guard
  if (role === 'doctor' && profile && !profile.isOnboarded) {
    return <Navigate to="/complete-profile" replace />
  }

  // Mediator approval guard (lockdown)
  // We allow access to '/mediator/profile' but block everything else if not approved
  const isProfilePage = window.location.pathname === '/mediator/profile' || window.location.pathname === '/profile'
  if (role === 'mediator' && profile && !profile.isApproved && !isProfilePage) {
    if (window.location.pathname !== '/mediator' && window.location.pathname !== '/') {
      return <Navigate to="/mediator" replace />
    }
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const redirects: Record<UserRole, string> = { 
      patient: '/patient', 
      doctor: '/doctor', 
      mediator: '/mediator' 
    }
    return <Navigate to={redirects[role] || '/login'} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
