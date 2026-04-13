import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUiStore } from '@/store/uiStore'
import Modal from '@/components/ui/Modal'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuth } from '@/hooks/useAuth'
import { formatRelativeTime } from '@/utils/helpers'
import { Bell, CheckCheck } from 'lucide-react'
import useRealtime from '@/hooks/useRealtime'
import { useEffect } from 'react'

function NotificationsModal({ isOpen, onClose }) {
  const { notifications, markAsRead, markAllRead, loadNotifications, subscribeToNotifications, unsubscribeFromNotifications } = useNotificationStore()
  const { user } = useAuth()

  useEffect(() => {
    if (user?.id && isOpen) {
      loadNotifications(user.id)
    }
  }, [user?.id, isOpen])

  useEffect(() => {
    if (user?.id) {
      subscribeToNotifications(user.id)
    }
    return () => unsubscribeFromNotifications()
  }, [user?.id])

  const typeIcons = {
    appointment: '📅',
    queue: '🔔',
    medical: '📋',
    message: '💬',
    system: '⚙️',
    APPOINTMENT_BOOKED: '📅',
    TOKEN_GENERATED: '🎫',
    WAIT_TIME_UPDATED: '⏰',
    QUEUE_UPDATED: '📋',
    REMINDER: '🔔',
    CONSULTATION_START: '🩺',
    PATIENT_CALLED: '📢',
    NO_SHOW_WARNING: '⚠️',
    CAPACITY_REACHED: '⚠️',
    RESCHEDULE_AVAILABLE: '📅',
    CONSULTATION_NEAR: '⏰',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Notifications" size="md">
      <div className="divide-y divide-surface-100">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-sm text-surface-500">No notifications yet</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 flex justify-end">
              <button
                onClick={() => markAllRead(user?.id)}
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            </div>
            {notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => !notif.is_read && markAsRead(notif.id)}
                className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-surface-50 transition-colors ${!notif.is_read ? 'bg-primary-50/50' : ''}`}
              >
                <span className="text-xl flex-shrink-0">{typeIcons[notif.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800">{notif.title}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{notif.message}</p>
                  <p className="text-xs text-surface-400 mt-1">{formatRelativeTime(notif.created_at)}</p>
                </div>
                {!notif.is_read && (
                  <div className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 flex-shrink-0" />
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  )
}

export function DashboardLayout({ children, title, subtitle }) {
  const { activeModal, closeModal } = useUiStore()

  // Initialize realtime subscriptions
  useRealtime()

  return (
    <div className="flex min-h-screen bg-surface-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} subtitle={subtitle} />

        <main className="flex-1 p-4 sm:p-6 animate-fade-in">
          {children}
        </main>
      </div>

      <NotificationsModal
        isOpen={activeModal === 'notifications'}
        onClose={closeModal}
      />
    </div>
  )
}

export default DashboardLayout
