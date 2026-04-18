export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'rejected';
export type VisitType = 'first_visit' | 'follow_up' | 'emergency';
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'waived';
export type PaymentMethod = 'cash' | 'card' | 'upi';

export interface Appointment {
  id: string;
  patient_id: string | null;
  patient_name?: string;
  patient_phone?: string;
  doctor_id: string;
  scheduled_time: string;
  visit_type: VisitType;
  symptoms?: string;
  status: AppointmentStatus;
  notes?: string;
  family_member_id?: string | null;
  payment_method?: PaymentMethod;
  payment_status: PaymentStatus;
  consultation_fee: number;
  additional_charges: number;
  additional_charges_details?: any[];
  total_amount: number;
  paid_amount: number;
  payment_time?: string;
  created_at: string;
  location?: string;
  duration_minutes: number;
  // Joins
  patient?: any;
  doctor?: any;
}
