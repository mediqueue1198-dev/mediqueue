import { Menu, User, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useUiStore } from '@/store/uiStore'
import Avatar from '@/components/ui/Avatar'
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NotificationPanel from '@/components/notifications/NotificationPanel'

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { profile, logout, role } = useAuth()
  const { toggleSidebar } = useUiStore()
  const [showProfile, setShowProfile] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfile(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
      navigate('/auth')
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const profileLink = `/${role}/profile`

  return (
    <header className="sticky top-0 z-30 bg-white/60 backdrop-blur-md border-b border-surface-100/50 px-4 sm:px-8 py-4">
      <div className="flex items-center gap-6">
        {/* Mobile menu button */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2.5 rounded-2xl bg-surface-50 hover:bg-surface-100 transition-all active:scale-95 text-surface-600"
          aria-label="Open menu"
        >
          <Menu className="w-5.5 h-5.5" />
        </button>

        {/* Page title area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {title && (
              <h1 className="text-xl font-bold text-surface-900 font-display leading-tight truncate tracking-tight">
                {title}
              </h1>
            )}
            <div className="hidden md:block h-1 w-1 rounded-full bg-surface-300" />
            <div className="hidden md:flex items-center gap-1.5 uppercase tracking-[0.2em] text-[10px] font-black text-primary-500/80">
                Operational Realtime
            </div>
          </div>
          {subtitle && (
            <p className="text-[11px] font-medium text-surface-400 mt-1 truncate uppercase tracking-wider">
                {subtitle}
            </p>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <NotificationPanel />

          {/* Vertical Separator */}
          <div className="h-8 w-px bg-surface-100/80 mx-1" />

          {/* Avatar / Profile Toggle */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className={`flex items-center gap-2.5 p-1 rounded-2xl transition-all duration-300 active:scale-95 group ${
                showProfile ? 'bg-white shadow-premium ring-1 ring-surface-100' : 'bg-surface-50/50 hover:bg-white hover:shadow-premium'
              }`}
            >
              <div className="relative pl-0.5">
                <Avatar 
                    name={profile?.full_name} 
                    size="sm" 
                    className="ring-2 ring-white shadow-sm transition-transform group-hover:scale-105" 
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
              </div>
              <div className="hidden sm:flex flex-col items-start pr-1">
                <span className="text-xs font-bold text-surface-800 leading-none">
                  {profile?.full_name?.split(' ')[0]}
                </span>
                <span className="text-[10px] font-bold text-primary-600/70 mt-1 uppercase tracking-tighter">
                  {profile?.role || 'User'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-surface-400 transition-transform duration-300 mr-1.5 ${showProfile ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showProfile && (
              <div className="absolute right-0 mt-2 w-56 bg-white/90 backdrop-blur-xl border border-surface-100 rounded-2xl shadow-premium-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="p-3 border-b border-surface-50">
                   <p className="text-xs font-medium text-surface-400 uppercase tracking-widest px-2 mb-2">Account</p>
                   <div className="flex items-center gap-3 p-2 rounded-xl bg-surface-50/50">
                      <Avatar name={profile?.full_name} size="xs" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-surface-900 truncate">{profile?.full_name}</p>
                        <p className="text-[10px] text-surface-500 truncate">{profile?.email}</p>
                      </div>
                   </div>
                </div>

                <div className="p-2">
                  <Link
                    to={profileLink}
                    onClick={() => setShowProfile(false)}
                    className="flex items-center gap-3 w-full p-2.5 rounded-xl text-sm font-medium text-surface-700 hover:bg-primary-50 hover:text-primary-700 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-100 group-hover:bg-primary-100 flex items-center justify-center transition-colors">
                      <User className="w-4 h-4" />
                    </div>
                    View Profile
                  </Link>

                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="flex items-center gap-3 w-full p-2.5 rounded-xl text-sm font-medium text-danger-600 hover:bg-danger-50 transition-all group mt-1"
                  >
                    <div className="w-8 h-8 rounded-lg bg-danger-50 flex items-center justify-center">
                      <LogOut className="w-4 h-4" />
                    </div>
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
