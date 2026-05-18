import supabase from '@/lib/supabase'

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  sender?: {
    id: string;
    full_name: string;
    role: string;
    avatar_url?: string;
  };
  receiver?: {
    id: string;
    full_name: string;
    role: string;
    avatar_url?: string;
  };
  peer?: any;
}

export const messagesService = {
  async getConversation(userId: string, otherUserId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:sender_id(id, full_name, role)')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data as Message[]
  },

  async getInbox(userId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:sender_id(id, full_name, role, avatar_url), receiver:receiver_id(id, full_name, role, avatar_url)')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    const latestMessages = new Map<string, any>()
    data?.forEach(msg => {
      const peerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id
      if (!latestMessages.has(peerId)) {
        latestMessages.set(peerId, {
          ...msg,
          peer: msg.sender_id === userId ? msg.receiver : msg.sender
        })
      }
    })
    
    return Array.from(latestMessages.values())
  },

  async send(
    senderId: string, 
    receiverId: string, 
    content: string, 
    fileData?: { url: string; name: string; type: string }
  ): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        file_url: fileData?.url,
        file_name: fileData?.name,
        file_type: fileData?.type,
        read: false
      })
      .select('*, sender:sender_id(id, full_name, role)')
      .single()
    
    if (error) throw error
    return data as Message
  },

  async markRead(userId: string, otherUserId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', userId)
      .eq('sender_id', otherUserId)
      .eq('read', false)
    
    if (error) throw error
  },

  subscribeToMessages(
    userId: string, 
    onNewMessage: (payload: any) => void, 
    onStatusUpdate: (payload: any) => void
  ) {
    const channel = supabase
      .channel(`messages-user-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      }, (payload) => {
        onNewMessage(payload.new)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${userId}`,
      }, (payload) => {
        if (payload.new.read && !payload.old.read) {
          onStatusUpdate(payload.new)
        }
      })
      .subscribe()
      
    return { unsubscribe: () => supabase.removeChannel(channel) }
  },
}

export default messagesService
