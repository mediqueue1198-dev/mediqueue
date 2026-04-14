import supabase from '@/lib/supabase'
import { sortQueue } from '@/utils/queueEngine'
import { isUuid } from '@/utils/uuid'

export const queueService = {
  async getQueue(doctorId) {
    let query = supabase
      .from('queue_entries')
      .select('*, patient:users!patient_id(full_name, phone, email), doctor:doctors!doctor_id(*)')
      .in('status', ['waiting', 'in_consultation'])
      .order('priority_score', { ascending: false })
    if (doctorId && isUuid(doctorId)) query = query.eq('doctor_id', doctorId)
    const { data, error } = await query
    if (error) throw error
    return sortQueue(data || [])
  },

  async addToQueue(entryData) {
    const { data, error } = await supabase
      .from('queue_entries')
      .insert(entryData)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateEntry(id, updates) {
    const { data, error } = await supabase
      .from('queue_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async callNextPatient(doctorId) {
    if (!isUuid(doctorId)) return null
    // Call RPC to atomically update queue
    const { data, error } = await supabase.rpc('call_next_patient', { p_doctor_id: doctorId })
    if (error) throw error
    return data
  },

  async getPatientToken(patientId) {
    if (!isUuid(patientId)) return []
    const { data, error } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctor_id(*)')
      .eq('patient_id', patientId)
      .in('status', ['waiting', 'in_consultation'])
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getDoctorQueueStats(doctorId) {
    if (!isUuid(doctorId)) return null
    const { data, error } = await supabase.rpc('get_doctor_queue_stats', { p_doctor_id: doctorId })
    if (error) throw error
    return data
  },

  async getHospitalMetrics() {
    const { data: metrics, error: mError } = await supabase.rpc('get_hospital_realtime_metrics')
    if (mError) throw mError

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const { data: queueData, error: qError } = await supabase
      .from('queue_entries')
      .select('status, queue_type, created_at')
      .gte('created_at', startOfDay.toISOString())
    
    const { count: doctorCount } = await supabase
      .from('doctors')
      .select('*', { count: 'exact', head: true })
      .eq('is_available', true)

    if (qError) throw qError

    // Group by hour for flow chart
    const hourlyMap = {}
    for (let i = 8; i <= 18; i++) {
      const label = i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i-12}pm`
      hourlyMap[label] = 0
    }

    (queueData || []).forEach(q => {
      const hour = new Date(q.created_at).getHours()
      const label = hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour-12}pm`
      if (hourlyMap[label] !== undefined) hourlyMap[label]++
    })

    const hourlyFlow = Object.entries(hourlyMap).map(([hour, patients]) => ({ hour, patients }))

    return {
      ...metrics,
      active_doctors: doctorCount || 0,
      appointments_today: (queueData || []).filter(q => q.queue_type === 'appointment').length,
      walk_ins_today: (queueData || []).filter(q => q.queue_type === 'walk_in').length,
      hourly_flow: hourlyFlow,
    }
  },

  async getActiveQueues() {
    return this.getQueue()
  },

  // Bug 1 fix: subscribeToQueue() has been removed.
  // All realtime queue_entries updates are already handled by useRealtime.js
  // via the 'queue-global-v2' channel. Having a second subscription here
  // caused duplicate handleRealtimeUpdate() calls leading to queue flickering,
  // ghost entries, and incorrect position ordering.
  // Any component that previously called queueService.subscribeToQueue()
  // should rely on the global useRealtime hook instead.
}

export default queueService
