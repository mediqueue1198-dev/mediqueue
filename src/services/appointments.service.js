import supabase from '@/lib/supabase'

let currentChannel = null

export const appointmentsService = {
  async getAll(filters = {}) {
    let query = supabase
      .from('appointments')
      .select('*, patient:users!patient_id(*), doctor:doctors!doctor_id(*, user:users!user_id(full_name, email, phone))')
      .order('scheduled_time', { ascending: false })
    if (filters.patient_id) query = query.eq('patient_id', filters.patient_id)
    if (filters.doctor_id) query = query.eq('doctor_id', filters.doctor_id)
    if (filters.status) query = query.eq('status', filters.status)
    const { data, error } = await query
    if (error) throw error
    return data
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:users!patient_id(*), doctor:doctors!doctor_id(*, user:users!user_id(full_name, email, phone))')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  async create(appointmentData) {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select('*, patient:users!patient_id(*), doctor:doctors!doctor_id(*, user:users!user_id(full_name, email, phone))')
      .single()
    if (error) throw error
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async cancel(id) {
    return this.update(id, { status: 'cancelled' })
  },

  async approve(id) {
    // 1. Update appointment status
    const appointment = await this.update(id, { status: 'confirmed' })
    
    // 2. Create notification for patient
    try {
      await this.createNotification({
        user_id: appointment.patient_id,
        title: 'Appointment Confirmed',
        content: `Your appointment has been confirmed.`,
        type: 'appointment_confirmed',
      })
    } catch (err) {
      console.error('Failed to send confirmation notification:', err)
    }

    return appointment
  },

  async reject(id, reason = '') {
    const appointment = await this.update(id, { status: 'rejected', notes: reason })
    
    try {
      await this.createNotification({
        user_id: appointment.patient_id,
        title: 'Appointment Rejected',
        content: `Your appointment request has been rejected. ${reason}`,
        type: 'appointment_rejected',
      })
    } catch (err) {
      console.error('Failed to send rejection notification:', err)
    }

    return appointment
  },

  async createNotification(notificationData) {
    // Map type to valid DB enum values
    const typeMap = {
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

  async sendReminder(appointmentId) {
    const appointment = await this.getById(appointmentId)
    if (!appointment) throw new Error('Appointment not found')

    const apptDate = new Date(appointment.scheduled_time)
    const dateStr = apptDate.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
    const timeStr = apptDate.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })

    await this.createNotification({
      user_id: appointment.patient_id,
      title: 'Appointment Reminder',
      content: `Reminder: Your appointment with Dr. ${appointment.doctor?.user?.full_name || 'Medical Specialist'} is scheduled for ${dateStr} at ${timeStr}. Please check in when you arrive.`,
      type: 'appointment_reminder'
    })

    return { message: 'Reminder sent successfully' }
  },

  async getTodayAppointments(doctorId) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patient_id(*)')
      .eq('doctor_id', doctorId)
      .gte('scheduled_time', startOfDay.toISOString())
      .lte('scheduled_time', endOfDay.toISOString())
      .order('scheduled_time')
    if (error) throw error
    return data
  },

  /**
   * Fetch confirmed/pending appointments for a doctor on a specific date.
   * Used by the slot generator to mark already-booked slots as unavailable.
   */
  async getByDoctorAndDate(doctorId, dateStr) {
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

  async updatePayment(id, paymentData) {
    const updates = {
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
      .select('*, patient:users!patient_id(*), doctor:doctors!doctor_id(*, user:users!user_id(full_name, email, phone))')
      .single()
    if (error) throw error
    return data
  },

  async addAdditionalCharges(id, charges) {
    const { data: current } = await supabase
      .from('appointments')
      .select('additional_charges, additional_charges_details, consultation_fee')
      .eq('id', id)
      .single()
    
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
      .select('*, patient:users!patient_id(*), doctor:doctors!doctor_id(*, user:users!user_id(full_name, email, phone))')
      .single()
    if (error) throw error
    return data
  },

  async calculateFee(doctorId, visitType, doctor) {
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

  async getEarningsByDoctor(doctorId, startDate, endDate) {
    let query = supabase
      .from('appointments')
      .select('payment_status, consultation_fee, additional_charges, total_amount, paid_amount, scheduled_time, visit_type')
      .eq('doctor_id', doctorId)
      .in('payment_status', ['paid', 'partial'])
    
    if (startDate) query = query.gte('scheduled_time', startDate)
    if (endDate) query = query.lte('scheduled_time', endDate)
    
    const { data, error } = await query
    if (error) throw error
    return data
  },

  subscribeToChanges(callback) {
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
