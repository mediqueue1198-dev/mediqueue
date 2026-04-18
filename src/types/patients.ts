import { UserRole } from './auth';

export interface Patient {
  id: string;
  user_id: string;
  date_of_birth?: string;
  blood_type?: string;
  allergies?: string[];
  medical_history?: string[];
  emergency_contact?: any;
  insurance_info?: any;
  name?: string;
  patient_name?: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    role: UserRole;
  };
}

export interface FamilyMember {
  id: string;
  patient_id: string;
  name: string;
  relationship: string;
  date_of_birth?: string;
  blood_type?: string;
  notes?: string;
  created_at: string;
}

export interface MedicalRecord {
  id: string;
  patient_id: string | null;
  patient_name?: string;
  patient_phone?: string;
  doctor_id: string;
  appointment_id?: string;
  queue_entry_id?: string;
  diagnosis: string;
  prescription: any[];
  notes?: string;
  attachments?: string[];
  created_at: string;
  doctor?: any;
}
