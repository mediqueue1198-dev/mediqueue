import { create } from 'zustand'
import {
  sortQueue,
  calculatePriorityScore,
  recalculateQueue,
  generateToken,
  shouldReQueue,
  reQueueSkippedPatient,
} from '@/utils/queueEngine'
import toast from 'react-hot-toast'
import notificationService, { NOTIFICATION_TYPES } from '@/services/notificationService'

export const useQueueStore = create((set, get) => ({
  entries: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  calledPatientTimer: null,

  // ─── BREAK MODE STATE ─────────────────────────────────────────────────────
  // These mirror the doctor's DB columns. Populated by loadQueue / realtime.
  isOnBreak: false,
  breakUntil: null,
  breakMessage: null,
  breakCheckInterval: null,

  // ─── LOAD ──────────────────────────────────────────────────────────────────
  loadQueue: async (doctorId) => {
    set({ isLoading: true, error: null })
    try {
      const { supabase } = await import('@/lib/supabase')
      
      let query = supabase
        .from('queue_entries')
        .select(
          '*, patient:users!patient_id(full_name, phone, email, no_show_rate, no_show_count, total_visits), doctor:doctors!doctor_id(*, user:users!user_id(full_name)), family_member:family_members(name, relationship)'
        )
        .in('status', ['waiting', 'in_consultation', 'skipped'])
        .order('priority_score', { ascending: false })

      if (doctorId) query = query.eq('doctor_id', doctorId)

      const { data, error } = await query
      if (error) {
        toast.error('Failed to load queue: ' + error.message)
        throw error
      }
      set({ entries: sortQueue(data || []), isLoading: false, lastUpdated: new Date() })

      // Fetch doctor break state if we have a doctorId
      if (doctorId) {
        get().fetchBreakState(doctorId)
      }

      // Start skipped-patient watcher (runs every 2 min)
      get().startSkippedPatientWatcher()
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },

  // ─── REALTIME UPDATE ───────────────────────────────────────────────────────
  handleRealtimeUpdate: (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    set(async state => {
      let entries = [...state.entries]
      switch (eventType) {
        case 'INSERT': {
          if (!entries.some(e => e.id === newRecord.id)) {
            try {
              const { supabase } = await import('@/lib/supabase')
              const { data: fullEntry, error } = await supabase
                .from('queue_entries')
                .select(
                  '*, patient:users!patient_id(full_name, phone, email, no_show_rate, no_show_count, total_visits), doctor:doctors!doctor_id(*, user:users!user_id(full_name)), family_member:family_members(name, relationship)'
                )
                .eq('id', newRecord.id)
                .maybeSingle()
              if (!error && fullEntry) {
                entries = [...entries, fullEntry]
              } else {
                entries = [...entries, newRecord]
              }
            } catch {
              entries = [...entries, newRecord]
            }
          }
          break
        }
        case 'UPDATE': {
          entries = entries.map(e =>
            e.id === newRecord.id ? { ...e, ...newRecord } : e
          )
          entries = entries.filter(e =>
            ['waiting', 'in_consultation', 'skipped'].includes(e.status)
          )
          break
        }
        case 'DELETE':
          entries = entries.filter(e => e.id !== oldRecord.id)
          break
      }
      return { entries: sortQueue(entries), lastUpdated: new Date() }
    })
  },

  // ─── CALL NEXT ─────────────────────────────────────────────────────────────
  callNext: async (doctorId) => {
    // Guard: don't call next while doctor is on break
    if (get().isOnBreak) {
      toast.error('You are on a break. Resume before calling the next patient.')
      return null
    }

    set({ isLoading: true })
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: nextPatient, error } = await supabase.rpc('call_next_patient', {
        p_doctor_id: doctorId,
      })

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
  startNoShowTimer: (entryId, doctorId, _calledAt) => {
    const state = get()
    if (state.calledPatientTimer) clearTimeout(state.calledPatientTimer)

    const timer = setTimeout(async () => {
      const entry = get().entries.find(e => e.id === entryId)
      // Bug 2 fix: only fire if patient was called but never physically arrived
      if (entry && entry.status === 'in_consultation' && entry.arrival_status !== 'arrived') {
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

  // ─── HANDLE NO SHOW ────────────────────────────────────────────────────────
  handleNoShow: async (entryId, doctorId) => {
    const { supabase } = await import('@/lib/supabase')
    get().clearNoShowTimer()

    const entry = get().entries.find(e => e.id === entryId)
    if (!entry) return

    const newPriorityScore = Math.max(10, Math.floor((entry.priority_score || 100) * 0.3))

    const { error } = await supabase
      .from('queue_entries')
      .update({
        status: 'waiting',
        skipped_at: null,
        priority_score: newPriorityScore,
        no_show_count: (entry.patient?.no_show_count || 0) + 1
      })
      .eq('id', entryId)

    if (error) {
      toast.error('Failed to process no-show: ' + error.message)
      return
    }

    set(state => ({
      entries: sortQueue(
        state.entries.map(e =>
          e.id === entryId
            ? { ...e, status: 'waiting', priority_score: newPriorityScore, skipped_at: null }
            : e
        )
      ),
    }))

    toast.success(`${entry.token_number} moved to end of queue. Please check in again.`)
  },

  // ─── UPDATE STATUS ─────────────────────────────────────────────────────────
  updateStatus: async (entryId, status, extras = {}) => {
    const { supabase } = await import('@/lib/supabase')
    const now = new Date().toISOString()

    const updates = { status, ...extras }

    // Track consultation start
    if (status === 'in_consultation' && !extras.consultation_started_at) {
      updates.consultation_started_at = now
    }

    // Start no-show timer when patient is called to consultation
    if (status === 'in_consultation') {
      get().startNoShowTimer(entryId, null, now)
    }

    // Track consultation end and record duration
    if (status === 'completed') {
      updates.completed_at = now
      updates.consultation_ended_at = now

      const entry = get().entries.find(e => e.id === entryId)
      if (entry?.consultation_started_at) {
        const durationMinutes = Math.round(
          (new Date(now) - new Date(entry.consultation_started_at)) / 60000
        )
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
          await notificationService.notifyConsultationNear(entry.doctor_id, 3)
        } catch (err) {
          console.error('Failed to record consultation:', err)
        }
      }
    }

    // Track skipped_at for re-queue logic
    if (status === 'skipped') {
      updates.skipped_at = now
    }

    // Arrival tracking
    if (status === 'waiting' && extras.check_in_status) {
      updates.arrival_status = 'arrived'
    }

    const { error } = await supabase.from('queue_entries').update(updates).eq('id', entryId)
    if (error) {
      toast.error('Status update failed: ' + error.message)
      return
    }

    // Get entry for callNext after update
    const entry = get().entries.find(e => e.id === entryId)

    // Bug 6 fix: merge full updates object (not just {status}) into local state
    set(state => ({
      entries: sortQueue(
        state.entries.map(e => (e.id === entryId ? { ...e, ...updates } : e))
      ),
    }))

    if (['completed', 'skipped', 'no_show'].includes(status) && entry) {
      get().clearNoShowTimer()
      get().callNext(entry.doctor_id)
    }
  },

  // ─── CHECK IN ──────────────────────────────────────────────────────────────
  checkIn: async (entryId) => {
    const now = new Date().toISOString()
    const { supabase } = await import('@/lib/supabase')

    const entry = get().entries.find(e => e.id === entryId)
    if (!entry) return

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

    get().recalculate()

    try {
      await notificationService.notifyConsultationNear(entry.doctor_id, 3)
    } catch (err) {
      console.error('Failed to notify consultation near:', err)
    }
  },

  // ─── ADD FROM APPOINTMENT ─────────────────────────────────────────────────
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

    const { supabase } = await import('@/lib/supabase')

    const { data: inserted, error: rpcError } = await supabase.rpc('check_in_from_appointment', {
      p_appointment_id: appointment.id,
      p_doctor_id: appointment.doctor_id,
      p_token: token,
      p_priority_score: Math.round(priorityScore || 100),
      p_predicted_time: Math.round(appointment.duration_minutes || 15),
    })

    if (rpcError) {
      toast.error('Check-in failed: ' + rpcError.message)
      throw rpcError
    }

    if (!inserted) {
      toast.error('Queue entry created but could not be retrieved. Please refresh.')
      throw new Error('Retrieved null after check-in')
    }

    // Send token notification
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

    // Check capacity
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
    const token = generateToken(
      data.is_emergency ? 'emergency' : 'walk_in',
      doctorEntries,
      doctorInfo
    )

    const { supabase } = await import('@/lib/supabase')

    const { data: rpcResult, error: rpcError } = await supabase.rpc('register_walk_in_patient', {
      p_full_name: data.full_name,
      p_phone: data.phone,
      p_doctor_id: data.doctor_id,
      p_symptoms: data.symptoms || '',
      p_is_emergency: data.is_emergency || false,
      p_token: token,
    })

    if (!rpcError && rpcResult) {
      const inserted = rpcResult

      if (inserted) {
        set(state => {
          if (state.entries.some(e => e.id === inserted.id)) return state
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

    if (rpcError) {
      const errMsg =
        rpcError.code === 'PGRST202'
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
    const { error } = await supabase
      .from('queue_entries')
      .update({ priority_score: newScore })
      .eq('id', entryId)
    if (error) toast.error('Priority update failed: ' + error.message)
    set(state => ({
      entries: sortQueue(
        state.entries.map(e => (e.id === entryId ? { ...e, priority_score: newScore } : e))
      ),
    }))
  },

  // ─── RECALCULATE ───────────────────────────────────────────────────────────
  recalculate: () => {
    set(state => ({
      entries: recalculateQueue(state.entries),
      lastUpdated: new Date(),
    }))
  },

  // ─── BREAK MODE ────────────────────────────────────────────────────────────

  /**
   * Fetch doctor's current break state from DB and sync to store.
   */
  fetchBreakState: async (doctorId) => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase
        .from('doctors')
        .select('is_on_break, break_until, break_message')
        .eq('id', doctorId)
        .maybeSingle()

      if (error) throw error
      if (!data) return;

      // Auto-clear break if break_until has already passed
      const breakExpired = data.break_until && new Date(data.break_until) < new Date()
      if (data.is_on_break && breakExpired) {
        await get().resumeFromBreak(doctorId)
        return
      }

      set({
        isOnBreak: data.is_on_break || false,
        breakUntil: data.break_until,
        breakMessage: data.break_message,
      })
    } catch (err) {
      console.error('Failed to fetch break state:', err)
    }
  },

  /**
   * Put doctor on break for N minutes with an optional message.
   */
  toggleBreak: async (doctorId, durationMinutes = 15, message = '') => {
    const { supabase } = await import('@/lib/supabase')
    const now = new Date()
    const breakUntil = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('doctors')
      .update({
        is_on_break: true,
        break_until: breakUntil,
        break_message: message || `Doctor is on a short break (${durationMinutes} min)`,
      })
      .eq('id', doctorId)

    if (error) {
      toast.error('Failed to start break: ' + error.message)
      return
    }

    set({ isOnBreak: true, breakUntil, breakMessage: message })
    toast(`Break started — ${durationMinutes} min. Queue is paused.`, { icon: '⏸️' })

    // Auto-resume when timer expires
    setTimeout(() => {
      const state = get()
      if (state.isOnBreak) {
        get().resumeFromBreak(doctorId)
        toast.success('Break time ended. Queue resumed.')
      }
    }, durationMinutes * 60 * 1000)
  },

  /**
   * Resume the queue from a manual or auto break.
   */
  resumeFromBreak: async (doctorId) => {
    const { supabase } = await import('@/lib/supabase')
    const { error } = await supabase
      .from('doctors')
      .update({ is_on_break: false, break_until: null, break_message: null })
      .eq('id', doctorId)

    if (error) {
      toast.error('Failed to resume: ' + error.message)
      return
    }

    set({ isOnBreak: false, breakUntil: null, breakMessage: null })
  },

  // ─── SKIPPED PATIENT WATCHER ───────────────────────────────────────────────

  /**
   * Start an interval that re-queues skipped patients after their grace period.
   * Runs every 2 minutes. Clears any previous interval first.
   */
  startSkippedPatientWatcher: () => {
    // Clear existing watcher
    const existing = get().breakCheckInterval
    if (existing) clearInterval(existing)

    const interval = setInterval(() => {
      get().processSkippedPatients()
    }, 2 * 60 * 1000) // every 2 min

    set({ breakCheckInterval: interval })
  },

  /**
   * Find all skipped patients whose grace period has expired and re-queue them.
   * Updates DB and local state atomically.
   */
  processSkippedPatients: async () => {
    const { supabase } = await import('@/lib/supabase')
    const skippedEntries = get().entries.filter(e => shouldReQueue(e))
    if (skippedEntries.length === 0) return

    for (const entry of skippedEntries) {
      const reQueued = reQueueSkippedPatient(entry)
      const { error } = await supabase
        .from('queue_entries')
        .update({
          status: 'waiting',
          priority_score: reQueued.priority_score,
          skipped_at: null,
        })
        .eq('id', entry.id)

      if (!error) {
        set(state => ({
          entries: sortQueue(
            state.entries.map(e =>
              e.id === entry.id
                ? { ...e, status: 'waiting', priority_score: reQueued.priority_score, skipped_at: null }
                : e
            )
          ),
        }))
        toast(`${entry.token_number} re-added to queue after grace period.`, { icon: '🔄' })
      }
    }
  },

  // ─── MANUAL RE-QUEUE ───────────────────────────────────────────────────────
  /**
   * Manually re-queue a skipped patient (called from doctor UI button).
   */
  manualReQueue: async (entryId) => {
    const { supabase } = await import('@/lib/supabase')
    const entry = get().entries.find(e => e.id === entryId)
    if (!entry) return

    const reQueued = reQueueSkippedPatient(entry)

    const { error } = await supabase
      .from('queue_entries')
      .update({ status: 'waiting', priority_score: reQueued.priority_score, skipped_at: null })
      .eq('id', entryId)

    if (error) {
      toast.error('Re-queue failed: ' + error.message)
      return
    }

    set(state => ({
      entries: sortQueue(
        state.entries.map(e =>
          e.id === entryId
            ? { ...e, status: 'waiting', priority_score: reQueued.priority_score, skipped_at: null }
            : e
        )
      ),
    }))

    toast.success(`${entry.token_number} moved back to waiting queue`)
  },

  // ─── RESET ─────────────────────────────────────────────────────────────────
  reset: () => {
    get().clearNoShowTimer()
    const interval = get().breakCheckInterval
    if (interval) clearInterval(interval)
    set({
      entries: [],
      isLoading: false,
      error: null,
      isOnBreak: false,
      breakUntil: null,
      breakMessage: null,
      breakCheckInterval: null,
    })
  },
}))
