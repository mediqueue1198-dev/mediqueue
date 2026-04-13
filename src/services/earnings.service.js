import supabase from '@/lib/supabase'

export const earningsService = {
  async getTodayEarnings(doctorId) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('appointments')
      .select('payment_status, consultation_fee, additional_charges, total_amount, paid_amount')
      .eq('doctor_id', doctorId)
      .eq('payment_status', 'paid')
      .gte('scheduled_time', startOfDay.toISOString())
      .lte('scheduled_time', endOfDay.toISOString())
    
    if (error) throw error
    
    const total = data?.reduce((sum, appt) => sum + (appt.paid_amount || appt.total_amount || 0), 0) || 0
    const consultationFee = data?.reduce((sum, appt) => sum + (appt.consultation_fee || 0), 0) || 0
    const additionalCharges = data?.reduce((sum, appt) => sum + (appt.additional_charges || 0), 0) || 0
    
    return {
      total,
      consultationFee,
      additionalCharges,
      patientCount: data?.length || 0
    }
  },

  async getWeeklyEarnings(doctorId) {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - 6)
    startOfWeek.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('appointments')
      .select('scheduled_time, payment_status, consultation_fee, additional_charges, total_amount, paid_amount')
      .eq('doctor_id', doctorId)
      .eq('payment_status', 'paid')
      .gte('scheduled_time', startOfWeek.toISOString())
      .lte('scheduled_time', today.toISOString())
    
    if (error) throw error

    const dailyEarnings = {}
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      const dateKey = date.toISOString().split('T')[0]
      dailyEarnings[dateKey] = { total: 0, count: 0 }
    }

    data?.forEach(appt => {
      const dateKey = new Date(appt.scheduled_time).toISOString().split('T')[0]
      if (dailyEarnings[dateKey]) {
        dailyEarnings[dateKey].total += appt.paid_amount || appt.total_amount || 0
        dailyEarnings[dateKey].count += 1
      }
    })

    return dailyEarnings
  },

  async getMonthlyEarnings(doctorId) {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    const { data, error } = await supabase
      .from('appointments')
      .select('scheduled_time, payment_status, consultation_fee, additional_charges, total_amount, paid_amount')
      .eq('doctor_id', doctorId)
      .eq('payment_status', 'paid')
      .gte('scheduled_time', startOfMonth.toISOString())
      .lte('scheduled_time', today.toISOString())
    
    if (error) throw error

    const total = data?.reduce((sum, appt) => sum + (appt.paid_amount || appt.total_amount || 0), 0) || 0
    const consultationFee = data?.reduce((sum, appt) => sum + (appt.consultation_fee || 0), 0) || 0
    const additionalCharges = data?.reduce((sum, appt) => sum + (appt.additional_charges || 0), 0) || 0
    const patientCount = data?.length || 0

    const dailyEarnings = {}
    data?.forEach(appt => {
      const dateKey = new Date(appt.scheduled_time).toISOString().split('T')[0]
      if (!dailyEarnings[dateKey]) {
        dailyEarnings[dateKey] = { total: 0, count: 0 }
      }
      dailyEarnings[dateKey].total += appt.paid_amount || appt.total_amount || 0
      dailyEarnings[dateKey].count += 1
    })

    return {
      total,
      consultationFee,
      additionalCharges,
      patientCount,
      dailyEarnings
    }
  },

  async getEarningsByVisitType(doctorId, startDate, endDate) {
    let query = supabase
      .from('appointments')
      .select('visit_type, payment_status, consultation_fee, additional_charges, total_amount, paid_amount')
      .eq('doctor_id', doctorId)
      .eq('payment_status', 'paid')
    
    if (startDate) query = query.gte('scheduled_time', startDate)
    if (endDate) query = query.lte('scheduled_time', endDate)

    const { data, error } = await query
    if (error) throw error

    const byVisitType = {
      first_visit: { total: 0, count: 0 },
      follow_up: { total: 0, count: 0 },
      emergency: { total: 0, count: 0 }
    }

    data?.forEach(appt => {
      const type = appt.visit_type || 'first_visit'
      if (byVisitType[type]) {
        byVisitType[type].total += appt.paid_amount || appt.total_amount || 0
        byVisitType[type].count += 1
      }
    })

    return byVisitType
  },

  async getPaymentStatusBreakdown(doctorId, startDate, endDate) {
    let query = supabase
      .from('appointments')
      .select('payment_status, consultation_fee, additional_charges, total_amount, paid_amount')
      .eq('doctor_id', doctorId)
    
    if (startDate) query = query.gte('scheduled_time', startDate)
    if (endDate) query = query.lte('scheduled_time', endDate)

    const { data, error } = await query
    if (error) throw error

    const breakdown = {
      paid: { total: 0, count: 0 },
      pending: { total: 0, count: 0 },
      partial: { total: 0, count: 0 },
      waived: { total: 0, count: 0 }
    }

    data?.forEach(appt => {
      const status = appt.payment_status || 'pending'
      if (breakdown[status]) {
        breakdown[status].total += appt.total_amount || 0
        breakdown[status].count += 1
      }
    })

    return breakdown
  },

  async getTodayAppointmentsWithPayments(doctorId) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:users!patient_id(*)')
      .eq('doctor_id', doctorId)
      .gte('scheduled_time', startOfDay.toISOString())
      .lte('scheduled_time', endOfDay.toISOString())
      .order('scheduled_time')
    
    if (error) throw error
    return data
  }
}

export default earningsService