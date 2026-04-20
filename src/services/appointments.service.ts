import supabase from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import { Appointment, AppointmentStatus } from '../types/appointments'

let currentChannel: RealtimeChannel | null = null

export const appointmentsService = {
  async getAll(filters: { patient_id?: string; doctor_id?: string; status?: AppointmentStatus } = {}): Promise<Appointment[]> {
    let query = supabase
      .from('appointments')
      .select('*, patient:patients!patient_id(*, user:user_id(full_name, email, phone)), doctor:doctors!doctor_id(*, user:users!user_id(full_name, email, phone))')
      .order('scheduled_time', { ascending: false })
    
    if (filters.patient_id) query = query.eq('patient_id', filters.patient_id)
    if (filters.doctor_id) query = query.eq('doctor_id', filters.doctor_id)
    if (filters.status) query = query.eq('status', filters.status)
    
    const { data, error } = await query
    if (error) throw error
    return data as Appointment[]
  },

  async getById(id: string): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patients!patient_id(*, user:user_id(full_name, email, phone)), doctor:doctors!doctor_id(*, user:users!user_id(full_name, email, phone))')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as Appointment
  },

  async create(appointmentData: Partial<Appointment>): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select('*, patient:patients!patient_id(*, user:user_id(full_name, email, phone)), doctor:doctors!doctor_id(*, user:users!user_id(full_name, email, phone))')
      .single()
    if (error) throw error
    return data as Appointment
  },

  async update(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select('*, patient:patients!patient_id(*, user:user_id(full_name, email, phone)), doctor:doctors!doctor_id(*, user:users!user_id(full_name, email, phone))')
      .single()
    if (error) throw error
    return data as Appointment
  },

  async cancel(id: string): Promise<Appointment> {
    return this.update(id, { status: 'cancelled' })
  },

  async approve(id: string): Promise<Appointment> {
    return this.update(id, { status: 'confirmed' })
  },

  async reject(id: string, reason: string = ''): Promise<Appointment> {
    return this.update(id, { status: 'rejected', notes: reason })
  },

  async createNotification(notificationData: { user_id: string; title: string; content?: string; message?: string; type: string }) {
    const typeMap: Record<string, string> = {
      'appointment_confirmed': 'appointment',
      'appointment_rejected': 'appointment',
      'appointment_reminder': 'appointment',
      'queue_update': 'queue',
    }
    const safeType = typeMap[notificationData.type] || 'system'

    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        user_id: notificationData.user_id,
        title: notificationData.title,
        message: notificationData.content || notificationData.message || '',
        type: safeType,
        is_read: false,
      }])
      .select()
      .single()
    if (error) console.error('Failed to create notification:', error)
    return data
  },

  async sendReminder(appointmentId: string) {
    const appointment = await this.getById(appointmentId)
    const apptDate = new Date(appointment.scheduled_time)
    const dateStr = apptDate.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
    const timeStr = apptDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })

    await this.createNotification({
      user_id: appointment.patient_id!,
      title: 'Appointment Reminder',
      content: `Reminder: Your appointment with Dr. ${appointment.doctor?.user?.full_name || 'Medical Specialist'} is scheduled for ${dateStr} at ${timeStr}. Please check in when you arrive.`,
      type: 'appointment_reminder'
    })

    return { message: 'Reminder sent successfully' }
  },

  async getTodayAppointments(doctorId: string): Promise<Appointment[]> {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patients!patient_id(*, user:user_id(full_name, email, phone))')
      .eq('doctor_id', doctorId)
      .gte('scheduled_time', startOfDay.toISOString())
      .lte('scheduled_time', endOfDay.toISOString())
      .order('scheduled_time')
    if (error) throw error
    return data as Appointment[]
  },

  async getByDoctorAndDate(doctorId: string, dateStr: string): Promise<{ scheduled_time: string }[]> {
    const start = new Date(dateStr)
    start.setHours(0, 0, 0, 0)
    const end = new Date(dateStr)
    end.setHours(23, 59, 59, 999)
    const { data, error } = await supabase
      .from('appointments')
      .select('scheduled_time')
      .eq('doctor_id', doctorId)
      .in('status', ['pending', 'confirmed'])
      .gte('scheduled_time', start.toISOString())
      .lte('scheduled_time', end.toISOString())
    if (error) throw error
    return data || []
  },

  async updatePayment(id: string, paymentData: any): Promise<Appointment> {
    const updates: any = {
      payment_status: paymentData.payment_status,
      payment_method: paymentData.payment_method,
      paid_amount: paymentData.paid_amount,
    }
    if (paymentData.payment_status === 'paid' || paymentData.payment_status === 'partial') {
      updates.payment_time = new Date().toISOString()
    }
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select('*, patient:patients!patient_id(*, user:user_id(full_name, email, phone)), doctor:doctors!doctor_id(*, user:users!user_id(full_name, email, phone))')
      .single()
    if (error) throw error
    return data as Appointment
  },

  async addAdditionalCharges(id: string, charges: { amount: number; description: string }): Promise<Appointment> {
    const { data: current } = await supabase
      .from('appointments')
      .select('additional_charges, additional_charges_details, consultation_fee')
      .eq('id', id)
      .single()
    
    if (!current) throw new Error('Appointment not found');

    const newCharges = (current.additional_charges || 0) + charges.amount
    const newDetails = [...(current.additional_charges_details || []), {
      ...charges,
      created_at: new Date().toISOString()
    }]
    const totalAmount = (current.consultation_fee || 0) + newCharges

    const { data, error } = await supabase
      .from('appointments')
      .update({
        additional_charges: newCharges,
        additional_charges_details: newDetails,
        total_amount: totalAmount
      })
      .eq('id', id)
      .select('*, patient:patients!patient_id(*, user:user_id(full_name, email, phone)), doctor:doctors!doctor_id(*, user:users!user_id(full_name, email, phone))')
      .single()
    if (error) throw error
    return data as Appointment
  },

  async calculateFee(doctorId: string, visitType: string, doctor: any): Promise<number> {
    let fee = 0
    const feeType = doctor?.fee_type || 'by_visit_type'
    
    if (feeType === 'by_visit_type') {
      switch (visitType) {
        case 'first_visit':
          fee = doctor?.first_visit_fee || 0
          break
        case 'follow_up':
          fee = doctor?.follow_up_fee || 0
          break
        case 'emergency':
          fee = doctor?.emergency_fee || 0
          break
        default:
          fee = doctor?.first_visit_fee || 0
      }
    } else if (feeType === 'fixed') {
      fee = doctor?.fixed_fee || 0
    }
    
    return fee
  },

  async getEarningsByDoctor(doctorId: string, startDate?: string, endDate?: string): Promise<any[]> {
    let query = supabase
      .from('appointments')
      .select('payment_status, consultation_fee, additional_charges, total_amount, paid_amount, scheduled_time, visit_type')
      .eq('doctor_id', doctorId)
      .in('payment_status', ['paid', 'partial'])
    
    if (startDate) query = query.gte('scheduled_time', startDate)
    if (endDate) query = query.lte('scheduled_time', endDate)
    
    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  subscribeToChanges(callback: (payload: any) => void) {
    if (currentChannel) {
      return { unsubscribe: () => {} }
    }
    currentChannel = supabase
      .channel('appointments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, callback)
      .subscribe()
    return { 
      unsubscribe: () => { 
        if (currentChannel) {
          supabase.removeChannel(currentChannel)
          currentChannel = null
        }
      } 
    }
  },
}

export default appointmentsService
