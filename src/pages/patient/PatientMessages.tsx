import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare, MoreVertical, Trash2, UserMinus, Smile, Image as ImageIcon, Phone, Check, CheckCheck, Paperclip, X, Plus, Search, Video } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { messagesService, Message } from '@/services/messages.service'
import { appointmentsService } from '@/services/appointments.service'
import { formatRelativeTime } from '@/utils/helpers'
import toast from 'react-hot-toast'
import supabase from '@/lib/supabase'

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🙏', '💯']

export default function PatientMessages() {
  const { user, profile } = useAuth()
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedPeer, setSelectedPeer] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showMenu, setShowMenu] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [potentialDoctors, setPotentialDoctors] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // 1. Load active inbox
  const loadInbox = async () => {
    if (!user?.id) return
    try {
      const inbox = await messagesService.getInbox(user.id)
      setConversations(inbox)
      if (inbox.length > 0 && !selectedPeer) {
        setSelectedPeer(inbox[0].peer)
      }
    } catch (err) {
      console.error('Failed to load inbox:', err)
    }
  }

  useEffect(() => { loadInbox() }, [user?.id])

  // 2. Load potential doctors (from appointments) for new chats
  useEffect(() => {
    if (!showNewChatModal || !user?.id) return
    const loadPotential = async () => {
      try {
        const appointments = await appointmentsService.getAll({ patient_id: user.id })
        const uniqueDoctorIds = [...new Set(appointments.map(a => a.doctor_id).filter(Boolean))]
        
        if (uniqueDoctorIds.length === 0) return

        const { doctorsService } = await import('@/services/doctors.service')
        const doctorsData = await doctorsService.getAll({ ids: uniqueDoctorIds })
        
        // Filter out those already in inbox
        const existingIds = conversations.map(c => c.peer?.id)
        // Note: doctorsData return doctor objects which have a user_id. Message peer is a user.
        const formattedDoctors = doctorsData.map(d => ({
          id: d.user_id, // We chat with user IDs
          full_name: d.user?.full_name || d.name,
          avatar_url: d.user?.avatar_url,
          specialization: d.specialization
        }))

        setPotentialDoctors(formattedDoctors.filter(d => !existingIds.includes(d.id)))
      } catch (err) {
        console.error('Failed to load potential doctors:', err)
      }
    }
    loadPotential()
  }, [showNewChatModal, user?.id, conversations])

  // 3. Load conversation history
  useEffect(() => {
    if (!user?.id || !selectedPeer) return
    
    const loadConversation = async () => {
      try {
        const data = await messagesService.getConversation(user.id, selectedPeer.id)
        setMessages(data)
        await messagesService.markRead(user.id, selectedPeer.id)
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }
    loadConversation()
  }, [user?.id, selectedPeer?.id])

  // 4. Realtime
  useEffect(() => {
    if (!user?.id) return
    const sub = messagesService.subscribeToMessages(
      user.id, 
      (newMsg: Message) => {
        if (selectedPeer && newMsg.sender_id === selectedPeer.id) {
          setMessages(prev => [...prev, newMsg])
          messagesService.markRead(user.id, selectedPeer.id)
        }
        loadInbox()
      },
      (updatedMsg: Message) => {
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, read: updatedMsg.read } : m))
      }
    )
    return () => sub.unsubscribe()
  }, [user?.id, selectedPeer?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e?: React.FormEvent, fileData?: any) => {
    if (e) e.preventDefault()
    if (!newMessage.trim() && !fileData || !user?.id || !selectedPeer) return
    
    setIsSending(true)
    try {
      const msg = await messagesService.send(user.id, selectedPeer.id, newMessage.trim(), fileData)
      setMessages(prev => [...prev, { ...msg, sender: profile as any }])
      setNewMessage('')
      loadInbox()
    } catch (err) {
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `chat-attachments/${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('medical-assets')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('medical-assets')
        .getPublicUrl(filePath)

      await handleSend(undefined, {
        url: publicUrl,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'file'
      })
      toast.success('Document uploaded')
    } catch (err) {
      console.error(err)
      toast.error('Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <DashboardLayout title="Messages" subtitle="Consult with your doctors securely">
      <div className="max-w-6xl mx-auto flex gap-6 h-[calc(100vh-180px)]">
        
        {/* Sidebar */}
        <div className="w-80 flex-shrink-0 bg-white rounded-3xl shadow-premium border border-surface-100 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-surface-50 flex items-center justify-between bg-surface-50/30">
            <h3 className="font-bold text-surface-900">Conversations</h3>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="p-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all active:scale-95 shadow-lg shadow-primary-200"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-surface-500">
                <div className="w-12 h-12 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-6 h-6 text-surface-400" />
                </div>
                <p className="text-sm font-medium">No messages yet</p>
                <button onClick={() => setShowNewChatModal(true)} className="text-xs text-primary-600 mt-2 font-bold hover:underline underline-offset-4">Find a Doctor</button>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.peer?.id}
                  onClick={() => setSelectedPeer(conv.peer)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
                    selectedPeer?.id === conv.peer?.id 
                      ? 'bg-primary-50 ring-1 ring-primary-100' 
                      : 'hover:bg-surface-50'
                  }`}
                >
                  <div className="relative">
                    <Avatar name={conv.peer?.full_name} size="md" />
                    {!conv.read && conv.receiver_id === user?.id && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary-600 border-2 border-white rounded-full animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-surface-900 truncate">{conv.peer?.full_name}</p>
                      <span className="text-[10px] text-surface-400">{formatRelativeTime(conv.created_at)}</span>
                    </div>
                    <p className={`text-xs truncate ${!conv.read && conv.receiver_id === user?.id ? 'font-bold text-surface-900' : 'text-surface-500'}`}>
                      {conv.sender_id === user?.id ? 'You: ' : ''}{conv.content || (conv.file_url ? 'Attachment share' : '')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-white rounded-3xl shadow-premium border border-surface-100 flex flex-col overflow-hidden relative">
          {selectedPeer ? (
            <>
              {/* Header */}
              <div className="px-6 py-4 border-b border-surface-100 bg-white/80 backdrop-blur-md flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar name={selectedPeer.full_name} size="md" />
                  <div>
                    <p className="font-bold text-surface-900">{selectedPeer.full_name}</p>
                    <p className="text-xs text-primary-600 font-medium">Healthcare Provider</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <Button variant="ghost" size="icon" icon={Phone} />
                   <Button variant="ghost" size="icon" icon={Video} />
                   <div className="relative" ref={menuRef}>
                      <Button variant="ghost" size="icon" icon={MoreVertical} onClick={() => setShowMenu(showMenu ? null : 'main')} />
                      {showMenu === 'main' && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-premium-lg border border-surface-100 py-1.5 z-20">
                           <button className="w-full px-4 py-2 text-left text-sm text-surface-700 hover:bg-surface-50 flex items-center gap-2">
                             <X className="w-4 h-4" /> Mute Notifications
                           </button>
                           <button className="w-full px-4 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 flex items-center gap-2">
                             <Trash2 className="w-4 h-4" /> Clear History
                           </button>
                        </div>
                      )}
                   </div>
                </div>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-surface-50/20">
                {messages.length === 0 ? (
                  <EmptyState icon={MessageSquare} title="Say hello!" description="Start your secure consultation with the doctor." />
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.sender_id === user?.id
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[80%] ${isMe ? 'flex-row-reverse' : ''}`}>
                          {!isMe && <Avatar name={selectedPeer.full_name} size="xs" className="mt-1" />}
                          <div>
                            <div className={`p-4 rounded-3xl ${
                              isMe 
                                ? 'bg-primary-600 text-white rounded-tr-none shadow-lg shadow-primary-200' 
                                : 'bg-white text-surface-800 rounded-tl-none border border-surface-100 shadow-sm'
                            }`}>
                              {msg.content && <p className="text-sm leading-relaxed">{msg.content}</p>}
                              
                              {msg.file_url && (
                                <div className={`mt-2 ${msg.content ? 'pt-2 border-t border-white/20' : ''}`}>
                                  {msg.file_type === 'image' ? (
                                    <img src={msg.file_url} alt="Clinical Attachment" className="rounded-xl max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity" />
                                  ) : (
                                    <a href={msg.file_url} target="_blank" rel="noreferrer" className={`flex items-center gap-3 p-3 rounded-2xl bg-black/5 hover:bg-black/10 transition-colors`}>
                                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Paperclip className="w-5 h-5" /></div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold truncate">{msg.file_name}</p>
                                        <p className="text-[10px] opacity-70">Medical Document</p>
                                      </div>
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className={`mt-1 flex items-center gap-2 text-[10px] text-surface-400 ${isMe ? 'justify-end' : ''}`}>
                              <span>{formatRelativeTime(msg.created_at)}</span>
                              {isMe && (msg.read ? <CheckCheck className="w-3.5 h-3.5 text-primary-500" /> : <Check className="w-3.5 h-3.5" />)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Control */}
              <div className="p-4 bg-white border-t border-surface-100">
                <form onSubmit={(e) => handleSend(e)} className="flex items-end gap-3 bg-surface-50 rounded-3xl p-2.5 px-4 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
                  <div className="flex items-center gap-1 mb-1">
                    <button 
                      type="button" 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`p-2 rounded-full hover:bg-white transition-all ${showEmojiPicker ? 'text-primary-600 bg-white shadow-sm' : 'text-surface-400'}`}
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-surface-400 hover:text-surface-600 rounded-full hover:bg-white transition-all"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <textarea
                    rows={1}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = e.target.scrollHeight + 'px'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder="Type a message to your doctor..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32"
                  />
                  
                  <button
                    type="submit"
                    disabled={isSending || (!newMessage.trim())}
                    className="p-3 bg-primary-600 text-white rounded-2xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-90 mb-0.5"
                  >
                    <Send className="w-4.5 h-4.5" />
                  </button>
                </form>

                {/* Emoji Picker */}
                {showEmojiPicker && (
                  <div className="absolute bottom-24 left-6 bg-white rounded-3xl shadow-premium-lg border border-surface-100 p-3 grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                     {EMOJI_REACTIONS.map(emoji => (
                       <button
                        key={emoji}
                        onClick={() => { setNewMessage(prev => prev + emoji); setShowEmojiPicker(false) }}
                        className="w-10 h-10 flex items-center justify-center text-xl hover:bg-surface-50 rounded-xl transition-colors"
                       >
                         {emoji}
                       </button>
                     ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-surface-50/10">
               <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mb-6">
                 <MessageSquare className="w-10 h-10 text-primary-500" />
               </div>
               <h2 className="text-xl font-bold text-surface-900 mb-2">Private Consultation</h2>
               <p className="text-surface-500 max-w-sm">Chat with your specialist, share reports, and get medical advice in a private, secure environment.</p>
               <Button onClick={() => setShowNewChatModal(true)} className="mt-8" icon={Plus}>New Conversation</Button>
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

        {/* New Chat Modal */}
        {showNewChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-premium-lg w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
               <div className="p-6 border-b border-surface-50 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-surface-900">Reach Out to a Doctor</h3>
                  <button onClick={() => setShowNewChatModal(false)} className="p-2 hover:bg-surface-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
               </div>
               <div className="p-4">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input 
                      className="w-full pl-10 pr-4 py-3 bg-surface-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-100" 
                      placeholder="Search from your doctor list..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-1 custom-scrollbar">
                    {potentialDoctors.length === 0 ? (
                      <div className="py-8 text-center text-surface-400 text-sm">No new doctors available to message</div>
                    ) : (
                      potentialDoctors
                        .filter(d => d.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => { setSelectedPeer(doc); setShowNewChatModal(false) }}
                          className="w-full flex items-center gap-4 p-3 hover:bg-surface-50 rounded-2xl transition-all"
                        >
                          <Avatar name={doc.full_name} size="md" />
                          <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-surface-900">{doc.full_name}</p>
                            <p className="text-xs text-surface-500">{doc.specialization}</p>
                          </div>
                          <Plus className="w-4 h-4 text-primary-600" />
                        </button>
                      ))
                    )}
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}