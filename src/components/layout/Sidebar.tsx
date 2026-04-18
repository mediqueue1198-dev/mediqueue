import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Clock, FileText, MessageSquare,
  Activity, UserCheck, ClipboardList,
  Stethoscope, ChevronRight, X, Heart, Search, DollarSign, Settings, LogOut
} from 'lucide-react'
import { cn } from '@/utils/helpers'
import { useAuth } from '@/hooks/useAuth'
import Avatar from '@/components/ui/Avatar'
import { useUiStore } from '@/store/uiStore'
import toast from 'react-hot-toast'

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
}

const NAV_CONFIG: Record<string, NavItem[]> = {
  patient: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/patient' },
    { label: 'Book Appointment', icon: Calendar, to: '/patient/book' },
    { label: 'Explore Doctors', icon: Search, to: '/patient/doctors' },
    { label: 'My Appointments', icon: ClipboardList, to: '/patient/appointments' },
    { label: 'Queue Status', icon: Clock, to: '/patient/queue' },
    { label: 'Medical Records', icon: FileText, to: '/patient/records' },
    { label: 'Messages', icon: MessageSquare, to: '/patient/messages' },
    { label: 'Profile', icon: Settings, to: '/patient/profile' },
  ],
  doctor: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/doctor' },
    { label: 'My Queue', icon: Clock, to: '/doctor/queue' },
    { label: 'Appointments', icon: Calendar, to: '/doctor/appointments' },
    { label: 'Consultation', icon: Stethoscope, to: '/doctor/consultation' },
    { label: 'Patient History', icon: FileText, to: '/doctor/history' },
    { label: 'Messages', icon: MessageSquare, to: '/doctor/messages' },
    { label: 'Earnings', icon: DollarSign, to: '/doctor/earnings' },
    { label: 'Profile', icon: Settings, to: '/doctor/profile' },
  ],
  mediator: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/mediator' },
    { label: 'Queue Control', icon: Activity, to: '/mediator/queue' },
    { label: 'Walk-in Register', icon: UserCheck, to: '/mediator/walkin' },
    { label: 'Doctor Management', icon: Stethoscope, to: '/mediator/doctors' },
    { label: 'Operations', icon: ClipboardList, to: '/mediator/operations' },
    { label: 'Reports', icon: FileText, to: '/mediator/reports' },
    { label: 'Profile', icon: Settings, to: '/mediator/profile' },
  ],
}

const ROLE_COLORS: Record<string, string> = {
  patient: 'gradient-primary',
  doctor: 'gradient-medical',
  mediator: 'gradient-warning',
}

const ROLE_LABELS: Record<string, string> = {
  patient: 'Patient Portal',
  doctor: 'Doctor Portal',
  mediator: 'Staff Portal',
}

export function Sidebar() {
  const { profile, logout } = useAuth()
  const { sidebarOpen, closeSidebar } = useUiStore()
  const navigate = useNavigate()
  const role = profile?.role || 'patient'
  const navItems = NAV_CONFIG[role] || NAV_CONFIG.patient

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn('p-5 text-white', ROLE_COLORS[role] || ROLE_COLORS.patient)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-base font-display leading-tight">MediQueue</p>
              <p className="text-xs text-white/70">{ROLE_LABELS[role] || ROLE_LABELS.patient}</p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-surface-100">
        <div className="flex items-center gap-3">
          <Avatar name={profile?.full_name} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-surface-800 truncate">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-surface-500 truncate">{profile?.email}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto scrollbar-hide">
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === `/${role}`}
              onClick={closeSidebar}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-800',
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Display Board Link */}
      <div className="p-3 border-t border-surface-100">
        <a
          href="/display"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-600 hover:bg-surface-100 transition-colors"
        >
          <Activity className="w-5 h-5" />
          <span>Queue Display Board</span>
        </a>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-danger-600 hover:bg-danger-50 transition-colors mt-0.5"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-white border-r border-surface-100 shadow-sm flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm"
            onClick={closeSidebar}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl animate-slide-in">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}

export default Sidebar
