import { Bell, Menu, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotificationStore } from '@/store/notificationStore'
import { useUiStore } from '@/store/uiStore'
import Avatar from '@/components/ui/Avatar'
import { cn } from '@/utils/helpers'
import { useState } from 'react'
import NotificationPanel from '@/components/notifications/NotificationPanel'

export function Header({ title, subtitle }) {
  const { profile } = useAuth()
  const { unreadCount } = useNotificationStore()
  const { toggleSidebar, openModal } = useUiStore()
  const [showProfile, setShowProfile] = useState(false)

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-surface-100 px-4 sm:px-6 py-3.5">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-xl hover:bg-surface-100 transition-colors text-surface-600"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page title */}
        <div className="flex-1 min-w-0">
          {title && (
            <h1 className="text-lg font-bold text-surface-800 font-display leading-tight truncate">
              {title}
            </h1>
          )}
          {subtitle && <p className="text-xs text-surface-500 mt-0.5 truncate">{subtitle}</p>}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <NotificationPanel />

          {/* Avatar */}
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-surface-100 transition-colors"
          >
            <Avatar name={profile?.full_name} size="sm" />
            <span className="hidden sm:block text-sm font-medium text-surface-700 max-w-[120px] truncate">
              {profile?.full_name?.split(' ')[0]}
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
