export type QueueStatus = 'waiting' | 'in_consultation' | 'completed' | 'skipped' | 'no_show' | 'cancelled';
export type QueueType = 'appointment' | 'walk_in' | 'emergency';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface QueueEntry {
  id: string;
  doctor_id: string;
  patient_id?: string;
  patient_name?: string;
  patient_phone?: string;
  appointment_id?: string;
  queue_type: QueueType;
  token_number: string;
  priority_score: number;
  predicted_consultation_time: number;
  status: QueueStatus;
  check_in_status: boolean;
  check_in_time?: string;
  created_at: string;
  scheduled_time?: string; // from joined appointment
  severity_score?: SeverityLevel;
  severity?: SeverityLevel;
  triage_level?: 1 | 2 | 3 | 4 | 5;
  symptom_category?: string;
  skipped_at?: string | null;
  patient?: {
    full_name?: string;
    phone?: string;
    email?: string;
    no_show_rate?: number;
  };
}

export interface Doctor {
  id: string;
  user_id: string;
  specialization: string;
  license_number?: string;
  department?: string;
  consultation_avg_time: number;
  experience_years?: number;
  rating?: number;
  bio?: string;
  availability_schedule?: any;
  is_available: boolean;
  education?: string;
  education_institution?: string;
  hospital_name?: string;
  location?: string;
  name?: string;
  first_visit_fee?: number;
  follow_up_fee?: number;
  emergency_fee?: number;
  fixed_fee?: number;
  fee_type?: 'by_visit_type' | 'fixed' | 'any';
  daily_capacity?: number;
  created_at?: string;
  user?: {
    id?: string;
    full_name: string;
    email: string;
    phone: string | null;
  };
}
