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
import notificationService from '@/services/notificationService'
import { QueueState } from '../types/queueStore'
import { QueueEntry } from '../types/queue'

export const useQueueStore = create<QueueState>()((set, get) => ({
  entries: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  currentCallingEntryId: null,
  noShowExpiresAt: null,
  calledPatientTimer: null,

  // ─── BREAK MODE STATE ─────────────────────────────────────────────────────
  isOnBreak: false,
  breakUntil: null,
  breakMessage: null,
  breakCheckInterval: null,

  // ─── LOAD ──────────────────────────────────────────────────────────────────
  loadQueue: async (doctorId: string | null) => {
    set({ isLoading: true, error: null })
    try {
      const { supabase } = await import('@/lib/supabase')
      
      let query = supabase
        .from('queue_entries')
        .select(
          '*, patient:patients(*, user:users(full_name, phone, email)), doctor:doctors(*, user:users(full_name)), family_member:family_members(name, relationship)'
        )
        .in('status', ['waiting', 'in_consultation', 'skipped'])
        .order('priority_score', { ascending: false })

      if (doctorId) query = query.eq('doctor_id', doctorId)

      const { data, error } = await query
      if (error) {
        toast.error('Failed to load queue: ' + error.message)
        throw error
      }
      set({ entries: sortQueue(data as QueueEntry[] || []), isLoading: false, lastUpdated: new Date() })

      if (doctorId) {
        get().fetchBreakState(doctorId)
      }

      get().startSkippedPatientWatcher()
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  // ─── REALTIME UPDATE ───────────────────────────────────────────────────────
  handleRealtimeUpdate: (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    
    // We update state asynchronously to fetch full relations for inserts
    const updateEntries = async () => {
      let entries = [...get().entries]
      switch (eventType) {
        case 'INSERT': {
          if (!entries.some(e => e.id === newRecord.id)) {
            try {
              const { supabase } = await import('@/lib/supabase')
              const { data: fullEntry, error } = await supabase
                .from('queue_entries')
                .select(
                  '*, patient:patients(*, user:users(full_name, phone, email)), doctor:doctors(*, user:users(full_name)), family_member:family_members(name, relationship)'
                )
                .eq('id', newRecord.id)
                .maybeSingle()
              
              if (!error && fullEntry) {
                entries = [...entries, fullEntry as QueueEntry]
              } else {
                entries = [...entries, newRecord as QueueEntry]
              }
            } catch {
              entries = [...entries, newRecord as QueueEntry]
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
      set({ entries: sortQueue(entries), lastUpdated: new Date() })
    }

    updateEntries()
  },

  // ─── CALL NEXT ─────────────────────────────────────────────────────────────
  callNext: async (doctorId: string) => {
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

      try {
        await notificationService.sendPatientCalledNotification(
          nextPatient.patient_id,
          nextPatient.token_number,
          'Your Doctor'
        )
      } catch (err) {
        console.error('Failed to send call notification:', err)
      }

      get().startNoShowTimer(nextPatient.id, doctorId, new Date().toISOString())
      set({ 
        isLoading: false,
        currentCallingEntryId: nextPatient.id,
      })
      return nextPatient
    } catch (err: any) {
      toast.error('Call next failed: ' + err.message)
      set({ isLoading: false })
      return null
    }
  },

  // ─── NO SHOW TIMER ─────────────────────────────────────────────────────────
  startNoShowTimer: (entryId: string, doctorId: string | null, calledAt: string) => {
    const state = get()
    if (state.calledPatientTimer) clearTimeout(state.calledPatientTimer)

    const expiryTime = new Date(new Date(calledAt).getTime() + 5 * 60 * 1000).toISOString()
    
    const timer = setTimeout(async () => {
      const currentEntry = get().entries.find(e => e.id === entryId)
      if (currentEntry && currentEntry.status === 'in_consultation' && currentEntry.arrival_status !== 'arrived' && doctorId) {
        await get().handleNoShow(entryId, doctorId)
      }
    }, 5 * 60 * 1000)

    set({ 
      calledPatientTimer: timer as any, 
      noShowExpiresAt: expiryTime,
      currentCallingEntryId: entryId 
    })
  },

  clearNoShowTimer: () => {
    const state = get()
    if (state.calledPatientTimer) {
      clearTimeout(state.calledPatientTimer)
    }
    set({ 
      calledPatientTimer: null,
      noShowExpiresAt: null,
      currentCallingEntryId: null
    })
  },

  // ─── HANDLE NO SHOW ────────────────────────────────────────────────────────
  handleNoShow: async (entryId: string, doctorId: string) => {
    const { supabase } = await import('@/lib/supabase')
    get().clearNoShowTimer()

    const entry = get().entries.find(e => e.id === entryId)
    if (!entry || entry.status !== 'in_consultation') return

    const newPriorityScore = Math.max(10, Math.floor((entry.priority_score || 100) * 0.3))

    const { error } = await supabase
      .from('queue_entries')
      .update({
        status: 'waiting',
        skipped_at: null,
        priority_score: newPriorityScore,
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
            ? { ...e, status: 'waiting', priority_score: newPriorityScore, skipped_at: null } as QueueEntry
            : e
        )
      ),
    }))

    toast.success(`${entry.token_number} moved to end of queue. Please check in again.`)
  },

  // ─── UPDATE STATUS ─────────────────────────────────────────────────────────
  updateStatus: async (entryId: string, status: string, extras = {}) => {
    const { supabase } = await import('@/lib/supabase')
    const entry = get().entries.find(e => e.id === entryId)
    if (!entry) return

    const now = new Date().toISOString()
    const updates: any = { status, ...extras }

    if (status === 'in_consultation' && !extras.consultation_started_at) {
      updates.consultation_started_at = now
    }
    if (status === 'in_consultation') {
      get().startNoShowTimer(entryId, entry.doctor_id, now)
    }
    if (status === 'completed') {
      updates.completed_at = now
      updates.consultation_ended_at = now
      if (entry.consultation_started_at) {
        const durationMinutes = Math.round(
          (new Date(now).getTime() - new Date(entry.consultation_started_at).getTime()) / 60000
        )
        updates.consultation_duration_minutes = durationMinutes
      }
      if (entry) {
        try {
          await notificationService.recordConsultation(
            entry.doctor_id,
            entry.patient_id || null,
            entry.id,
            entry.consultation_started_at || entry.called_at!,
            now
          )
          await notificationService.notifyConsultationNear(entry.doctor_id, 3)
        } catch (err) {
          console.error('Failed to record consultation:', err)
        }
      }
    }
    if (status === 'skipped') {
      updates.skipped_at = now
    }
    if (status === 'waiting' && extras.check_in_status) {
      updates.arrival_status = 'arrived'
    }

    const { error } = await supabase.from('queue_entries').update(updates).eq('id', entryId)
    if (error) {
      toast.error('Status update failed: ' + error.message)
      return
    }

    set(state => ({
      entries: sortQueue(
        state.entries
          .map(e => (e.id === entryId ? { ...e, ...updates } : e))
          .filter(e => ['waiting', 'in_consultation', 'skipped'].includes(e.status))
      ),
    }))

    if (['completed', 'skipped', 'no_show', 'cancelled'].includes(status) && entry) {
      get().clearNoShowTimer()
      if (status !== 'cancelled') {
        get().callNext(entry.doctor_id)
      }
    }
  },

  // ─── CHECK IN ──────────────────────────────────────────────────────────────
  checkIn: async (entryId: string) => {
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

  addFromAppointment: async (appointment: any) => {
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
      p_priority_score: Math.round(priorityScore || 100),
      p_predicted_time: Math.round(appointment.duration_minutes || 15),
    })

    if (rpcError) {
      toast.error('Check-in failed: ' + rpcError.message)
      throw rpcError
    }
    if (!inserted) throw new Error('Retrieved null after check-in')

    const fullInserted = inserted as QueueEntry;
    try {
      const doctor = fullInserted.doctor
      await notificationService.sendTokenGeneratedNotification(
        appointment.patient_id,
        fullInserted.token_number,
        doctor?.user?.full_name || doctor?.name || 'Doctor'
      )
    } catch (err) {
      console.error('Failed to send token notification:', err)
    }

    set(state => ({ entries: sortQueue([...state.entries, fullInserted]) }))
    try {
      const capacity = await notificationService.checkDoctorCapacity(appointment.doctor_id)
      if (capacity?.capacity_reached) {
        await notificationService.sendCapacityWarningNotification(
          appointment.patient_id,
          fullInserted.doctor?.name || 'Doctor'
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
    return fullInserted
  },

  addWalkIn: async (data: any) => {
    const { supabase } = await import('@/lib/supabase')
    const { data: rpcResult, error: rpcError } = await supabase.rpc('register_walk_in_patient', {
      p_full_name: data.full_name,
      p_phone: data.phone,
      p_doctor_id: data.doctor_id,
      p_symptoms: data.symptoms || '',
      p_is_emergency: data.is_emergency || false,
    })

    if (!rpcError && rpcResult) {
      const inserted = rpcResult as QueueEntry
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

    if (rpcError) throw rpcError
    throw new Error('Walk-in registration failed')
  },

  changePriority: async (entryId: string, newScore: number) => {
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

  recalculate: () => {
    set(state => ({
      entries: recalculateQueue(state.entries),
      lastUpdated: new Date(),
    }))
  },

  fetchBreakState: async (doctorId: string) => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase
        .from('doctors')
        .select('is_on_break, break_until, break_message')
        .eq('id', doctorId)
        .maybeSingle()

      if (error) throw error
      if (!data) return;

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

  toggleBreak: async (doctorId: string, durationMinutes = 15, message = '') => {
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

    setTimeout(() => {
      const state = get()
      if (state.isOnBreak) {
        get().resumeFromBreak(doctorId)
        toast.success('Break time ended. Queue resumed.')
      }
    }, durationMinutes * 60 * 1000)
  },

  resumeFromBreak: async (doctorId: string) => {
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

  startSkippedPatientWatcher: () => {
    const existing = get().breakCheckInterval
    if (existing) clearInterval(existing)
    const interval = setInterval(() => {
      get().processSkippedPatients()
    }, 2 * 60 * 1000)
    set({ breakCheckInterval: interval as any })
  },

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
                ? { ...e, status: 'waiting', priority_score: reQueued.priority_score, skipped_at: null } as QueueEntry
                : e
            )
          ),
        }))
        toast(`${entry.token_number} re-added to queue after grace period.`, { icon: '🔄' })
      }
    }
  },

  manualReQueue: async (entryId: string) => {
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
            ? { ...e, status: 'waiting', priority_score: reQueued.priority_score, skipped_at: null } as QueueEntry
            : e
        )
      ),
    }))
    toast.success(`${entry.token_number} moved back to waiting queue`)
  },

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
