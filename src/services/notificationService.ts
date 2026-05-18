import supabase from '@/lib/supabase'
import { NotificationType } from '../types/notifications'

export const NOTIFICATION_TYPES: Record<string, NotificationType> = {
  APPOINTMENT_BOOKED: 'APPOINTMENT_BOOKED',
  TOKEN_GENERATED: 'TOKEN_GENERATED',
  WAIT_TIME_UPDATED: 'WAIT_TIME_UPDATED',
  QUEUE_UPDATED: 'QUEUE_UPDATED',
  REMINDER: 'REMINDER',
  CONSULTATION_START: 'CONSULTATION_START',
  PATIENT_CALLED: 'PATIENT_CALLED',
  NO_SHOW_WARNING: 'NO_SHOW_WARNING',
  CAPACITY_REACHED: 'CAPACITY_REACHED',
  RESCHEDULE_AVAILABLE: 'RESCHEDULE_AVAILABLE',
  CONSULTATION_NEAR: 'CONSULTATION_NEAR',
}

interface NotificationMessage {
  title: string;
  getMessage: (data: any) => string;
}

export const NOTIFICATION_MESSAGES: Record<NotificationType, NotificationMessage> = {
  [NOTIFICATION_TYPES.APPOINTMENT_BOOKED]: {
    title: 'Appointment Booked',
    getMessage: () => `Your appointment has been booked successfully.`,
  },
  [NOTIFICATION_TYPES.TOKEN_GENERATED]: {
    title: 'Token Generated',
    getMessage: (data) => `Token ${data.token} has been generated.`,
  },
  [NOTIFICATION_TYPES.WAIT_TIME_UPDATED]: {
    title: 'Wait Time Updated',
    getMessage: () => `Your expected consultation time has changed.`,
  },
  [NOTIFICATION_TYPES.QUEUE_UPDATED]: {
    title: 'Queue Updated',
    getMessage: (data) => `Queue position updated. You are now #${data.position}.`,
  },
  [NOTIFICATION_TYPES.REMINDER]: {
    title: 'Reminder',
    getMessage: () => `Your consultation will start soon. Please stay nearby.`,
  },
  [NOTIFICATION_TYPES.CONSULTATION_START]: {
    title: 'Consultation Starting',
    getMessage: () => `Your consultation is starting. Please meet the doctor.`,
  },
  [NOTIFICATION_TYPES.PATIENT_CALLED]: {
    title: 'Patient Called',
    getMessage: (data) => `Token ${data.token} called. Please proceed to consultation room.`,
  },
  [NOTIFICATION_TYPES.NO_SHOW_WARNING]: {
    title: 'Missed Consultation',
    getMessage: () => `You did not arrive in time. Please reschedule your appointment.`,
  },
  [NOTIFICATION_TYPES.CAPACITY_REACHED]: {
    title: 'Capacity Warning',
    getMessage: () => `Doctor may not be able to attend all patients today. Please reschedule if possible.`,
  },
  [NOTIFICATION_TYPES.RESCHEDULE_AVAILABLE]: {
    title: 'Reschedule Available',
    getMessage: () => `You can reschedule your appointment to a different time.`,
  },
  [NOTIFICATION_TYPES.CONSULTATION_NEAR]: {
    title: 'Coming Soon',
    getMessage: () => `Your consultation is coming soon. Please stay nearby.`,
  },
}

