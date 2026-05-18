import { User } from '@supabase/supabase-js'

export type UserRole = 'patient' | 'doctor' | 'mediator';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  doctor_id?: string;
  patient_id?: string;
  mediator_id?: string;
  hospital_id?: string;
  isOnboarded?: boolean;
  isApproved?: boolean;
  approvedDoctorIds?: string[];
}

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  ensureProfile: (user: User, metadata?: any) => Promise<UserProfile>;
  login: (email: string, password: string) => Promise<{ user: User; profile: UserProfile }>;
  register: (data: any) => Promise<User | null>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  clearError: () => void;
}
