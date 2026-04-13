import supabase from '@/lib/supabase'

export const patientsService = {
  async getAll(filters = {}) {
    let query = supabase
      .from('patients')
      .select('*, user:user_id(id, full_name, email, phone, role), name')
    if (filters.ids) query = query.in('id', filters.ids)
    if (filters.userIds) query = query.in('user_id', filters.userIds)
    const { data, error } = await query
    if (error) throw error
    
    if (data && data.length > 0) {
      const needsFallback = data.some(p => !p.user || !p.user.full_name)
      if (needsFallback) {
        const userIds = [...new Set(data.map(p => p.user_id).filter(Boolean))]
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, full_name, email, phone, role')
            .in('id', userIds)
          if (users) {
            const userMap = new Map(users.map(u => [u.id, u]))
            return data.map(p => {
              const user = userMap.get(p.user_id)
              return {
                ...p,
                user: user || { full_name: p.name || 'Patient' }
              }
            })
          }
        }
      }
      // Even if fallback not needed, ensure name is in user object for consistency
      return data.map(p => ({
        ...p,
        user: p.user || { full_name: p.name || 'Patient' }
      }))
    }
    return data
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('patients')
      .select('*, user:user_id(id, full_name, email, phone, role), name')
      .eq('id', id)
      .single()
    if (error) throw error
    
    if (data) {
      if (!data.user || !data.user.full_name) {
        const { data: user } = await supabase
          .from('users')
          .select('id, full_name, email, phone, role')
          .eq('id', data.user_id)
          .single()
        if (user) {
          return { ...data, user }
        }
        // Fallback to name column
        return { ...data, user: { full_name: data.name || 'Patient' } }
      }
    }
    return data
  },

  async getByUserId(userId) {
    const { data, error } = await supabase
      .from('patients')
      .select('*, user:user_id(id, full_name, email, phone, role), name')
      .eq('user_id', userId)
      .single()
    if (error) throw error
    
    if (data) {
      if (!data.user || !data.user.full_name) {
        const { data: user } = await supabase
          .from('users')
          .select('id, full_name, email, phone, role')
          .eq('id', data.user_id)
          .single()
        if (user) {
          return { ...data, user }
        }
        // Fallback to name column
        return { ...data, user: { full_name: data.name || 'Patient' } }
      }
    }
    return data
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', id)
      .select('*, user:user_id(id, full_name, email, phone, role), name')
      .single()
    if (error) throw error
    return data
  },

  async getMedicalRecords(patientId) {
    const { data, error } = await supabase
      .from('medical_records')
      .select('*, doctor:doctor_id(*, user:users!user_id(full_name))')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async addMedicalRecord(record) {
    const { data, error } = await supabase
      .from('medical_records')
      .insert(record)
      .select('*, doctor:doctor_id(*)')
      .single()
    if (error) throw error
    return data
  },

  async getFamilyMembers(userId) {
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single()
    
    if (!patient) return []

    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('patient_id', patient.id)
    
    if (error) throw error
    return data
  },

  async addFamilyMember(member) {
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', member.patient_id)
      .single()
    
    if (!patient) throw new Error('Patient record not found for this user')

    const dbMember = { ...member, patient_id: patient.id }

    const { data, error } = await supabase
      .from('family_members')
      .insert(dbMember)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async updateFamilyMember(id, updates) {
    const { data, error } = await supabase
      .from('family_members')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteFamilyMember(id) {
    const { error } = await supabase
      .from('family_members')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}

export default patientsService