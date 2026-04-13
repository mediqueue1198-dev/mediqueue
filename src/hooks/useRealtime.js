import { useEffect, useRef } from 'react'
import { useQueueStore } from '@/store/queueStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuth } from './useAuth'

/**
 * Subscribe to Supabase realtime events for queue, notifications and messages.
 * Uses stable channel names (no Math.random) to prevent duplicate subscriptions.
 */
export function useRealtime() {
  const { handleRealtimeUpdate } = useQueueStore()
  const { addNotification } = useNotificationStore()
  const { user } = useAuth()
  const channelsRef = useRef([])
  const userIdRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    // Don't re-subscribe if user hasn't changed
    if (userIdRef.current === user.id) return
    userIdRef.current = user.id

    const setupRealtime = async () => {
      const { supabase } = await import('@/lib/supabase')

      // Clean up any existing channels first
      channelsRef.current.forEach(ch => supabase.removeChannel(ch))
      channelsRef.current = []

      // Queue changes - global channel, stable name
      const queueChannel = supabase
        .channel(`queue-global-v2`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' },
          (payload) => handleRealtimeUpdate(payload)
        )
        .subscribe()

      // Notifications for current user - stable name with user ID
      const notifChannel = supabase
        .channel(`notifs-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          addNotification(payload.new)
        })
        .subscribe()

      channelsRef.current = [queueChannel, notifChannel]
    }

    setupRealtime()

    return () => {
      userIdRef.current = null
      const cleanup = async () => {
        const { supabase } = await import('@/lib/supabase')
        channelsRef.current.forEach(ch => supabase.removeChannel(ch))
        channelsRef.current = []
      }
      cleanup()
    }
  }, [user?.id])

  return null
}

export default useRealtime
