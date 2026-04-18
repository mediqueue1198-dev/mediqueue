import supabase from '@/lib/supabase'
import { isUuid } from '@/utils/uuid'
import { Doctor } from '../types/queue'

export const doctorsService = {
  async getAll(filters: { specialization?: string; is_available?: boolean; ids?: string[] } = {}): Promise<Doctor[]> {
    let query = supabase
      .from('doctors')
      .select('*, user:user_id(full_name, email, phone), name')
    
    if (filters.specialization) query = query.eq('specialization', filters.specialization)
    if (filters.is_available !== undefined) query = query.eq('is_available', filters.is_available)
    if (filters.ids) query = query.in('id', filters.ids)
    
    const { data, error } = await query
    if (error) throw error
    
    const doctors = data as Doctor[]
    if (doctors && doctors.length > 0) {
      const needsFallback = doctors.some(d => !d.user || !d.user.full_name)
      if (needsFallback) {
        const userIds = [...new Set(doctors.map(d => d.user_id).filter(Boolean))]
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, full_name, email, phone')
            .in('id', userIds)
          
          if (users) {
            const userMap = new Map((users as any[]).map(u => [u.id, u]))
            return doctors.map(d => {
              const user = userMap.get(d.user_id)
              return {
                ...d,
                user: user || { full_name: d.name || 'Doctor' }
              }
            })
          }
        }
      }
      return doctors.map(d => ({
        ...d,
        user: d.user || { full_name: d.name || 'Doctor' }
      }))
    }
    return doctors || []
  },

  async getById(id: string): Promise<Doctor | null> {
    if (!isUuid(id)) return null
    const { data, error } = await supabase
      .from('doctors')
      .select('*, user:user_id(full_name, email, phone), name')
      .eq('id', id)
      .single()
    if (error) throw error
    
    const doctor = data as Doctor
    if (doctor) {
      if (!doctor.user || !doctor.user.full_name) {
        const { data: user } = await supabase
          .from('users')
          .select('id, full_name, email, phone')
          .eq('id', doctor.user_id)
          .single()
        if (user) {
          return { ...doctor, user: (user as any) }
        }
        return { ...doctor, user: { full_name: doctor.name || 'Doctor', email: '', phone: null } }
      }
    }
    return doctor
  },

  async getByUserId(userId: string): Promise<Doctor | null> {
    if (!isUuid(userId)) return null
    const { data, error } = await supabase
      .from('doctors')
      .select('*, user:user_id(full_name, email, phone), name')
      .eq('user_id', userId)
      .single()
    if (error) throw error
    
    const doctor = data as Doctor
    if (doctor) {
      if (!doctor.user || !doctor.user.full_name) {
        const { data: user } = await supabase
          .from('users')
          .select('id, full_name, email, phone')
          .eq('id', doctor.user_id)
          .single()
        if (user) {
          return { ...doctor, user: (user as any) }
        }
        return { ...doctor, user: { full_name: doctor.name || 'Doctor', email: '', phone: null } }
      }
    }
    return doctor
  },

  async getSpecializations(): Promise<string[]> {
    const { data, error } = await supabase
      .from('doctors')
      .select('specialization')
    if (error) throw error
    return [...new Set((data as any[]).map(d => d.specialization))]
  },

  async update(id: string, updates: Partial<Doctor>): Promise<Doctor> {
    const { data, error } = await supabase
      .from('doctors')
      .update(updates)
      .eq('id', id)
      .select('*, user:user_id(full_name, email, phone), name')
      .single()
    if (error) throw error
    return data as Doctor
  },

  async setAvailability(doctorId: string, isAvailable: boolean): Promise<Doctor> {
    return this.update(doctorId, { is_available: isAvailable })
  },

  async updateFeeConfiguration(doctorId: string, feeConfig: any): Promise<Doctor> {
    const updates = {
      fee_type: feeConfig.fee_type,
      first_visit_fee: feeConfig.first_visit_fee || 0,
      follow_up_fee: feeConfig.follow_up_fee || 0,
      emergency_fee: feeConfig.emergency_fee || 0,
      fixed_fee: feeConfig.fixed_fee || 0,
    }
    return this.update(doctorId, updates)
  },

  async getFeeConfiguration(doctorId: string): Promise<any> {
    const { data, error } = await supabase
      .from('doctors')
      .select('fee_type, first_visit_fee, follow_up_fee, emergency_fee, fixed_fee')
      .eq('id', doctorId)
      .single()
    if (error) throw error
    return data
  },
}

export default doctorsService
