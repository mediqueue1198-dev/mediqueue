import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

// Auth
const Splash = lazy(() => import('@/pages/auth/Splash'))
const RoleSelect = lazy(() => import('@/pages/auth/RoleSelect'))
const AuthPage = lazy(() => import('@/pages/auth/AuthPage'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const GoogleCallback = lazy(() => import('@/pages/auth/GoogleCallback'))
const CompleteProfile = lazy(() => import('@/pages/auth/CompleteProfile.tsx'))

// Patient
const PatientDashboard = lazy(() => import('@/pages/patient/PatientDashboard'))
const PatientAppointments = lazy(() => import('@/pages/patient/PatientAppointments'))
const BookAppointment = lazy(() => import('@/pages/patient/BookAppointment'))
const QueueStatus = lazy(() => import('@/pages/patient/QueueStatus'))
const MedicalRecords = lazy(() => import('@/pages/patient/MedicalRecords'))
const PatientMessages = lazy(() => import('@/pages/patient/PatientMessages.tsx'))
const PatientProfile = lazy(() => import('@/pages/patient/PatientProfile'))
const FamilyMembers = lazy(() => import('@/pages/patient/FamilyMembers'))
const ExploreDoctors = lazy(() => import('@/pages/patient/ExploreDoctors'))

// Doctor
const DoctorDashboard = lazy(() => import('@/pages/doctor/DoctorDashboard'))
const DoctorQueue = lazy(() => import('@/pages/doctor/DoctorQueue'))
const ConsultationScreen = lazy(() => import('@/pages/doctor/ConsultationScreen'))
const DoctorAppointments = lazy(() => import('@/pages/doctor/DoctorAppointments'))
const PatientHistory = lazy(() => import('@/pages/doctor/PatientHistory'))
const DoctorMessages = lazy(() => import('@/pages/doctor/DoctorMessages.tsx'))
const DoctorProfile = lazy(() => import('@/pages/doctor/DoctorProfile'))
const DoctorEarnings = lazy(() => import('@/pages/doctor/DoctorEarnings'))

// Mediator
const MediatorDashboard = lazy(() => import('@/pages/mediator/MediatorDashboard'))
const MediatorOperations = lazy(() => import('@/pages/mediator/MediatorOperations'))
const QueueControl = lazy(() => import('@/pages/mediator/QueueControl'))
const WalkInRegistration = lazy(() => import('@/pages/mediator/WalkInRegistration'))
const DoctorManagement = lazy(() => import('@/pages/mediator/DoctorManagement'))
const ReportsAnalytics = lazy(() => import('@/pages/mediator/ReportsAnalytics'))
const MediatorProfile = lazy(() => import('@/pages/mediator/MediatorProfile'))

// Public
const QueueDisplayBoard = lazy(() => import('@/pages/public/QueueDisplayBoard'))

// Layout
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import ErrorBoundary from '@/components/common/ErrorBoundary'

// Hooks
import { useAuth } from '@/hooks/useAuth'
import { getRoleRedirect } from '@/utils/helpers'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import useRealtime from '@/hooks/useRealtime'

function RootRedirect() {
  const { isAuthenticated, role, profile, isInitialized, isLoading } = useAuth()
  
  if (!isInitialized || isLoading) return <PageLoader label="Checking session..." />
  
  if (isAuthenticated) {
    if (!role) {
      return <Navigate to="/complete-profile" replace />
    }
    
    // Doctor onboarding guard
    if (role === 'doctor' && profile && !profile.isOnboarded) {
      return <Navigate to="/complete-profile" replace />
    }

    return <Navigate to={getRoleRedirect(role)} replace />
  }
  
  return <Splash />
}

export default function App() {
  // Global Realtime Subscription
  useRealtime()

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
            },
            success: { style: { background: '#059669', color: '#fff' } },
            error: { style: { background: '#e11d48', color: '#fff' } },
          }}
        />
        <Suspense fallback={<PageLoader label="Loading page..." />}>
          <Routes>
            {/* Root */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/role-select" element={<RoleSelect />} />
            <Route path="/auth" element={<AuthPage />} />

            {/* Auth backwards compatibility */}
            <Route path="/login" element={<Navigate to="/auth?mode=login" replace />} />
            <Route path="/register" element={<Navigate to="/auth?mode=register" replace />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/callback/google" element={<GoogleCallback />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />

            {/* Public display board */}
            <Route path="/display" element={<QueueDisplayBoard />} />

            {/* ─── PATIENT ROUTES ─────────────────────────────────────── */}
            <Route path="/patient" element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientDashboard />
              </ProtectedRoute>
            } />
            <Route path="/patient/appointments" element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientAppointments />
              </ProtectedRoute>
            } />
            <Route path="/patient/book" element={
              <ProtectedRoute allowedRoles={['patient']}>
                <BookAppointment />
              </ProtectedRoute>
            } />
            <Route path="/patient/queue" element={
              <ProtectedRoute allowedRoles={['patient']}>
                <QueueStatus />
              </ProtectedRoute>
            } />
            <Route path="/patient/records" element={
              <ProtectedRoute allowedRoles={['patient']}>
                <MedicalRecords />
              </ProtectedRoute>
            } />
            <Route path="/patient/messages" element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientMessages />
              </ProtectedRoute>
            } />
            <Route path="/patient/profile" element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientProfile />
              </ProtectedRoute>
            } />
            <Route path="/patient/family" element={
              <ProtectedRoute allowedRoles={['patient']}>
                <FamilyMembers />
              </ProtectedRoute>
            } />
            <Route path="/patient/doctors" element={
              <ProtectedRoute allowedRoles={['patient']}>
                <ExploreDoctors />
              </ProtectedRoute>
            } />

            {/* ─── DOCTOR ROUTES ──────────────────────────────────────── */}
            <Route path="/doctor" element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorDashboard />
              </ProtectedRoute>
            } />
            <Route path="/doctor/queue" element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorQueue />
              </ProtectedRoute>
            } />
            <Route path="/doctor/consultation" element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <ConsultationScreen />
              </ProtectedRoute>
            } />
            <Route path="/doctor/appointments" element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorAppointments />
              </ProtectedRoute>
            } />
            <Route path="/doctor/history" element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <PatientHistory />
              </ProtectedRoute>
            } />
            <Route path="/doctor/messages" element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorMessages />
              </ProtectedRoute>
            } />
            <Route path="/doctor/profile" element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorProfile />
              </ProtectedRoute>
            } />
            <Route path="/doctor/earnings" element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorEarnings />
              </ProtectedRoute>
            } />

            {/* ─── MEDIATOR ROUTES ────────────────────────────────────── */}
            <Route path="/mediator" element={
              <ProtectedRoute allowedRoles={['mediator']}>
                <MediatorDashboard />
              </ProtectedRoute>
            } />
            <Route path="/mediator/queue" element={
              <ProtectedRoute allowedRoles={['mediator']}>
                <QueueControl />
              </ProtectedRoute>
            } />
            <Route path="/mediator/walkin" element={
              <ProtectedRoute allowedRoles={['mediator']}>
                <WalkInRegistration />
              </ProtectedRoute>
            } />
            <Route path="/mediator/doctors" element={
              <ProtectedRoute allowedRoles={['mediator']}>
                <DoctorManagement />
              </ProtectedRoute>
            } />
            <Route path="/mediator/operations" element={
              <ProtectedRoute allowedRoles={['mediator']}>
                <MediatorOperations />
              </ProtectedRoute>
            } />
            <Route path="/mediator/reports" element={
              <ProtectedRoute allowedRoles={['mediator']}>
                <ReportsAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/mediator/profile" element={
              <ProtectedRoute allowedRoles={['mediator']}>
                <MediatorProfile />
              </ProtectedRoute>
            } />

            {/* 404 catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
