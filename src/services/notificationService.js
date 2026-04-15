import supabase from '@/lib/supabase'

export const NOTIFICATION_TYPES = {
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

export const NOTIFICATION_MESSAGES = {
  [NOTIFICATION_TYPES.APPOINTMENT_BOOKED]: {
    title: 'Appointment Booked',
    getMessage: (data) => `Your appointment has been booked successfully.`,
  },
  [NOTIFICATION_TYPES.TOKEN_GENERATED]: {
    title: 'Token Generated',
    getMessage: (data) => `Token ${data.token} has been generated.`,
  },
  [NOTIFICATION_TYPES.WAIT_TIME_UPDATED]: {
    title: 'Wait Time Updated',
    getMessage: (data) => `Your expected consultation time has changed.`,
  },
  [NOTIFICATION_TYPES.QUEUE_UPDATED]: {
    title: 'Queue Updated',
    getMessage: (data) => `Queue position updated. You are now #${data.position}.`,
  },
  [NOTIFICATION_TYPES.REMINDER]: {
    title: 'Reminder',
    getMessage: (data) => `Your consultation will start soon. Please stay nearby.`,
  },
  [NOTIFICATION_TYPES.CONSULTATION_START]: {
    title: 'Consultation Starting',
    getMessage: (data) => `Your consultation is starting. Please meet the doctor.`,
  },
  [NOTIFICATION_TYPES.PATIENT_CALLED]: {
    title: 'Patient Called',
    getMessage: (data) => `Token ${data.token} called. Please proceed to consultation room.`,
  },
  [NOTIFICATION_TYPES.NO_SHOW_WARNING]: {
    title: 'Missed Consultation',
    getMessage: (data) => `You did not arrive in time. Please reschedule your appointment.`,
  },
  [NOTIFICATION_TYPES.CAPACITY_REACHED]: {
    title: 'Capacity Warning',
    getMessage: (data) => `Doctor may not be able to attend all patients today. Please reschedule if possible.`,
  },
  [NOTIFICATION_TYPES.RESCHEDULE_AVAILABLE]: {
    title: 'Reschedule Available',
    getMessage: (data) => `You can reschedule your appointment to a different time.`,
  },
  [NOTIFICATION_TYPES.CONSULTATION_NEAR]: {
    title: 'Coming Soon',
    getMessage: (data) => `Your consultation is coming soon. Please stay nearby.`,
  },
}

export const notificationService = {
  // Maps app-level notification types to valid DB type enum values
  _toDbType(type) {
    const map = {
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

  async sendNotification(userId, userRole, type, message, metadata = {}) {
    // Guest/Walk-in patients don't have a registered user_id. 
    // Skip in-app notification if no userId is provided.
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
        // If it's an RLS error or similar, log it but don't crash the workflow
        console.error('[NotificationService] Failed to send notification (likely RLS or constraint):', error);
        return null;
      }
      return data
    } catch (err) {
      console.error('[NotificationService] Unexpected error sending notification:', err);
      return null;
    }
  },

  async sendToPatient(patientId, type, message, metadata = {}) {
    return this.sendNotification(patientId, 'patient', type, message, metadata)
  },

  async sendToDoctor(doctorUserId, type, message, metadata = {}) {
    return this.sendNotification(doctorUserId, 'doctor', type, message, metadata)
  },

  async sendToMediator(mediatorUserId, type, message, metadata = {}) {
    return this.sendNotification(mediatorUserId, 'mediator', type, message, metadata)
  },

  async getUserNotifications(userId, limit = 50) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  async getUnreadNotifications(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async markAsRead(notificationId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (error) throw error
  },

  async deleteNotification(notificationId) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) throw error
  },

  async markAllAsRead(userId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) throw error
  },

  async deleteNotification(notificationId) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) throw error
  },

  subscribeToNotifications(userId, callback) {
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

  async recordConsultation(doctorId, patientId, queueEntryId, startedAt, endedAt) {
    const durationMinutes = Math.round(
      (new Date(endedAt) - new Date(startedAt)) / (1000 * 60)
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

  async getDoctorAvgConsultationTime(doctorId, days = 7) {
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

  async recalculateQueuePositions(doctorId) {
    const { error } = await supabase.rpc('recalculate_queue_positions', {
      p_doctor_id: doctorId,
    })
    if (error) throw error
  },

  async handleNoShow(entryId) {
    const { data, error } = await supabase.rpc('handle_patient_no_show', {
      p_entry_id: entryId,
    })
    if (error) throw error
    return data
  },

  async notifyConsultationNear(doctorId, threshold = 3) {
    const { error } = await supabase.rpc('notify_consultation_near', {
      p_doctor_id: doctorId,
      p_threshold: threshold,
    })
    if (error) throw error
  },

  async checkDoctorCapacity(doctorId) {
    const { data, error } = await supabase.rpc('check_doctor_capacity', {
      p_doctor_id: doctorId,
    })
    if (error) throw error
    return data
  },

  async sendAppointmentBookedNotification(patientId, appointmentData) {
    return this.sendToPatient(patientId, NOTIFICATION_TYPES.APPOINTMENT_BOOKED, null, {
      appointment_id: appointmentData.id,
      doctor_name: appointmentData.doctor_name,
      scheduled_time: appointmentData.scheduled_time,
    })
  },

  async sendTokenGeneratedNotification(patientId, token, doctorName) {
    return this.sendToPatient(patientId, NOTIFICATION_TYPES.TOKEN_GENERATED, null, {
      token,
      doctor_name: doctorName,
    })
  },

  async sendConsultationStartNotification(patientId, doctorName) {
    return this.sendToPatient(patientId, NOTIFICATION_TYPES.CONSULTATION_START, null, {
      doctor_name: doctorName,
    })
  },

  async sendPatientCalledNotification(patientId, token, roomNumber) {
    return this.sendToPatient(patientId, NOTIFICATION_TYPES.PATIENT_CALLED, null, {
      token,
      room: roomNumber,
    })
  },

  async sendConsultationNearNotification(patientId, patientsAhead) {
    return this.sendToPatient(patientId, NOTIFICATION_TYPES.CONSULTATION_NEAR, null, {
      patients_ahead: patientsAhead,
    })
  },

  async sendNoShowNotification(patientId) {
    return this.sendToPatient(patientId, NOTIFICATION_TYPES.NO_SHOW_WARNING)
  },

  async sendCapacityWarningNotification(patientId, doctorName) {
    return this.sendToPatient(patientId, NOTIFICATION_TYPES.CAPACITY_REACHED, null, {
      doctor_name: doctorName,
    })
  },
}

export default notificationService
