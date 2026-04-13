import { create } from 'zustand'
import { sortQueue, calculatePriorityScore, recalculateQueue, generateToken } from '@/utils/queueEngine'
import toast from 'react-hot-toast'
import notificationService, { NOTIFICATION_TYPES } from '@/services/notificationService'

export const useQueueStore = create((set, get) => ({
  entries: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  calledPatientTimer: null,

  // ─── LOAD ──────────────────────────────────────────────────────────────────
  loadQueue: async (doctorId) => {
    set({ isLoading: true, error: null })
    try {
      const { supabase } = await import('@/lib/supabase')
      let query = supabase
        .from('queue_entries')
        .select('*, patient:users!patient_id(full_name, phone, email), doctor:doctors!doctor_id(*, user:users!user_id(full_name)), family_member:family_members(name, relationship)')
        .in('status', ['waiting', 'in_consultation'])
        .order('priority_score', { ascending: false })

      if (doctorId) query = query.eq('doctor_id', doctorId)

      const { data, error } = await query
      if (error) {
        toast.error('Failed to load queue: ' + error.message)
        throw error
      }
      set({ entries: sortQueue(data || []), isLoading: false, lastUpdated: new Date() })
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },

  // ─── REALTIME UPDATE ───────────────────────────────────────────────────────
  handleRealtimeUpdate: (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    set(state => {
      let entries = [...state.entries]
      switch (eventType) {
        case 'INSERT':
          if (!entries.some(e => e.id === newRecord.id)) {
            entries = [...entries, newRecord]
          }
          break
        case 'UPDATE':
          entries = entries.map(e => e.id === newRecord.id ? { ...e, ...newRecord } : e)
          break
        case 'DELETE':
          entries = entries.filter(e => e.id !== oldRecord.id)
          break
      }
      return { entries: sortQueue(entries), lastUpdated: new Date() }
    })
  },

  // ─── CALL NEXT ─────────────────────────────────────────────────────────────
  callNext: async (doctorId) => {
    set({ isLoading: true })
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: nextPatient, error } = await supabase.rpc('call_next_patient', { p_doctor_id: doctorId })

      if (error) throw error

      if (!nextPatient) {
        set({ isLoading: false })
        return null
      }

      // Send notification to patient
      try {
        await notificationService.sendPatientCalledNotification(
          nextPatient.patient_id,
          nextPatient.token_number,
          'Your Doctor'
        )
      } catch (err) {
        console.error('Failed to send call notification:', err)
      }

      // Start no-show timer
      get().startNoShowTimer(nextPatient.id, doctorId, new Date().toISOString())
      
      set({ isLoading: false })
      return nextPatient
    } catch (err) {
      toast.error('Call next failed: ' + err.message)
      set({ isLoading: false })
      return null
    }
  },

  // ─── NO SHOW TIMER ─────────────────────────────────────────────────────────
  startNoShowTimer: (entryId, doctorId, calledAt) => {
    const state = get()
    
    // Clear existing timer if any
    if (state.calledPatientTimer) {
      clearTimeout(state.calledPatientTimer)
    }

    // Set 5 minute timer
    const timer = setTimeout(async () => {
      const entry = get().entries.find(e => e.id === entryId)
      if (entry && entry.status === 'in_consultation') {
        // Patient didn't arrive - mark as no show
        await get().handleNoShow(entryId, doctorId)
      }
    }, 5 * 60 * 1000) // 5 minutes

    set({ calledPatientTimer: timer })
  },

  clearNoShowTimer: () => {
    const state = get()
    if (state.calledPatientTimer) {
      clearTimeout(state.calledPatientTimer)
      set({ calledPatientTimer: null })
    }
  },

  // ─── HANDLE NO SHOW ───────────────────────────────────────────────────────
  handleNoShow: async (entryId, doctorId) => {
    const { supabase } = await import('@/lib/supabase')
    
    get().clearNoShowTimer()

    // mark as no show
    const { error } = await supabase.rpc('handle_patient_no_show', { p_entry_id: entryId })
    if (error) {
      toast.error('Failed to process no-show: ' + error.message)
      return
    }

    // Automatically call next if possible
    await get().callNext(doctorId)
  },

  // ─── UPDATE STATUS ─────────────────────────────────────────────────────────
  updateStatus: async (entryId, status, extras = {}) => {
    const { supabase } = await import('@/lib/supabase')
    const now = new Date().toISOString()
    
    const updates = { status, ...extras }
    
    // Track consultation timing
    if (status === 'in_consultation' && !extras.consultation_started_at) {
      updates.consultation_started_at = now
    }
    
    // Add completed_at for completed status
    if (status === 'completed') {
      updates.completed_at = now
      updates.consultation_ended_at = now
      
      // Calculate duration in minutes
      const entry = get().entries.find(e => e.id === entryId)
      if (entry?.consultation_started_at) {
        const start = new Date(entry.consultation_started_at)
        const end = new Date(now)
        const durationMinutes = Math.round((end - start) / 60000)
        updates.consultation_duration_minutes = durationMinutes
      }
      
      // Record consultation in history
      if (entry) {
        try {
          await notificationService.recordConsultation(
            entry.doctor_id,
            entry.patient_id,
            entry.id,
            entry.consultation_started_at || entry.called_at,
            now
          )
          
          // Notify consultation near for patients ahead
          await notificationService.notifyConsultationNear(entry.doctor_id, 3)
        } catch (err) {
          console.error('Failed to record consultation:', err)
        }
      }
    }

    // Add arrival_status
    if (status === 'waiting' && extras.check_in_status) {
      updates.arrival_status = 'arrived'
    }

    const { error } = await supabase.from('queue_entries').update(updates).eq('id', entryId)
    if (error) {
      toast.error('Status update failed: ' + error.message)
      return
    }
    
    set(state => ({
      entries: sortQueue(state.entries.map(e =>
        e.id === entryId ? { ...e, status, ...extras } : e
      )),
    }))

    // Recalculate queue after status change
    if (status === 'completed' || status === 'skipped' || status === 'no_show') {
      get().recalculate()
    }
  },

  // ─── CHECK IN ──────────────────────────────────────────────────────────────
  checkIn: async (entryId) => {
    const now = new Date().toISOString()
    const { supabase } = await import('@/lib/supabase')
    
    // Get entry info
    const entry = get().entries.find(e => e.id === entryId)
    if (!entry) return

    // Update status
    const { error } = await supabase
      .from('queue_entries')
      .update({ 
        status: 'waiting',
        check_in_status: true, 
        check_in_time: now,
        arrival_status: 'arrived',
        priority_score: calculatePriorityScore({
          ...entry,
          check_in_status: true,
          check_in_time: now,
        }),
      })
      .eq('id', entryId)

    if (error) {
      toast.error('Check-in failed: ' + error.message)
      return
    }

    // Recalculate queue after check-in
    get().recalculate()

    // Notify patients ahead about queue update
    const doctor = entry.doctor_id
    try {
      await notificationService.notifyConsultationNear(doctor, 3)
    } catch (err) {
      console.error('Failed to notify consultation near:', err)
    }
  },

  // ─── ADD FROM APPOINTMENT (CHECK-IN) ─────────────────────────────────────────
  addFromAppointment: async (appointment, doctorInfo = null) => {
    const state = get()
    const doctorEntries = state.entries.filter(e => e.doctor_id === appointment.doctor_id)
    const token = generateToken('appointment', doctorEntries, doctorInfo)

    const priorityScore = calculatePriorityScore({
      queue_type: 'appointment',
      created_at: new Date().toISOString(),
      check_in_status: true,
      scheduled_time: appointment.scheduled_time,
    })

    const newEntry = {
      doctor_id: appointment.doctor_id,
      patient_id: appointment.patient_id,
      appointment_id: appointment.id,
      queue_type: 'appointment',
      token_number: token,
      priority_score: priorityScore,
      predicted_consultation_time: appointment.duration_minutes || 15,
      status: 'waiting',
      check_in_status: true,
      check_in_time: new Date().toISOString(),
      arrival_status: 'arrived',
      called_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
    }

    const { supabase } = await import('@/lib/supabase')
    
    // Use RPC to bypass RLS for check-in
    const { data: entryId, error: rpcError } = await supabase.rpc('check_in_from_appointment', {
      p_appointment_id: appointment.id,
      p_doctor_id: appointment.doctor_id,
      p_token: token,
      p_priority_score: priorityScore,
      p_predicted_time: appointment.duration_minutes || 15
    })

    if (rpcError) {
      toast.error('Check-in failed: ' + rpcError.message)
      throw rpcError
    }

    // Fetch the inserted entry
    const { data: inserted, error: fetchError } = await supabase
      .from('queue_entries')
      .select('*, patient:users!patient_id(full_name, phone, email), doctor:doctors!doctor_id(*, user:users!user_id(full_name)), family_member:family_members(name, relationship)')
      .eq('id', entryId)
      .single()

    if (fetchError) {
      toast.error('Check-in failed: ' + fetchError.message)
      throw fetchError
    }

    // Send token generated notification
    try {
      const doctor = inserted.doctor
      await notificationService.sendTokenGeneratedNotification(
        appointment.patient_id,
        token,
        doctor?.user?.full_name || doctor?.name || 'Doctor'
      )
    } catch (err) {
      console.error('Failed to send token notification:', err)
    }

    set(state => ({ entries: sortQueue([...state.entries, inserted]) }))
    
    // Check capacity and notify
    try {
      const capacity = await notificationService.checkDoctorCapacity(appointment.doctor_id)
      if (capacity?.capacity_reached) {
        await notificationService.sendCapacityWarningNotification(
          appointment.patient_id,
          inserted.doctor?.name || 'Doctor'
        )
      }
    } catch (err) {
      console.error('Failed to check capacity:', err)
    }

    // Notify patients ahead
    try {
      await notificationService.notifyConsultationNear(appointment.doctor_id, 3)
    } catch (err) {
      console.error('Failed to notify consultation near:', err)
    }

    return inserted
  },

  // ─── ADD WALK-IN ───────────────────────────────────────────────────────────
  addWalkIn: async (data, doctorInfo = null) => {
    const state = get()
    const doctorEntries = state.entries.filter(e => e.doctor_id === data.doctor_id)
    const token = generateToken(data.is_emergency ? 'emergency' : 'walk_in', doctorEntries, doctorInfo)

    const { supabase } = await import('@/lib/supabase')

    // Try to use the server-side RPC first (handles guest user creation atomically)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('register_walk_in_patient', {
      p_full_name: data.full_name,
      p_phone: data.phone,
      p_doctor_id: data.doctor_id,
      p_symptoms: data.symptoms || '',
      p_is_emergency: data.is_emergency || false,
      p_token: token,
    })

    if (!rpcError && rpcResult) {
      // Fetch the freshly created queue entry with relations
      const { data: inserted, error: fetchError } = await supabase
        .from('queue_entries')
        .select('*, patient:users!patient_id(full_name, phone, email), doctor:doctors!doctor_id(*, user:users!user_id(full_name)), family_member:family_members(name, relationship)')
        .eq('id', rpcResult)
        .single()

      if (fetchError) {
        toast.error('Queue entry created but relation fetch failed: ' + fetchError.message, { duration: 6000 })
        throw fetchError
      }

      if (inserted) {
        // Only add if not already present (to avoid duplicate from realtime)
        set(state => {
          if (state.entries.some(e => e.id === inserted.id)) {
            return state
          }
          return { entries: sortQueue([...state.entries, inserted]) }
        })
        try {
          await notificationService.notifyConsultationNear(data.doctor_id, 3)
        } catch (err) {
          console.error('Failed to notify consultation near:', err)
        }
        return inserted
      }
    }

    // Fallback: RPC not available - show actionable error
    if (rpcError) {
      const errMsg = rpcError.code === 'PGRST202'
        ? 'Walk-in RPC not found. Please run the SQL migration.'
        : `Walk-in registration failed: ${rpcError.message}`
      toast.error(errMsg, { duration: 6000 })
      throw rpcError
    }

    toast.error('Walk-in registration failed: Server returned empty response')
    throw new Error('Walk-in registration failed')
  },



  // ─── CHANGE PRIORITY ───────────────────────────────────────────────────────
  changePriority: async (entryId, newScore) => {
    const { supabase } = await import('@/lib/supabase')
    const { error } = await supabase.from('queue_entries').update({ priority_score: newScore }).eq('id', entryId)
    if (error) toast.error('Priority update failed: ' + error.message)
    set(state => ({
      entries: sortQueue(state.entries.map(e =>
        e.id === entryId ? { ...e, priority_score: newScore } : e
      )),
    }))
  },

  // ─── RECALCULATE ───────────────────────────────────────────────────────────
  recalculate: () => {
    set(state => ({
      entries: recalculateQueue(state.entries),
      lastUpdated: new Date(),
    }))
  },

  reset: () => {
    get().clearNoShowTimer()
    set({ entries: [], isLoading: false, error: null })
  },
}))
