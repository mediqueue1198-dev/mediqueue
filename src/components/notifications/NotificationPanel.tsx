import { useEffect, useRef } from 'react'
import { Bell, CheckCheck, Trash2, Calendar, Clock, TriangleAlert, Users, Activity } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuth } from '@/hooks/useAuth'
import { formatDistanceToNow } from 'date-fns'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/helpers'

const NOTIFICATION_ICONS: Record<string, any> = {
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

const NOTIFICATION_COLORS: Record<string, string> = {
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

interface NotificationItemProps {
  notification: any;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (notification: any) => void;
}

function NotificationItem({ notification, onMarkRead, onDelete, onClick }: NotificationItemProps) {
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
        'group flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200',
        'hover:bg-white hover:shadow-premium',
        !notification.is_read && 'bg-primary-50/40'
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105',
        color === 'primary' && 'bg-primary-100/80 text-primary-600',
        color === 'warning' && 'bg-warning-100/80 text-warning-600',
        color === 'danger' && 'bg-danger-100/80 text-danger-600',
        color === 'medical' && 'bg-medical-100/80 text-medical-600',
        color === 'neutral' && 'bg-surface-100/80 text-surface-600'
      )}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn(
            'text-sm font-bold truncate leading-snug',
            !notification.is_read ? 'text-surface-900' : 'text-surface-600'
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 shadow-sm" />
          )}
        </div>
        <p className="text-xs text-surface-500 line-clamp-2 mt-0.5 font-medium leading-relaxed">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </span>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(notification.id)
        }}
        className="p-1.5 rounded-lg hover:bg-danger-50 text-surface-200 group-hover:text-danger-400 transition-colors"
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
    deleteNotification,
    subscribeToNotifications,
    unsubscribeFromNotifications,
  } = useNotificationStore()

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user?.id) {
      loadNotifications(user.id)
      subscribeToNotifications(user.id)
    }
    return () => { unsubscribeFromNotifications() }
  }, [user?.id, loadNotifications, subscribeToNotifications, unsubscribeFromNotifications])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }
    setDropdownOpen(false)
  }

  const sortedNotifications = [...notifications].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const unreadNotifications = sortedNotifications.filter(n => !n.is_read)
  const readNotifications = sortedNotifications.filter(n => n.is_read)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!isDropdownOpen)}
        className="group relative p-2.5 rounded-2xl hover:bg-surface-50 transition-all duration-300 text-surface-500 hover:text-primary-600"
        aria-label="Notifications"
      >
        <Bell className={cn("w-5.5 h-5.5 transition-transform group-hover:rotate-12", isDropdownOpen && "text-primary-600")} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-3.5 h-3.5 bg-danger-500 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white shadow-sm ring-1 ring-danger-100 ring-offset-0">
             {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 top-full mt-3 w-80 sm:w-[420px] bg-white/95 backdrop-blur-md rounded-3xl shadow-premium border border-surface-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          <div className="flex items-center justify-between p-5 border-b border-surface-50 bg-surface-50/30">
            <div>
              <h3 className="text-base font-bold text-surface-900 font-display">Activity Feed</h3>
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mt-0.5">
                {unreadCount > 0 ? `${unreadCount} new alerts` : 'All caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllRead(user?.id || '')}
                className="text-xs font-bold text-primary-600 hover:bg-primary-50 px-3 rounded-lg"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-[480px] overflow-y-auto custom-scrollbar bg-surface-50/10">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto shadow-sm" />
                <p className="text-xs font-bold text-surface-400 mt-4 uppercase tracking-widest">Synchronizing...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-surface-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-surface-100">
                  <Bell className="w-8 h-8 text-surface-200" />
                </div>
                <p className="text-sm font-bold text-surface-800">No Notifications</p>
                <p className="text-xs text-surface-400 mt-1">We'll alert you for new appointments, <br/>queue updates, and system events.</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {unreadNotifications.length > 0 && (
                  <div className="space-y-1">
                    {unreadNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkRead={markAsRead}
                        onDelete={deleteNotification}
                        onClick={handleNotificationClick}
                      />
                    ))}
                  </div>
                )}

                {readNotifications.length > 0 && (
                  <div className="space-y-1">
                    {unreadNotifications.length > 0 && (
                      <div className="flex items-center gap-4 my-4 px-4">
                        <div className="h-px flex-1 bg-surface-100" />
                        <span className="text-[10px] font-bold text-surface-300 uppercase tracking-widest">Previous News</span>
                        <div className="h-px flex-1 bg-surface-100" />
                      </div>
                    )}
                    {readNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkRead={markAsRead}
                        onDelete={deleteNotification}
                        onClick={handleNotificationClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-3 bg-surface-50/50 border-t border-surface-50 text-center">
              <button className="text-[11px] font-bold text-primary-600 hover:text-primary-700 uppercase tracking-widest">
                  Archive All Notifications
              </button>
          </div>
        </div>
      )}
    </div>
  )
}
