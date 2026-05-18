import { useEffect, useRef } from 'react'
import { useQueueStore } from '@/store/queueStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuth } from './useAuth'
import { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Subscribe to Supabase realtime events for queue, notifications and messages.
 * Uses stable channel names (no Math.random) to prevent duplicate subscriptions.
 */
export function useRealtime(): null {
  const handleRealtimeUpdate = useQueueStore(state => state.handleRealtimeUpdate)
  const addNotification = useNotificationStore(state => state.addNotification)
  const { user } = useAuth()
  
  const channelsRef = useRef<RealtimeChannel[]>([])
  const userIdRef = useRef<string | null>(null)
  const isSubscribedRef = useRef<boolean>(false)

  useEffect(() => {
    if (!user?.id) {
      // Cleanup if user logs out
      if (isSubscribedRef.current) {
        import('@/lib/supabase').then(({ default: supabase }) => {
          channelsRef.current.forEach(ch => supabase.removeChannel(ch))
          channelsRef.current = []
          isSubscribedRef.current = false
          userIdRef.current = null
        })
      }
      return
    }

    if (userIdRef.current === user.id && isSubscribedRef.current) return
    userIdRef.current = user.id
    isSubscribedRef.current = true

    const setupRealtime = async () => {
      const { default: supabase } = await import('@/lib/supabase')

      channelsRef.current.forEach(ch => supabase.removeChannel(ch))
      channelsRef.current = []

      const queueChannel = supabase
        .channel(`queue-global-v2`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' },
          (payload) => handleRealtimeUpdate(payload)
        )
        .subscribe()

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
      isSubscribedRef.current = false
      import('@/lib/supabase').then(({ default: supabase }) => {
        channelsRef.current.forEach(ch => supabase.removeChannel(ch))
        channelsRef.current = []
      })
    }
  }, [user?.id, handleRealtimeUpdate, addNotification])

  return null
}

export default useRealtime
