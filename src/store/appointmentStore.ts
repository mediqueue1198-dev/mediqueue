import { create } from 'zustand'
import appointmentsService from '@/services/appointments.service'
import { isUuid } from '@/utils/uuid'
import { AppointmentState } from '../types/appointmentStore'
import { Appointment } from '../types/appointments'

export const useAppointmentStore = create<AppointmentState>()((set, get) => ({
  appointments: [],
  isLoading: false,
  error: null,

  loadAppointments: async (filters: any = {}) => {
    set({ isLoading: true, error: null })
    try {
      const { supabase } = await import('@/lib/supabase')
      let query = supabase
        .from('appointments')
        .select('*, patient:patients!patient_id(*, user:user_id(full_name, phone, email)), doctor:doctors!doctor_id(*, user:users!user_id(full_name)), family_member:family_members(name, relationship)')
        .order('scheduled_time', { ascending: false })

      if (filters.patient_id && isUuid(filters.patient_id)) query = query.eq('patient_id', filters.patient_id)
      if (filters.doctor_id && isUuid(filters.doctor_id)) query = query.eq('doctor_id', filters.doctor_id)
      if (filters.status) query = query.eq('status', filters.status)

      const { data, error } = await query
      if (error) throw error
      set({ appointments: (data as Appointment[]) || [], isLoading: false })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  createAppointment: async (appointmentData: any) => {
    set({ isLoading: true, error: null })
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select('*, patient:patients!patient_id(*, user:user_id(full_name, phone, email)), doctor:doctors!doctor_id(*, user:users!user_id(full_name)), family_member:family_members(name, relationship)')
        .single()
      if (error) throw error
      
      const newAppt = data as Appointment;
      set(state => ({
        appointments: [newAppt, ...state.appointments],
        isLoading: false,
      }))
      return newAppt
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  updateAppointment: async (id: string, updates: any) => {
    try {
      const { supabase } = await import('@/lib/supabase')
      await supabase.from('appointments').update(updates).eq('id', id)
      set(state => ({
        appointments: state.appointments.map(a => a.id === id ? { ...a, ...updates } : a),
      }))
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  approveAppointment: async (id: string) => {
    try {
      const updated = await appointmentsService.approve(id)
      set(state => ({
        appointments: state.appointments.map(a => a.id === id ? { ...a, ...updated } : a),
      }))
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  rejectAppointment: async (id: string, reason: string) => {
    try {
      const updated = await appointmentsService.reject(id, reason)
      set(state => ({
        appointments: state.appointments.map(a => a.id === id ? { ...a, ...updated } : a),
      }))
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  cancelAppointment: async (id: string) => {
    await get().updateAppointment(id, { status: 'cancelled' })
  },

  reset: () => set({ appointments: [], isLoading: false, error: null }),
}))
