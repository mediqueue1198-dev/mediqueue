/**
 * Intelligent Queue Engine
 * Hybrid algorithm for merging appointments, walk-ins, and emergencies
 * Enhanced with severity scores, triage levels, anti-starvation, and behavioral learning
 */

import { differenceInMinutes } from 'date-fns';
import { QueueEntry, Doctor, SeverityLevel } from '../types/queue';

// ─── PRIORITY WEIGHTS ─────────────────────────────────────────────────────────
const WEIGHTS = {
  APPOINTMENT_BASE: 100,
  WALK_IN_BASE: 60,
  EMERGENCY_BONUS: 1000,
  CHECK_IN_BONUS: 80,
  WAITING_TIME_PER_MIN: 1,
  WAIT_RAMP_THRESHOLD: 30,         // minutes of flat linear wait before exponential begins
  WAIT_RAMP_FACTOR: 1.5,           // points per extra minute after threshold
  LATENESS_PENALTY_PER_5MIN: 30,
  EARLY_ARRIVAL_BONUS: 20,
  EARLY_ARRIVAL_MULTIPLIER: 2,
  NO_SHOW_PENALTY_MAX: 50,         // max pts deducted for 100% no-show rate
  QUEUE_PRESSURE_THRESHOLD: 10,    // queue size before walk-in pressure kicks in
  QUEUE_PRESSURE_PENALTY: 5,       // pts deducted per patient over threshold (walk-ins only)
  REQUEUE_PENALTY: 30,             // pts deducted when a skipped patient re-enters
};

// ─── SEVERITY WEIGHTS ──────────────────────────────────────────────────────────
const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  critical: 200,   // Life-threatening conditions
  high: 100,       // Severe pain/symptoms requiring immediate attention
  medium: 50,      // Moderate symptoms
  low: 25,         // Minor issues/routine checkups
  none: 0,         // No severity specified
};

// ─── TRIAGE LEVEL PRIORITY BONUS ───────────────────────────────────────────────
const TRIAGE_LEVEL_BONUS: Record<number, number> = {
  1: 300,  // Resuscitation - immediate
  2: 200,  // Emergency - within 10 min
  3: 100,  // Urgent - within 30 min
  4: 50,   // Less urgent - within 60 min
  5: 0,    // Non-urgent - standard queue
};

// ─── SYMPTOM CATEGORY BONUSES ──────────────────────────────────────────────────
const SYMPTOM_SPECIALTY_BONUS: Record<string, number> = {
  cardiology: 30,
  dermatology: 15,
  neurology: 40,
  orthopedics: 25,
  pediatrics: 20,
  general: 10,
};

const STATUS_ORDER: Record<string, number> = {
  in_consultation: 0,
  waiting: 1,
  skipped: 2,
  completed: 3,
  no_show: 4,
  cancelled: 5,
};

const REQUEUE_GRACE_MINUTES = 10;

/**
 * Calculate queue priority score for a single entry.
 */
export function calculatePriorityScore(
  entry: Partial<QueueEntry>, 
  doctorSpecialization: string | null = null, 
  queueLength: number = 0
): number {
  const now = new Date();
  let score = 0;

  // 1. Base priority by queue type
  switch (entry.queue_type) {
    case 'emergency':
      score += WEIGHTS.EMERGENCY_BONUS;
      break;
    case 'appointment':
      score += WEIGHTS.APPOINTMENT_BASE;
      break;
    case 'walk_in':
    default:
      score += WEIGHTS.WALK_IN_BASE;
  }

  // 2. Severity score bonus
  const severityLevel = (entry.severity_score || entry.severity || 'none') as SeverityLevel;
  score += SEVERITY_WEIGHTS[severityLevel] || 0;

  // 3. Triage level bonus
  const triageLevel = entry.triage_level;
  if (triageLevel && TRIAGE_LEVEL_BONUS[triageLevel]) {
    score += TRIAGE_LEVEL_BONUS[triageLevel];
  }

  // 4. Symptom category matching with doctor specialization
  if (entry.symptom_category && doctorSpecialization) {
    const specialty = entry.symptom_category.toLowerCase();
    if (
      doctorSpecialization.toLowerCase() === specialty ||
      SYMPTOM_SPECIALTY_BONUS[specialty]
    ) {
      score += SYMPTOM_SPECIALTY_BONUS[specialty] || 0;
    }
  }

  // 5. Waiting time — exponential ramp after WAIT_RAMP_THRESHOLD
  const createdAt = entry.created_at ? new Date(entry.created_at) : now;
  const waitingMinutes = Math.max(0, differenceInMinutes(now, createdAt));

  if (waitingMinutes <= WEIGHTS.WAIT_RAMP_THRESHOLD) {
    score += waitingMinutes * WEIGHTS.WAITING_TIME_PER_MIN;
  } else {
    score += WEIGHTS.WAIT_RAMP_THRESHOLD * WEIGHTS.WAITING_TIME_PER_MIN;
    const extraMinutes = waitingMinutes - WEIGHTS.WAIT_RAMP_THRESHOLD;
    score += Math.round(extraMinutes * WEIGHTS.WAIT_RAMP_FACTOR);
  }

  // 6. Check-in bonus
  if (entry.check_in_status) {
    score += WEIGHTS.CHECK_IN_BONUS;

    if (entry.appointment_id && entry.check_in_time && entry.scheduled_time) {
      const checkIn = new Date(entry.check_in_time);
      const scheduled = new Date(entry.scheduled_time);
      const minutesEarly = differenceInMinutes(scheduled, checkIn);
      if (minutesEarly >= 5) {
        const earlyBonus =
          WEIGHTS.EARLY_ARRIVAL_BONUS +
          Math.floor(minutesEarly / 5) * WEIGHTS.EARLY_ARRIVAL_MULTIPLIER;
        score += earlyBonus;
      }
    }
  }

  // 7. Lateness penalty
  if (entry.scheduled_time && entry.queue_type === 'appointment') {
    const scheduled = new Date(entry.scheduled_time);
    if (now > scheduled) {
      const lateMinutes = differenceInMinutes(now, scheduled);
      const penaltyUnits = Math.floor(lateMinutes / 5);
      score -= penaltyUnits * WEIGHTS.LATENESS_PENALTY_PER_5MIN;
      score = Math.max(score, WEIGHTS.WALK_IN_BASE + 10);
    }
  }

  // 8. No-show penalty
  const noShowRate = entry.patient?.no_show_rate || 0;
  if (noShowRate > 0) {
    score -= Math.round(noShowRate * WEIGHTS.NO_SHOW_PENALTY_MAX);
  }

  // 9. Queue pressure factor
  if (entry.queue_type === 'walk_in' && queueLength > WEIGHTS.QUEUE_PRESSURE_THRESHOLD) {
    const overThreshold = queueLength - WEIGHTS.QUEUE_PRESSURE_THRESHOLD;
    score -= overThreshold * WEIGHTS.QUEUE_PRESSURE_PENALTY;
  }

  return Math.round(score);
}

