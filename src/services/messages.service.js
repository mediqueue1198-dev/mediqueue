import supabase from '@/lib/supabase'

export const messagesService = {
  async getConversation(userId, otherUserId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:sender_id(full_name, role)')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  async getInbox(userId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:sender_id(full_name, role), receiver:receiver_id(full_name, role)')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async send(senderId, receiverId, content) {
    const message = {
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      read: false,
      created_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('messages')
      .insert(message)
      .select('*, sender:sender_id(full_name, role)')
      .single()
    if (error) throw error
    return data
  },

  async markRead(messageIds) {
    await supabase.from('messages').update({ read: true }).in('id', messageIds)
  },

  subscribeToMessages(userId, callback) {
    const channel = supabase
      .channel(`messages-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      }, callback)
      .subscribe()
    return { unsubscribe: () => supabase.removeChannel(channel) }
  },
}

export default messagesService
