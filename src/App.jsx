import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

// Auth
  const Login = lazy(() => import('@/pages/auth/Login'))
  const Register = lazy(() => import('@/pages/auth/Register'))
  const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
  const GoogleCallback = lazy(() => import('@/pages/auth/GoogleCallback'))
  const CompleteProfile = lazy(() => import('@/pages/auth/CompleteProfile'))

// Patient
const PatientDashboard = lazy(() => import('@/pages/patient/PatientDashboard'))
const PatientAppointments = lazy(() => import('@/pages/patient/PatientAppointments'))
const BookAppointment = lazy(() => import('@/pages/patient/BookAppointment'))
const QueueStatus = lazy(() => import('@/pages/patient/QueueStatus'))
const MedicalRecords = lazy(() => import('@/pages/patient/MedicalRecords'))
const PatientMessages = lazy(() => import('@/pages/patient/PatientMessages'))
const PatientProfile = lazy(() => import('@/pages/patient/PatientProfile'))
const FamilyMembers = lazy(() => import('@/pages/patient/FamilyMembers'))
const ExploreDoctors = lazy(() => import('@/pages/patient/ExploreDoctors'))

// Doctor
const DoctorDashboard = lazy(() => import('@/pages/doctor/DoctorDashboard'))
const DoctorQueue = lazy(() => import('@/pages/doctor/DoctorQueue'))
const ConsultationScreen = lazy(() => import('@/pages/doctor/ConsultationScreen'))
const DoctorAppointments = lazy(() => import('@/pages/doctor/DoctorAppointments'))
const PatientHistory = lazy(() => import('@/pages/doctor/PatientHistory'))
const DoctorMessages = lazy(() => import('@/pages/doctor/DoctorMessages'))
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

// Hooks
import { useAuth } from '@/hooks/useAuth'
import { getRoleRedirect } from '@/utils/helpers'
import { PageLoader } from '@/components/ui/LoadingSpinner'

function RootRedirect() {
  const { isAuthenticated, role, isInitialized, isLoading } = useAuth()
  
  if (!isInitialized || isLoading) return <PageLoader label="Checking session..." />
  
  if (isAuthenticated) {
    if (!role) {
      // User has no role - probably a Google OAuth user who hasn't completed profile
      return <Navigate to="/complete-profile" replace />
    }
    return <Navigate to={getRoleRedirect(role)} replace />
  }
  
  return <Navigate to="/login" replace />
}

// ─── ERROR BOUNDARY ──────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('Critical Layout Error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface-50 p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-surface-200">
            <div className="w-20 h-20 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-surface-900 mb-2">Something went wrong</h2>
            <p className="text-surface-500 mb-6">The application encountered an unexpected error. Please try reloading the page.</p>
            <div className="bg-surface-50 rounded-2xl p-4 mb-6 text-left overflow-auto max-h-40">
              <code className="text-xs text-danger-600 whitespace-pre-wrap">{this.state.error?.toString()}</code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
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

            {/* Auth */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/callback/google" element={<GoogleCallback />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
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