export const notificationService = {
  _toDbType(type: NotificationType): string {
    const map: Record<NotificationType, string> = {
      APPOINTMENT_BOOKED: 'appointment',
      TOKEN_GENERATED: 'queue',
      WAIT_TIME_UPDATED: 'queue',
      QUEUE_UPDATED: 'queue',
      REMINDER: 'appointment',
      CONSULTATION_START: 'queue',
      PATIENT_CALLED: 'queue',
      NO_SHOW_WARNING: 'queue',
      CAPACITY_REACHED: 'queue',
      RESCHEDULE_AVAILABLE: 'appointment',
      CONSULTATION_NEAR: 'queue',
    }
    return map[type] || 'system'
  },

  async sendNotification(userId: string | null, userRole: string, type: NotificationType, message?: string | null, metadata: any = {}) {
    if (!userId) {
      console.log(`[NotificationService] Skipping in-app notification for guest (role: ${userRole}, type: ${type})`);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          user_role: userRole,
          title: NOTIFICATION_MESSAGES[type]?.title || 'Notification',
          message: message || NOTIFICATION_MESSAGES[type]?.getMessage(metadata) || '',
          type: this._toDbType(type),
          metadata: metadata,
          is_read: false,
        })
        .select()
        .single()

      if (error) {
        console.error('[NotificationService] Failed to send notification:', error);
        return null;
      }
      return data
    } catch (err) {
      console.error('[NotificationService] Unexpected error sending notification:', err);
      return null;
    }
  },

  async sendToPatient(patientId: string, type: NotificationType, message?: string | null, metadata: any = {}) {
    return this.sendNotification(patientId, 'patient', type, message, metadata)
  },

  async sendToDoctor(doctorUserId: string, type: NotificationType, message?: string | null, metadata: any = {}) {
    return this.sendNotification(doctorUserId, 'doctor', type, message, metadata)
  },

  async sendPatientCalledNotification(patientId: string, token: string, doctorName: string) {
    return this.sendToPatient(patientId, NOTIFICATION_TYPES.PATIENT_CALLED, null, { token, doctorName })
  },

  async sendTokenGeneratedNotification(patientId: string, token: string, doctorName: string) {
    return this.sendToPatient(patientId, NOTIFICATION_TYPES.TOKEN_GENERATED, null, { token, doctorName })
  },

  async sendCapacityWarningNotification(patientId: string, doctorName: string) {
    return this.sendToPatient(patientId, NOTIFICATION_TYPES.CAPACITY_REACHED, null, { doctorName })
  },

  async getUserNotifications(userId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  async getUnreadNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (error) throw error
  },

  async deleteNotification(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) throw error
  },

  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
  },

  subscribeToNotifications(userId: string, callback: (payload: any) => void) {
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()

    return {
      unsubscribe: () => supabase.removeChannel(channel),
    }
  },

  async recordConsultation(doctorId: string, patientId: string | null, queueEntryId: string, startedAt: string, endedAt: string) {
    const durationMinutes = Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / (1000 * 60)
    )

    const { data, error } = await supabase
      .from('consultation_history')
      .insert({
        doctor_id: doctorId,
        patient_id: patientId,
        queue_entry_id: queueEntryId,
        duration_minutes: durationMinutes,
        started_at: startedAt,
        ended_at: endedAt,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to record consultation:', error)
      throw error
    }
    return data
  },

  async getDoctorAvgConsultationTime(doctorId: string, days: number = 7) {
    const { data, error } = await supabase.rpc('get_doctor_avg_consultation_time', {
      p_doctor_id: doctorId,
      p_days: days,
    })

    if (error) {
      console.error('Failed to get avg consultation time:', error)
      return 15
    }
    return data || 15
  },

  async handleNoShow(entryId: string) {
    const { data, error } = await supabase.rpc('handle_patient_no_show', {
      p_entry_id: entryId,
    })
    if (error) throw error
    return data
  },

  async notifyConsultationNear(doctorId: string, threshold: number = 3) {
    const { error } = await supabase.rpc('notify_consultation_near', {
      p_doctor_id: doctorId,
      p_threshold: threshold,
    })
    if (error) throw error
  },

  async checkDoctorCapacity(doctorId: string) {
    const { data, error } = await supabase.rpc('check_doctor_capacity', {
      p_doctor_id: doctorId,
    })
    if (error) throw error
    return data
  },
}

export default notificationService