/**
 * Sort queue entries by priority.
 */
export function sortQueue(entries: QueueEntry[]): QueueEntry[] {
  return [...entries].sort((a, b) => {
    if (a.status === 'in_consultation') return -1;
    if (b.status === 'in_consultation') return 1;

    if (a.status === 'waiting' && b.status === 'waiting') {
      return b.priority_score - a.priority_score;
    }

    return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
  });
}

export function getCurrentPatient(entries: QueueEntry[]): QueueEntry | null {
  return entries.find(e => e.status === 'in_consultation') || null;
}

export function getNextPatients(entries: QueueEntry[], count: number = 3): QueueEntry[] {
  return entries
    .filter(e => e.status === 'waiting')
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, count);
}

export function getWaitingCount(entries: QueueEntry[]): number {
  return entries.filter(e => e.status === 'waiting').length;
}

export function getPatientPosition(entries: QueueEntry[], patientId: string): number {
  const sorted = entries
    .filter(e => e.status === 'waiting')
    .sort((a, b) => b.priority_score - a.priority_score);

  const idx = sorted.findIndex(e => e.patient_id === patientId);
  return idx === -1 ? 0 : idx + 1;
}

export function recalculateQueue(entries: QueueEntry[]): QueueEntry[] {
  const waitingCount = entries.filter(e => e.status === 'waiting').length;
  const updated = entries.map(e => ({
    ...e,
    priority_score:
      e.status === 'waiting'
        ? calculatePriorityScore(e, null, waitingCount)
        : e.priority_score,
  }));
  return sortQueue(updated);
}

export function shouldReQueue(entry: QueueEntry): boolean {
  if (entry.status !== 'skipped') return false;
  if (!entry.skipped_at) return false;
  const minutesSinceSkip = differenceInMinutes(new Date(), new Date(entry.skipped_at));
  return minutesSinceSkip >= REQUEUE_GRACE_MINUTES;
}

export function reQueueSkippedPatient(entry: QueueEntry): QueueEntry {
  const baseScore = calculatePriorityScore({ ...entry, status: 'waiting' });
  return {
    ...entry,
    status: 'waiting',
    priority_score: Math.max(WEIGHTS.WALK_IN_BASE, baseScore - WEIGHTS.REQUEUE_PENALTY),
    skipped_at: null,
  };
}

export const DEPARTMENT_PREFIXES: Record<string, string> = {
  cardiology: 'CR',
  orthopedics: 'OR',
  neurology: 'NR',
  dentistry: 'DE',
  dermatology: 'DM',
  pediatrics: 'PD',
  general: 'GM',
  default: 'XX',
};

export function getDepartmentPrefix(specialization: string | undefined): string {
  if (!specialization) return DEPARTMENT_PREFIXES.default;
  const lower = specialization.toLowerCase().trim();
  return DEPARTMENT_PREFIXES[lower] || DEPARTMENT_PREFIXES.default;
}

export function generateToken(
  queueType: string, 
  existingEntries: QueueEntry[], 
  doctorInfo: Doctor | null = null
): string {
  const today = new Date().toISOString().split('T')[0];

  let prefix: string;
  if (queueType === 'appointment' && doctorInfo?.specialization) {
    prefix = getDepartmentPrefix(doctorInfo.specialization);
  } else if (queueType === 'emergency') {
    prefix = 'E';
  } else {
    prefix = 'W';
  }

  const todayEntries = existingEntries.filter(e => {
    if (!e.token_number?.startsWith(prefix)) return false;
    const created = e.created_at;
    if (!created) return true;
    return new Date(created).toISOString().split('T')[0] === today;
  });

  const count = todayEntries.length + 1;
  return `${prefix}${String(count).padStart(2, '0')}`;
}
