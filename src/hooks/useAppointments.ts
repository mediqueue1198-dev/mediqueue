import { useEffect } from 'react'
import { useAppointmentStore } from '@/store/appointmentStore'
import { useAuth } from './useAuth'

export function useAppointments(filters: any = {}) {
  const { 
    appointments, isLoading, error, loadAppointments, 
    createAppointment, updateAppointment, cancelAppointment,
    approveAppointment, rejectAppointment 
  } = useAppointmentStore()
  const { user, profile, isDoctor, isPatient } = useAuth()

  useEffect(() => {
    if (!user) return
    const f = { ...filters }
    if (isPatient && !f.patient_id && profile?.patient_id) f.patient_id = profile.patient_id
    if (isDoctor && !f.doctor_id && profile?.doctor_id) f.doctor_id = profile.doctor_id
    
    loadAppointments(f)

    let subscription: any = null
    import('@/services/appointments.service').then(({ appointmentsService }) => {
      subscription = appointmentsService.subscribeToChanges(() => {
        loadAppointments(f)
      })
    })

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [user?.id, isDoctor, isPatient, profile?.doctor_id, filters.doctor_id, filters.patient_id, loadAppointments])


  const upcoming = appointments.filter(a =>
    a.status !== 'cancelled' &&
    a.status !== 'completed' &&
    new Date(a.scheduled_time) > new Date()
  )

  const past = appointments.filter(a =>
    a.status === 'completed' || new Date(a.scheduled_time) < new Date()
  )

  const today = appointments.filter(a => {
    const d = new Date(a.scheduled_time)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })

  return {
    appointments,
    upcoming,
    past,
    today,
    isLoading,
    error,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    approveAppointment,
    rejectAppointment,
  }
}

export default useAppointments
