import { useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, Trash2, Calendar, Clock, TriangleAlert, Users, Activity, X } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuth } from '@/hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/helpers'

const NOTIFICATION_ICONS = {
  APPOINTMENT_BOOKED: Calendar,
  TOKEN_GENERATED: Calendar,
  WAIT_TIME_UPDATED: Clock,
  QUEUE_UPDATED: Activity,
  REMINDER: Clock,
  CONSULTATION_START: Activity,
  PATIENT_CALLED: Bell,
  NO_SHOW_WARNING: TriangleAlert,
  CAPACITY_REACHED: TriangleAlert,
  RESCHEDULE_AVAILABLE: Calendar,
  CONSULTATION_NEAR: Users,
  system: Bell,
}

const NOTIFICATION_COLORS = {
  APPOINTMENT_BOOKED: 'primary',
  TOKEN_GENERATED: 'primary',
  WAIT_TIME_UPDATED: 'warning',
  QUEUE_UPDATED: 'warning',
  REMINDER: 'warning',
  CONSULTATION_START: 'medical',
  PATIENT_CALLED: 'medical',
  NO_SHOW_WARNING: 'danger',
  CAPACITY_REACHED: 'danger',
  RESCHEDULE_AVAILABLE: 'warning',
  CONSULTATION_NEAR: 'warning',
  system: 'neutral',
}

function NotificationItem({ notification, onMarkRead, onDelete, onClick }) {
  const Icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.system
  const color = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.system

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id)
    }
    onClick(notification)
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all',
        'hover:bg-surface-50',
        !notification.is_read && 'bg-primary-50/50'
      )}
    >
      <div className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
        color === 'primary' && 'bg-primary-100 text-primary-600',
        color === 'warning' && 'bg-warning-100 text-warning-600',
        color === 'danger' && 'bg-danger-100 text-danger-600',
        color === 'medical' && 'bg-medical-100 text-medical-600',
        color === 'neutral' && 'bg-surface-100 text-surface-600'
      )}>
        <Icon className="w-4 h-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn(
            'text-sm font-semibold truncate',
            !notification.is_read ? 'text-surface-800' : 'text-surface-600'
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-surface-500 line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-surface-400 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(notification.id)
        }}
        className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-danger-500 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function NotificationPanel() {
  const { user } = useAuth()
  const {
    notifications,
    unreadCount,
    isLoading,
    isDropdownOpen,
    setDropdownOpen,
    loadNotifications,
    markAsRead,
    markAllRead,
    removeNotification,
    subscribeToNotifications,
    unsubscribeFromNotifications,
  } = useNotificationStore()

  const dropdownRef = useRef(null)

  useEffect(() => {
    if (user?.id) {
      loadNotifications(user.id)
      subscribeToNotifications(user.id)
    }

    return () => {
      unsubscribeFromNotifications()
    }
  }, [user?.id])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen, setDropdownOpen])

  const handleNotificationClick = (notification) => {
    console.log('Notification clicked:', notification)
    setDropdownOpen(false)
  }

  const unreadNotifications = notifications.filter(n => !n.is_read)
  const readNotifications = notifications.filter(n => n.is_read)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!isDropdownOpen)}
        className="relative p-2 rounded-xl hover:bg-surface-100 transition-colors text-surface-600"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full animate-pulse" />
        )}
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-surface-200 overflow-hidden z-50">
          <div className="flex items-center justify-between p-4 border-b border-surface-100">
            <div>
              <h3 className="font-bold text-surface-800">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-surface-500">{unreadCount} unread</p>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllRead(user?.id)}
                className="text-xs"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-surface-500 mt-2">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                <p className="text-sm text-surface-500">No notifications yet</p>
              </div>
            ) : (
              <>
                {unreadNotifications.length > 0 && (
                  <div className="p-2">
                    <p className="text-xs font-semibold text-surface-400 px-2 pb-1">New</p>
                    {unreadNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkRead={markAsRead}
                        onDelete={removeNotification}
                        onClick={handleNotificationClick}
                      />
                    ))}
                  </div>
                )}

                {readNotifications.length > 0 && (
                  <div className="p-2 border-t border-surface-100">
                    <p className="text-xs font-semibold text-surface-400 px-2 pb-1">Earlier</p>
                    {readNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkRead={markAsRead}
                        onDelete={removeNotification}
                        onClick={handleNotificationClick}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
