import { Appointment } from './appointments';

export interface AppointmentState {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  loadAppointments: (filters?: any) => Promise<void>;
  createAppointment: (appointmentData: any) => Promise<Appointment>;
  updateAppointment: (id: string, updates: any) => Promise<void>;
  approveAppointment: (id: string) => Promise<void>;
  rejectAppointment: (id: string, reason: string) => Promise<void>;
  cancelAppointment: (id: string) => Promise<void>;
  reset: () => void;
}
