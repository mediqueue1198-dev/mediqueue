export type NotificationType = 'APPOINTMENT_BOOKED' | 'TOKEN_GENERATED' | 'WAIT_TIME_UPDATED' | 'QUEUE_UPDATED' | 'REMINDER' | 'CONSULTATION_START' | 'PATIENT_CALLED' | 'NO_SHOW_WARNING' | 'CAPACITY_REACHED' | 'RESCHEDULE_AVAILABLE' | 'CONSULTATION_NEAR';

export interface Notification {
  id: string;
  user_id: string;
  user_role: 'patient' | 'doctor' | 'mediator';
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
  updated_at?: string;
}
