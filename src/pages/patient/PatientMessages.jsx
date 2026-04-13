import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare, MoreVertical, Trash2, UserMinus, Smile, Image, Phone, Video, Check, CheckCheck, X } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { messagesService } from '@/services/messages.service'
import { appointmentsService } from '@/services/appointments.service'
import { formatRelativeTime } from '@/utils/helpers'
import toast from 'react-hot-toast'
import supabase from '@/lib/supabase'

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉']

export default function PatientMessages() {
  const { user, profile } = useAuth()
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showMenu, setShowMenu] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(null)
  const [removedDoctors, setRemovedDoctors] = useState([])
  const messagesEndRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    
    const loadDoctors = async () => {
      try {
        const appointments = await appointmentsService.getAll({ patient_id: user.id })
        
        const confirmedStatuses = ['pending', 'confirmed', 'completed']
        const myAppointments = appointments.filter(a => 
          confirmedStatuses.includes(a.status) && a.doctor_id
        )
        
        const uniqueDoctorIds = [...new Set(myAppointments.map(a => a.doctor_id))]
        
        if (uniqueDoctorIds.length === 0) {
          setDoctors([])
          return
        }
        
        const { doctorsService } = await import('@/services/doctors.service')
        const doctorsData = await doctorsService.getAll({ ids: uniqueDoctorIds })
        const filteredDoctors = doctorsData.filter(d => !removedDoctors.includes(d.id))
        setDoctors(filteredDoctors)
        
        if (filteredDoctors.length > 0 && !selectedDoctor) {
          setSelectedDoctor(filteredDoctors[0])
        } else if (selectedDoctor && removedDoctors.includes(selectedDoctor.id)) {
          setSelectedDoctor(filteredDoctors[0] || null)
        }
      } catch (err) {
        console.error('Failed to load doctors:', err)
        setDoctors([])
      }
    }
    
    loadDoctors()
  }, [user?.id, removedDoctors])

  useEffect(() => {
    if (!user?.id || !selectedDoctor) return
    messagesService.getConversation(user.id, selectedDoctor.user_id)
      .then(setMessages)
      .catch(err => console.error('Failed to load messages:', err))
  }, [user?.id, selectedDoctor?.id])

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!user?.id) return
    const sub = messagesService.subscribeToMessages(user.id, (payload) => {
      const msg = payload.new
      // Only add if it's from the currently selected doctor
      if (selectedDoctor && msg.sender_id === selectedDoctor.user_id) {
        setMessages(prev => [...prev, msg])
      }
    })
    return () => sub.unsubscribe()
  }, [user?.id, selectedDoctor?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !user?.id) return
    setIsSending(true)
    try {
      const msg = await messagesService.send(user.id, selectedDoctor.user_id, newMessage.trim())
      setMessages(prev => [...prev, { ...msg, sender: profile }])
      setNewMessage('')
    } catch (err) {
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }


  const handleDeleteMessage = async (messageId) => {
    try {
      await supabase.from('messages').delete().eq('id', messageId)
      setMessages(prev => prev.filter(m => m.id !== messageId))
      toast.success('Message deleted')
    } catch (err) {
      toast.error('Failed to delete message')
    }
  }

  const handleDeleteChat = async () => {
    if (!selectedDoctor || !user?.id) return
    try {
      await supabase.from('messages').delete().or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${selectedDoctor.user_id}),and(sender_id.eq.${selectedDoctor.user_id},receiver_id.eq.${user.id})`
      )
      setMessages([])
      setShowMenu(null)
      toast.success('Chat deleted')
    } catch (err) {
      toast.error('Failed to delete chat')
    }
  }

  const handleRemoveDoctor = () => {
    if (!selectedDoctor) return
    setRemovedDoctors(prev => [...prev, selectedDoctor.id])
    setSelectedDoctor(doctors.find(d => d.id !== selectedDoctor.id) || null)
    setShowMenu(null)
    toast.success('Doctor removed from conversations')
  }

  const handleAddReaction = async (messageId, emoji) => {
    setShowEmojiPicker(null)
  }

  const filteredDoctors = doctors.filter(d => !removedDoctors.includes(d.id))

  return (
    <DashboardLayout title="Messages" subtitle="Communicate with your doctors">
      <div className="max-w-5xl mx-auto flex gap-4 h-[calc(100vh-180px)]">
        {/* Doctor list */}
        <div className="w-72 flex-shrink-0 bg-white rounded-2xl shadow-soft border border-surface-100 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-surface-100">
            <p className="font-semibold text-surface-700 text-sm">Conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredDoctors.length === 0 ? (
              <div className="p-4 text-center text-surface-500 text-sm">
                No conversations yet. Book an appointment to start messaging.
              </div>
            ) : (
              filteredDoctors.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoctor(doc)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50 transition-colors border-b border-surface-50 ${
                    selectedDoctor?.id === doc.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <Avatar name={doc.user?.full_name} size="md" className="w-10 h-10" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-surface-800 truncate">{doc.user?.full_name}</p>
                      <div className={`w-2 h-2 rounded-full ${doc.is_available ? 'bg-green-500' : 'bg-surface-300'}`} />
                    </div>
                    <p className="text-xs text-surface-500 truncate">{doc.specialization}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-white rounded-2xl shadow-soft border border-surface-100 flex flex-col overflow-hidden">
          {selectedDoctor ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar name={selectedDoctor.user?.full_name} size="md" className="w-10 h-10" />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${selectedDoctor.is_available ? 'bg-green-500' : 'bg-surface-300'}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-surface-800">{selectedDoctor.user?.full_name}</p>
                    <p className="text-xs text-surface-500">{selectedDoctor.is_available ? 'Online' : 'Offline'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-surface-100 rounded-full transition-colors">
                    <Phone className="w-4 h-4 text-surface-500" />
                  </button>
                  <button className="p-2 hover:bg-surface-100 rounded-full transition-colors">
                    <Video className="w-4 h-4 text-surface-500" />
                  </button>
                  <div className="relative" ref={menuRef}>
                    <button 
                      onClick={() => setShowMenu(showMenu === selectedDoctor.id ? null : selectedDoctor.id)}
                      className="p-2 hover:bg-surface-100 rounded-full transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-surface-500" />
                    </button>
                    {showMenu === selectedDoctor.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-surface-100 py-1 min-w-[160px] z-10">
                        <button 
                          onClick={handleDeleteChat}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Chat
                        </button>
                        <button 
                          onClick={handleRemoveDoctor}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-50"
                        >
                          <UserMinus className="w-4 h-4" />
                          Remove Doctor
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No messages yet"
                    description="Start a conversation with your doctor."
                    className="py-8"
                  />
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.sender_id === user?.id
                    const showAvatar = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id
                    const showTime = idx === messages.length - 1 || messages[idx + 1].sender_id !== msg.sender_id
                    
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                        {showAvatar ? (
                          <Avatar
                            name={isMe ? profile?.full_name : selectedDoctor.user?.full_name}
                            size="sm"
                            className="flex-shrink-0 mt-1"
                          />
                        ) : (
                          <div className="w-8 flex-shrink-0" />
                        )}
                        <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                          <div 
                            className={`relative group px-4 py-2.5 rounded-2xl cursor-pointer ${
                              isMe
                                ? 'bg-primary-600 text-white rounded-br-sm'
                                : 'bg-surface-100 text-surface-800 rounded-bl-sm'
                            }`}
                            onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            
                            {/* Message actions hover */}
                            <div className={`absolute top-1/2 -translate-y-1/2 ${isMe ? '-left-10' : '-right-10'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id) }}
                                className="p-1.5 hover:bg-surface-200 rounded-full"
                              >
                                <Smile className="w-3.5 h-3.5 text-surface-500" />
                              </button>
                              {isMe && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id) }}
                                  className="p-1.5 hover:bg-surface-200 rounded-full"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-surface-500" />
                                </button>
                              )}
                            </div>
                            
                            {/* Emoji picker */}
                            {showEmojiPicker === msg.id && (
                              <div className={`absolute ${isMe ? 'left-0 bottom-full mb-1' : 'right-0 bottom-full mb-1'} flex gap-1 bg-white rounded-full p-1 shadow-lg`}>
                                {EMOJI_REACTIONS.map(emoji => (
                                  <button
                                    key={emoji}
                                    onClick={(e) => { e.stopPropagation(); handleAddReaction(msg.id, emoji) }}
                                    className="hover:scale-125 transition-transform p-1"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Time and read receipt */}
                          {showTime && (
                            <div className={`flex items-center gap-1 text-xs text-surface-400 ${isMe ? 'justify-end' : ''}`}>
                              <span>{formatRelativeTime(msg.created_at)}</span>
                              {isMe && (
                                <span>{msg.read ? <CheckCheck className="w-3.5 h-3.5 text-primary-600" /> : <Check className="w-3.5 h-3.5" />}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-4 border-t border-surface-100">
                <div className="flex items-center gap-2 bg-surface-50 rounded-2xl px-4 py-2">
                  <button type="button" className="p-2 hover:bg-surface-200 rounded-full transition-colors">
                    <Image className="w-5 h-5 text-surface-500" />
                  </button>
                  <button type="button" className="p-2 hover:bg-surface-200 rounded-full transition-colors">
                    <Smile className="w-5 h-5 text-surface-500" />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 bg-transparent text-sm focus:outline-none"
                  />
                  <Button type="submit" isLoading={isSending} size="icon" className="!rounded-full" disabled={!newMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <EmptyState icon={MessageSquare} title="Select a doctor" description="Choose a doctor to start messaging." />
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}