import { QueueEntry } from './queue';

export interface QueueState {
  entries: QueueEntry[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  currentCallingEntryId: string | null;
  noShowExpiresAt: string | null;
  isOnBreak: boolean;
  breakUntil: string | null;
  breakMessage: string | null;
  breakCheckInterval: any | null;

  loadQueue: (doctorId: string | null) => Promise<void>;
  handleRealtimeUpdate: (payload: any) => void;
  callNext: (doctorId: string) => Promise<any | null>;
  startNoShowTimer: (entryId: string, doctorId: string | null, calledAt: string) => void;
  clearNoShowTimer: () => void;
  handleNoShow: (entryId: string, doctorId: string) => Promise<void>;
  updateStatus: (entryId: string, status: string, extras?: any) => Promise<void>;
  checkIn: (entryId: string) => Promise<void>;
  addFromAppointment: (appointment: any, doctorInfo?: any) => Promise<QueueEntry>;
  addWalkIn: (data: any, doctorInfo?: any) => Promise<QueueEntry>;
  changePriority: (entryId: string, newScore: number) => Promise<void>;
  recalculate: () => void;
  fetchBreakState: (doctorId: string) => Promise<void>;
  toggleBreak: (doctorId: string, durationMinutes?: number, message?: string) => Promise<void>;
  resumeFromBreak: (doctorId: string) => Promise<void>;
  startSkippedPatientWatcher: () => void;
  processSkippedPatients: () => Promise<void>;
  manualReQueue: (entryId: string) => Promise<void>;
  reset: () => void;
}
