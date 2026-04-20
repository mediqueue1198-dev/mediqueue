import supabase from '@/lib/supabase'
import { sortQueue } from '@/utils/queueEngine'
import { isUuid } from '@/utils/uuid'
import { QueueEntry } from '@/types/queue'

export const queueService = {
  async getQueue(doctorId?: string): Promise<QueueEntry[]> {
    let query = supabase
      .from('queue_entries')
      .select('*, patient:patients(*, user:users(full_name, phone, email)), doctor:doctors(*, user:users(full_name))')
      .in('status', ['waiting', 'in_consultation', 'skipped'])
      .order('priority_score', { ascending: false })
    
    if (doctorId && isUuid(doctorId)) {
      query = query.eq('doctor_id', doctorId)
    }
    
    const { data, error } = await query
    if (error) throw error
    return sortQueue(data || [])
  },

  async addToQueue(entryData: Partial<QueueEntry>): Promise<QueueEntry> {
    const { data, error } = await supabase
      .from('queue_entries')
      .insert(entryData)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateEntry(id: string, updates: Partial<QueueEntry>): Promise<QueueEntry> {
    const { data, error } = await supabase
      .from('queue_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async callNextPatient(doctorId: string): Promise<QueueEntry | null> {
    if (!isUuid(doctorId)) return null
    // Call RPC to atomically update queue
    const { data, error } = await supabase.rpc('call_next_patient', { p_doctor_id: doctorId })
    if (error) throw error
    return data
  },

  async getPatientToken(patientId: string): Promise<QueueEntry[]> {
    if (!isUuid(patientId)) return []
    const { data, error } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctors!doctor_id(*, user:users(full_name))')
      .eq('patient_id', patientId)
      .in('status', ['waiting', 'in_consultation'])
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getDoctorQueueStats(doctorId: string) {
    if (!isUuid(doctorId)) return null
    const { data, error } = await supabase.rpc('get_doctor_queue_stats', { p_doctor_id: doctorId })
    if (error) throw error
    return data
  },

  async getHospitalMetrics(hospitalId?: string, doctorIds?: string[]) {
    let metrics = {
      total_today: 0,
      active_queue: 0,
      completed_today: 0,
      avg_wait_time: 0
    }

    if (hospitalId && isUuid(hospitalId) && !doctorIds) {
      const { data, error: mError } = await supabase.rpc('get_hospital_realtime_metrics', {
        p_hospital_id: hospitalId
      })
      if (mError) {
        console.error('RPC Error:', mError)
      } else {
        metrics = data
      }
    }

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    let query = supabase
      .from('queue_entries')
      .select('status, queue_type, created_at, doctor:doctors!doctor_id(hospital_id)')
      .gte('created_at', startOfDay.toISOString())
    
    let docQuery = supabase
      .from('doctors')
      .select('*', { count: 'exact', head: true })
      .eq('is_available', true)

    if (hospitalId) {
      // Filter entries by mapping through doctor's hospital_id
      // Note: In a real app we might have hospital_id directly on queue_entries for performance
      docQuery = docQuery.eq('hospital_id', hospitalId)
    }
    
    if (doctorIds && doctorIds.length > 0) {
      docQuery = docQuery.in('id', doctorIds)
    }

    const [{ data: queueData, error: qError }, { count: doctorCount }] = await Promise.all([
      query,
      docQuery
    ])

    if (qError) throw qError

    // Filter queueData by hospitalId or doctorIds if provided
    let filteredQueue = queueData || []
    if (doctorIds && doctorIds.length > 0) {
      filteredQueue = filteredQueue.filter(q => doctorIds.includes(q.doctor_id))
    } else if (hospitalId) {
      filteredQueue = filteredQueue.filter(q => (q.doctor as any)?.hospital_id === hospitalId)
    }

    // If we filtered by doctorIds, we need to recalculate the base metrics manually
    // because the RPC was hospital-wide
    if (doctorIds && doctorIds.length > 0) {
      metrics.total_today = filteredQueue.length
      metrics.active_queue = filteredQueue.filter(q => q.status === 'waiting' || q.status === 'in_consultation').length
      metrics.completed_today = filteredQueue.filter(q => q.status === 'completed').length
      
      const finished = filteredQueue.filter(q => (q.status === 'in_consultation' || q.status === 'completed') && q.consultation_started_at)
      if (finished.length > 0) {
        const totalWait = finished.reduce((acc, q) => {
          const wait = (new Date(q.consultation_started_at!).getTime() - new Date(q.created_at).getTime()) / (1000 * 60)
          return acc + wait
        }, 0)
        metrics.avg_wait_time = Math.round(totalWait / finished.length)
      } else {
        metrics.avg_wait_time = 0
      }
    }

    // Group by hour for flow chart
    const hourlyMap: Record<string, number> = {}
    for (let i = 8; i <= 21; i++) {
      const label = i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i-12}pm`
      hourlyMap[label] = 0
    }

    filteredQueue.forEach(q => {
      const hour = new Date(q.created_at).getHours()
      const label = hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour-12}pm`
      if (hourlyMap[label] !== undefined) hourlyMap[label]++
    })

    const hourlyDistribution = Object.entries(hourlyMap).map(([hour, count]) => ({ hour, count }))

    // Group by visit type
    const visitTypeMap: Record<string, number> = { 'Appointment': 0, 'Walk-in': 0, 'Emergency': 0 }
    filteredQueue.forEach(q => {
      if (q.queue_type === 'appointment') visitTypeMap['Appointment']++
      else if (q.queue_type === 'walk_in') visitTypeMap['Walk-in']++
      else if (q.queue_type === 'emergency') visitTypeMap['Emergency']++
    })
    const visitTypeDist = Object.entries(visitTypeMap).map(([name, count]) => ({ name, count }))

    return {
      ...metrics,
      active_doctors: doctorCount || 0,
      appointments_today: visitTypeMap['Appointment'],
      walk_ins_today: visitTypeMap['Walk-in'],
      hourly_distribution: hourlyDistribution,
      visit_type_dist: visitTypeDist
    }
  },

  async getActiveQueues() {
    return this.getQueue()
  },
}

export default queueService
