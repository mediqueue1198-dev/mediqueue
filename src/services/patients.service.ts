import supabase from '@/lib/supabase'
import { Patient, FamilyMember, MedicalRecord } from '../types/patients'

export const patientsService = {
  async getAll(filters: { ids?: string[]; userIds?: string[] } = {}): Promise<Patient[]> {
    let query = supabase
      .from('patients')
      .select('*, user:user_id(id, full_name, email, phone, role), name')
    
    if (filters.ids) query = query.in('id', filters.ids)
    if (filters.userIds) query = query.in('user_id', filters.userIds)
    
    const { data, error } = await query
    if (error) throw error
    
    const patients = data as Patient[]
    if (patients && patients.length > 0) {
      const needsFallback = patients.some(p => !p.user || !p.user.full_name)
      if (needsFallback) {
        const userIds = [...new Set(patients.map(p => p.user_id).filter(Boolean))]
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, full_name, email, phone, role')
            .in('id', userIds)
          
          if (users) {
            const userMap = new Map((users as any[]).map(u => [u.id, u]))
            return patients.map(p => {
              const user = userMap.get(p.user_id)
              return {
                ...p,
                user: user || { id: p.user_id, full_name: p.name || 'Patient', email: '', phone: null, role: 'patient' }
              }
            })
          }
        }
      }
      return patients.map(p => ({
        ...p,
        user: p.user || { id: p.user_id, full_name: p.name || 'Patient', email: '', phone: null, role: 'patient' }
      }))
    }
    return patients || []
  },

  async getById(id: string): Promise<Patient | null> {
    const { data, error } = await supabase
      .from('patients')
      .select('*, user:user_id(id, full_name, email, phone, role), name')
      .eq('id', id)
      .single()
    if (error) throw error
    
    const patient = data as Patient
    if (patient) {
      if (!patient.user || !patient.user.full_name) {
        const { data: user } = await supabase
          .from('users')
          .select('id, full_name, email, phone, role')
          .eq('id', patient.user_id)
          .single()
        if (user) {
          return { ...patient, user: (user as any) }
        }
        return { ...patient, user: { id: patient.user_id, full_name: patient.name || 'Patient', email: '', phone: null, role: 'patient' } }
      }
    }
    return patient
  },

  async getByUserId(userId: string): Promise<Patient | null> {
    const { data, error } = await supabase
      .from('patients')
      .select('*, user:user_id(id, full_name, email, phone, role), name')
      .eq('user_id', userId)
      .single()
    if (error) throw error
    
    const patient = data as Patient
    if (patient) {
      if (!patient.user || !patient.user.full_name) {
        const { data: user } = await supabase
          .from('users')
          .select('id, full_name, email, phone, role')
          .eq('id', patient.user_id)
          .single()
        if (user) {
          return { ...patient, user: (user as any) }
        }
        return { ...patient, user: { id: patient.user_id, full_name: patient.name || 'Patient', email: '', phone: null, role: 'patient' } }
      }
    }
    return patient
  },

  async update(id: string, updates: Partial<Patient>): Promise<Patient> {
    const { data, error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', id)
      .select('*, user:user_id(id, full_name, email, phone, role), name')
      .single()
    if (error) throw error
    return data as Patient
  },

  async getMedicalRecords(patientId: string): Promise<MedicalRecord[]> {
    const { data, error } = await supabase
      .from('medical_records')
      .select('*, doctor:doctor_id(*, user:users!user_id(full_name))')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as MedicalRecord[]
  },

  async addMedicalRecord(record: Partial<MedicalRecord>): Promise<MedicalRecord> {
    const { data, error } = await supabase
      .from('medical_records')
      .insert(record)
      .select('*, doctor:doctor_id(*)')
      .single()
    if (error) throw error
    return data as MedicalRecord
  },

  async getFamilyMembers(userId: string): Promise<FamilyMember[]> {
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', userId)
      .single()
    
    if (!patient) return []

    const { data, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('patient_id', (patient as any).id)
    
    if (error) throw error
    return data as FamilyMember[]
  },

  async addFamilyMember(member: Partial<FamilyMember>): Promise<FamilyMember> {
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', member.patient_id!)
      .single()
    
    if (!patient) throw new Error('Patient record not found for this user')

    const dbMember = { ...member, patient_id: (patient as any).id }

    const { data, error } = await supabase
      .from('family_members')
      .insert(dbMember)
      .select()
      .single()
    
    if (error) throw error
    return data as FamilyMember
  },

  async updateFamilyMember(id: string, updates: Partial<FamilyMember>): Promise<FamilyMember> {
    const { data, error } = await supabase
      .from('family_members')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as FamilyMember
  },

  async deleteFamilyMember(id: string): Promise<void> {
    const { error } = await supabase
      .from('family_members')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}

export default patientsService
