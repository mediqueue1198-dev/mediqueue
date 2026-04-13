import { create } from 'zustand'
import { appointmentsService } from '@/services/appointments.service'
import { isUuid } from '@/utils/uuid'

export const useAppointmentStore = create((set, get) => ({
  appointments: [],
  isLoading: false,
  error: null,

  loadAppointments: async (filters = {}) => {
    set({ isLoading: true, error: null })
    try {
      const { supabase } = await import('@/lib/supabase')
      let query = supabase
        .from('appointments')
        .select('*, patient:users!patient_id(full_name, phone, email), doctor:doctors!doctor_id(*, user:users!user_id(full_name)), family_member:family_members(name, relationship)')
        .order('scheduled_time', { ascending: false })

      if (filters.patient_id && isUuid(filters.patient_id)) query = query.eq('patient_id', filters.patient_id)
      if (filters.doctor_id && isUuid(filters.doctor_id)) query = query.eq('doctor_id', filters.doctor_id)
      if (filters.status) query = query.eq('status', filters.status)

      const { data, error } = await query
      if (error) throw error
      set({ appointments: data || [], isLoading: false })
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },

  createAppointment: async (appointmentData) => {
    set({ isLoading: true, error: null })
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select('*, patient:users!patient_id(full_name, phone, email), doctor:doctors!doctor_id(*, user:users!user_id(full_name)), family_member:family_members(name, relationship)')
        .single()
      if (error) throw error
      set(state => ({
        appointments: [data, ...state.appointments],
        isLoading: false,
      }))
      return data
    } catch (err) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  updateAppointment: async (id, updates) => {
    try {
      const { supabase } = await import('@/lib/supabase')
      await supabase.from('appointments').update(updates).eq('id', id)
      set(state => ({
        appointments: state.appointments.map(a => a.id === id ? { ...a, ...updates } : a),
      }))
    } catch (err) {
      set({ error: err.message })
      throw err
    }
  },

  approveAppointment: async (id) => {
    try {
      const updated = await appointmentsService.approve(id)
      set(state => ({
        appointments: state.appointments.map(a => a.id === id ? { ...a, ...updated } : a),
      }))
    } catch (err) {
      set({ error: err.message })
      throw err
    }
  },

  rejectAppointment: async (id, reason) => {
    try {
      const updated = await appointmentsService.reject(id, reason)
      set(state => ({
        appointments: state.appointments.map(a => a.id === id ? { ...a, ...updated } : a),
      }))
    } catch (err) {
      set({ error: err.message })
      throw err
    }
  },

  cancelAppointment: async (id) => {
    await get().updateAppointment(id, { status: 'cancelled' })
  },

  reset: () => set({ appointments: [], isLoading: false, error: null }),
}))
