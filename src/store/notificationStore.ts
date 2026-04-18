import { create } from 'zustand'
import notificationService from '@/services/notificationService'
import { isUuid } from '@/utils/uuid'
import { NotificationState, Notification } from '../types/notificationStore'

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isDropdownOpen: false,
  subscription: null,

  setDropdownOpen: (isOpen: boolean) => set({ isDropdownOpen: isOpen }),

  loadNotifications: async (userId: string) => {
    if (!userId || !isUuid(userId)) return
    set({ isLoading: true })
    try {
      const data = await notificationService.getUserNotifications(userId)
      set({
        notifications: data || [],
        unreadCount: (data || []).filter(n => !n.is_read).length,
        isLoading: false,
      })
    } catch (error) {
      console.error('Failed to load notifications:', error)
      set({ isLoading: false })
    }
  },

  loadUnreadNotifications: async (userId: string) => {
    if (!userId || !isUuid(userId)) return
    try {
      const data = await notificationService.getUnreadNotifications(userId)
      set({ unreadCount: data.length })
    } catch (error) {
      console.error('Failed to load unread notifications:', error)
    }
  },

  subscribeToNotifications: (userId: string) => {
    if (!userId || !isUuid(userId)) return
    
    const state = get()
    if (state.subscription) {
      state.subscription.unsubscribe()
    }

    const subscription = notificationService.subscribeToNotifications(userId, (newNotification) => {
      set((state) => ({
        notifications: [newNotification as Notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }))
    })

    set({ subscription })
  },

  unsubscribeFromNotifications: () => {
    const state = get()
    if (state.subscription) {
      state.subscription.unsubscribe()
      set({ subscription: null })
    }
  },

  markAsRead: async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId)
      set((state) => {
        const notification = state.notifications.find(n => n.id === notificationId)
        if (!notification) return state
        
        return {
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }
      })
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  },

  deleteNotification: async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId)
      set((state) => {
        const notification = state.notifications.find(n => n.id === notificationId)
        return {
          notifications: state.notifications.filter((n) => n.id !== notificationId),
          unreadCount: notification && !notification.is_read 
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        }
      })
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  },

  markAllRead: async (userId: string) => {
    if (!userId) return
    try {
      await notificationService.markAllAsRead(userId)
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }))
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => {
      const exists = state.notifications.some(n => n.id === notification.id)
      if (exists) return state
      
      return {
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + (notification.is_read ? 0 : 1),
      }
    })
  },

  removeNotification: (notificationId: string) => {
    const state = get()
    const notification = state.notifications.find(n => n.id === notificationId)
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== notificationId),
      unreadCount: notification && !notification.is_read 
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }))
  },

  getUnreadNotifications: () => {
    return get().notifications.filter((n) => !n.is_read)
  },

  getReadNotifications: () => {
    return get().notifications.filter((n) => n.is_read)
  },

  reset: () => {
    const state = get()
    if (state.subscription) {
      state.subscription.unsubscribe()
    }
    set({ notifications: [], unreadCount: 0, isLoading: false, subscription: null })
  },
}))

export default useNotificationStore
