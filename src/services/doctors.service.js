import supabase from '@/lib/supabase'
import { isUuid } from '@/utils/uuid'

export const doctorsService = {
  async getAll(filters = {}) {
    let query = supabase
      .from('doctors')
      .select('*, user:user_id(full_name, email, phone), name')
    if (filters.specialization) query = query.eq('specialization', filters.specialization)
    if (filters.is_available !== undefined) query = query.eq('is_available', filters.is_available)
    if (filters.ids) query = query.in('id', filters.ids)
    const { data, error } = await query
    if (error) throw error
    
    if (data && data.length > 0) {
      const needsFallback = data.some(d => !d.user || !d.user.full_name)
      if (needsFallback) {
        const userIds = [...new Set(data.map(d => d.user_id).filter(Boolean))]
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, full_name, email, phone')
            .in('id', userIds)
          if (users) {
            const userMap = new Map(users.map(u => [u.id, u]))
            return data.map(d => {
              const user = userMap.get(d.user_id)
              return {
                ...d,
                user: user || { full_name: d.name || 'Doctor' }
              }
            })
          }
        }
      }
      // Even if fallback not needed, ensure name is in user object for consistency
      return data.map(d => ({
        ...d,
        user: d.user || { full_name: d.name || 'Doctor' }
      }))
    }
    return data
  },

  async getById(id) {
    if (!isUuid(id)) return null
    const { data, error } = await supabase
      .from('doctors')
      .select('*, user:user_id(full_name, email, phone), name')
      .eq('id', id)
      .single()
    if (error) throw error
    
    if (data) {
      if (!data.user || !data.user.full_name) {
        const { data: user } = await supabase
          .from('users')
          .select('id, full_name, email, phone')
          .eq('id', data.user_id)
          .single()
        if (user) {
          return { ...data, user }
        }
        // Fallback to name column
        return { ...data, user: { full_name: data.name || 'Doctor' } }
      }
    }
    return data
  },

  async getByUserId(userId) {
    if (!isUuid(userId)) return null
    const { data, error } = await supabase
      .from('doctors')
      .select('*, user:user_id(full_name, email, phone), name')
      .eq('user_id', userId)
      .single()
    if (error) throw error
    
    if (data) {
      if (!data.user || !data.user.full_name) {
        const { data: user } = await supabase
          .from('users')
          .select('id, full_name, email, phone')
          .eq('id', data.user_id)
          .single()
        if (user) {
          return { ...data, user }
        }
        // Fallback to name column
        return { ...data, user: { full_name: data.name || 'Doctor' } }
      }
    }
    return data
  },

  async getSpecializations() {
    const { data, error } = await supabase
      .from('doctors')
      .select('specialization')
    if (error) throw error
    return [...new Set(data.map(d => d.specialization))]
  },

  async update(id, updates) {
    // Also update name if full_name is being changed
    if (updates.name) {
      const { data, error } = await supabase
        .from('doctors')
        .update(updates)
        .eq('id', id)
        .select('*, user:user_id(full_name, email, phone), name')
        .single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from('doctors')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async setAvailability(doctorId, isAvailable) {
    return this.update(doctorId, { is_available: isAvailable })
  },

  async updateFeeConfiguration(doctorId, feeConfig) {
    const updates = {
      fee_type: feeConfig.fee_type,
      first_visit_fee: feeConfig.first_visit_fee || 0,
      follow_up_fee: feeConfig.follow_up_fee || 0,
      emergency_fee: feeConfig.emergency_fee || 0,
      fixed_fee: feeConfig.fixed_fee || 0,
    }
    const { data, error } = await supabase
      .from('doctors')
      .update(updates)
      .eq('id', doctorId)
      .select('*, user:user_id(full_name, email, phone), name')
      .single()
    if (error) throw error
    return data
  },

  async getFeeConfiguration(doctorId) {
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