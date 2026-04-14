/**
 * Intelligent Queue Engine
 * Hybrid algorithm for merging appointments, walk-ins, and emergencies
 * Enhanced with severity scores, triage levels, anti-starvation, and behavioral learning
 *
 * v2 Production Changes:
 * - Exponential wait-time ramp after 30 min (prevents walk-in starvation)
 * - No-show rate behavioral penalty (trust-based deprioritization)
 * - Queue pressure factor (walk-ins penalized when queue > 10)
 * - reQueueSkippedPatient() + shouldReQueue() for skipped patient recovery
 * - generateToken() race-condition suffix removed (DB RPC is now the source of truth)
 */

import { differenceInMinutes } from 'date-fns'

// ─── PRIORITY WEIGHTS ─────────────────────────────────────────────────────────
const WEIGHTS = {
  APPOINTMENT_BASE: 100,
  WALK_IN_BASE: 60,
  EMERGENCY_BONUS: 500,
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
}

// ─── SEVERITY WEIGHTS ──────────────────────────────────────────────────────────
const SEVERITY_WEIGHTS = {
  critical: 200,   // Life-threatening conditions
  high: 100,       // Severe pain/symptoms requiring immediate attention
  medium: 50,      // Moderate symptoms
  low: 25,         // Minor issues/routine checkups
  none: 0,         // No severity specified
}

// ─── TRIAGE LEVEL PRIORITY BONUS ───────────────────────────────────────────────
const TRIAGE_LEVEL_BONUS = {
  1: 300,  // Resuscitation - immediate
  2: 200,  // Emergency - within 10 min
  3: 100,  // Urgent - within 30 min
  4: 50,   // Less urgent - within 60 min
  5: 0,    // Non-urgent - standard queue
}

// ─── SYMPTOM CATEGORY BONUSES ──────────────────────────────────────────────────
const SYMPTOM_SPECIALTY_BONUS = {
  cardiology: 30,
  dermatology: 15,
  neurology: 40,
  orthopedics: 25,
  pediatrics: 20,
  general: 10,
}

const STATUS_ORDER = {
  in_consultation: 0,
  waiting: 1,
  skipped: 2,
  completed: 3,
  no_show: 4,
  cancelled: 5,
}

// How long a patient must be in 'skipped' before auto re-queue
const REQUEUE_GRACE_MINUTES = 10

/**
 * Calculate queue priority score for a single entry.
 *
 * @param {Object} entry           - Queue entry record
 * @param {string|null} doctorSpecialization - Used for symptom-specialty match bonus
 * @param {number} queueLength     - Current # of waiting patients (for pressure factor)
 * @returns {number} Priority score — higher = served sooner
 */
export function calculatePriorityScore(entry, doctorSpecialization = null, queueLength = 0) {
  const now = new Date()
  let score = 0

  // 1. Base priority by queue type
  switch (entry.queue_type) {
    case 'emergency':
      score += WEIGHTS.EMERGENCY_BONUS
      break
    case 'appointment':
      score += WEIGHTS.APPOINTMENT_BASE
      break
    case 'walk_in':
    default:
      score += WEIGHTS.WALK_IN_BASE
  }

  // 2. Severity score bonus
  const severityLevel = entry.severity_score || entry.severity || 'none'
  score += SEVERITY_WEIGHTS[severityLevel] || 0

  // 3. Triage level bonus
  const triageLevel = entry.triage_level
  if (triageLevel && TRIAGE_LEVEL_BONUS[triageLevel]) {
    score += TRIAGE_LEVEL_BONUS[triageLevel]
  }

  // 4. Symptom category matching with doctor specialization
  if (entry.symptom_category && doctorSpecialization) {
    const specialty = entry.symptom_category.toLowerCase()
    if (
      doctorSpecialization.toLowerCase() === specialty ||
      SYMPTOM_SPECIALTY_BONUS[specialty]
    ) {
      score += SYMPTOM_SPECIALTY_BONUS[specialty] || 0
    }
  }

  // 5. Waiting time — exponential ramp after WAIT_RAMP_THRESHOLD
  //    Flat +1/min for first 30 min, then +1.5/min afterwards.
  //    A patient waiting 60 min gets: 30*1 + 30*1.5 = 75 pts vs a new patient at 0.
  //    This prevents a fresh walk-in from always leapfrogging a long-wait patient.
  const createdAt = new Date(entry.created_at)
  const waitingMinutes = Math.max(0, differenceInMinutes(now, createdAt))

  if (waitingMinutes <= WEIGHTS.WAIT_RAMP_THRESHOLD) {
    score += waitingMinutes * WEIGHTS.WAITING_TIME_PER_MIN
  } else {
    score += WEIGHTS.WAIT_RAMP_THRESHOLD * WEIGHTS.WAITING_TIME_PER_MIN
    const extraMinutes = waitingMinutes - WEIGHTS.WAIT_RAMP_THRESHOLD
    score += Math.round(extraMinutes * WEIGHTS.WAIT_RAMP_FACTOR)
  }

  // 6. Check-in bonus
  if (entry.check_in_status) {
    score += WEIGHTS.CHECK_IN_BONUS

    // Early arrival bonus — more minutes early = higher bonus
    if (entry.appointment_id && entry.check_in_time && entry.scheduled_time) {
      const checkIn = new Date(entry.check_in_time)
      const scheduled = new Date(entry.scheduled_time)
      const minutesEarly = differenceInMinutes(scheduled, checkIn)
      if (minutesEarly >= 5) {
        const earlyBonus =
          WEIGHTS.EARLY_ARRIVAL_BONUS +
          Math.floor(minutesEarly / 5) * WEIGHTS.EARLY_ARRIVAL_MULTIPLIER
        score += earlyBonus
      }
    }
  }

  // 7. Lateness penalty (appointment patients who are late)
  if (entry.scheduled_time && entry.queue_type === 'appointment') {
    const scheduled = new Date(entry.scheduled_time)
    if (now > scheduled) {
      const lateMinutes = differenceInMinutes(now, scheduled)
      const penaltyUnits = Math.floor(lateMinutes / 5)
      score -= penaltyUnits * WEIGHTS.LATENESS_PENALTY_PER_5MIN
      // Floor: keep slightly-late appointments above walk-in baseline
      score = Math.max(score, WEIGHTS.WALK_IN_BASE + 10)
    }
  }

  // 8. No-show rate behavioral penalty
  //    Patients with a history of no-shows are deprioritised as a trust measure.
  //    Stored as 0.0–1.0 on users.no_show_rate (updated by DB trigger).
  const noShowRate = entry.patient?.no_show_rate || 0
  if (noShowRate > 0) {
    score -= Math.round(noShowRate * WEIGHTS.NO_SHOW_PENALTY_MAX)
  }

  // 9. Queue pressure factor — penalise new walk-ins when queue is congested.
  //    Prevents walk-in flooding when the doctor is already heavily booked.
  //    Emergencies and appointments are exempt.
  if (entry.queue_type === 'walk_in' && queueLength > WEIGHTS.QUEUE_PRESSURE_THRESHOLD) {
    const overThreshold = queueLength - WEIGHTS.QUEUE_PRESSURE_THRESHOLD
    score -= overThreshold * WEIGHTS.QUEUE_PRESSURE_PENALTY
  }

  return Math.round(score)
}

/**
 * Sort queue entries by priority.
 * Returns a new sorted array (does not mutate original).
 */
export function sortQueue(entries) {
  return [...entries].sort((a, b) => {
    // Always keep in_consultation at top
    if (a.status === 'in_consultation') return -1
    if (b.status === 'in_consultation') return 1

    // Sort 'waiting' entries by priority score
    if (a.status === 'waiting' && b.status === 'waiting') {
      return b.priority_score - a.priority_score
    }

    // Use status ordering for all other states
    return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
  })
}

/**
 * Get the current patient being seen (in_consultation).
 */
export function getCurrentPatient(entries) {
  return entries.find(e => e.status === 'in_consultation') || null
}

/**
 * Get the next patients in queue (waiting, sorted by priority).
 * Bug 9 fix: walk-in patients may have check_in_status null in raw realtime
 * payloads — do NOT filter on check_in_status here.
 */
export function getNextPatients(entries, count = 3) {
  return entries
    .filter(e => e.status === 'waiting')
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, count)
}

/**
 * Get total waiting count.
 */
export function getWaitingCount(entries) {
  return entries.filter(e => e.status === 'waiting').length
}

/**
 * Get 1-indexed position of a specific patient in the waiting queue.
 * Returns 0 if not in waiting.
 */
export function getPatientPosition(entries, patientId) {
  const sorted = entries
    .filter(e => e.status === 'waiting')
    .sort((a, b) => b.priority_score - a.priority_score)

  const idx = sorted.findIndex(e => e.patient_id === patientId)
  return idx === -1 ? 0 : idx + 1
}

/**
 * Emergency override: insert emergency patient at front of queue.
 * Recalculates all existing priority scores before inserting.
 */
export function insertEmergency(entries, emergencyEntry) {
  const updated = entries.map(e => ({
    ...e,
    priority_score: calculatePriorityScore(e),
  }))

  const emergency = {
    ...emergencyEntry,
    queue_type: 'emergency',
    priority_score: WEIGHTS.EMERGENCY_BONUS + 100,
    check_in_status: true,
    check_in_time: new Date().toISOString(),
    status: 'waiting',
  }

  return sortQueue([...updated, emergency])
}

/**
 * Late patient recovery: recalculate and re-insert a late patient.
 * Prevents starvation by guaranteeing at least walk-in priority.
 */
export function recoverLatePatient(entries, patientId) {
  return entries.map(e => {
    if (e.patient_id === patientId) {
      return {
        ...e,
        priority_score: Math.max(WEIGHTS.WALK_IN_BASE + 20, calculatePriorityScore(e)),
        status: 'waiting',
      }
    }
    return e
  })
}

/**
 * Recalculate all queue scores.
 * Passes current queue length for the pressure factor.
 * Should be called every ~2 min to keep scores fresh.
 */
export function recalculateQueue(entries) {
  const waitingCount = entries.filter(e => e.status === 'waiting').length
  const updated = entries.map(e => ({
    ...e,
    priority_score:
      e.status === 'waiting'
        ? calculatePriorityScore(e, null, waitingCount)
        : e.priority_score,
  }))
  return sortQueue(updated)
}

// ─── SKIPPED PATIENT RE-QUEUE ──────────────────────────────────────────────────

/**
 * Returns true if a skipped patient has waited long enough for auto re-queue.
 * Requires entry.skipped_at to be set when the status was changed to 'skipped'.
 */
export function shouldReQueue(entry) {
  if (entry.status !== 'skipped') return false
  if (!entry.skipped_at) return false
  const minutesSinceSkip = differenceInMinutes(new Date(), new Date(entry.skipped_at))
  return minutesSinceSkip >= REQUEUE_GRACE_MINUTES
}

/**
 * Re-queue a skipped patient with a score penalty.
 * Returns a new entry object (does not mutate). Does NOT persist to DB.
 * The caller is responsible for calling Supabase with the new status + score.
 */
export function reQueueSkippedPatient(entry) {
  const baseScore = calculatePriorityScore({ ...entry, status: 'waiting' })
  return {
    ...entry,
    status: 'waiting',
    priority_score: Math.max(WEIGHTS.WALK_IN_BASE, baseScore - WEIGHTS.REQUEUE_PENALTY),
    skipped_at: null,
  }
}

// ─── DEPARTMENT PREFIXES ───────────────────────────────────────────────────────

export const DEPARTMENT_PREFIXES = {
  'cardiology': 'CR',
  'cardiovascular': 'CV',
  'orthopedics': 'OR',
  'orthology': 'OT',
  'neurology': 'NR',
  'neuro': 'NE',
  'dentistry': 'DE',
  'dentist': 'DT',
  'dental': 'DL',
  'dermatology': 'DM',
  'dermatologist': 'DG',
  'gynecology': 'GY',
  'gynecologist': 'GN',
  'pediatrics': 'PD',
  'pediatric': 'PE',
  'psychiatry': 'PS',
  'psychiatrist': 'PY',
  'ophthalmology': 'OP',
  'ophthalmologist': 'OM',
  'ent': 'EN',
  'gastroenterology': 'GE',
  'general': 'GM',
  'general medicine': 'GF',
  'family medicine': 'FM',
  'urology': 'UR',
  'nephrology': 'NP',
  'pulmonology': 'PM',
  'oncology': 'OG',
  'default': 'XX',
}

export function getDepartmentPrefix(specialization) {
  if (!specialization) return DEPARTMENT_PREFIXES.default
  const lower = specialization.toLowerCase().trim()
  return DEPARTMENT_PREFIXES[lower] || DEPARTMENT_PREFIXES.default
}

/**
 * Generate a unique token number — resets daily.
 * Client-side fallback only. The authoritative implementation is the
 * generate_queue_token() Postgres RPC which is atomic inside the walk-in / 
 * appointment RPCs and prevents race conditions.
 */
export function generateToken(queueType, existingEntries, doctorInfo = null) {
  const today = new Date().toISOString().split('T')[0]

  let prefix
  if (queueType === 'appointment' && doctorInfo?.specialization) {
    prefix = getDepartmentPrefix(doctorInfo.specialization)
  } else if (queueType === 'emergency') {
    prefix = 'E'
  } else {
    prefix = 'W'
  }

  const todayEntries = existingEntries.filter(e => {
    if (!e.token_number?.startsWith(prefix)) return false
    const created = e.created_at
    if (!created) return true
    return new Date(created).toISOString().split('T')[0] === today
  })

  const count = todayEntries.length + 1
  return `${prefix}${String(count).padStart(2, '0')}`
}

/**
 * Multi-doctor load balancing.
 * Returns doctors sorted by estimated wait time (lowest first).
 */
export function balanceDoctorLoad(doctors, queuesByDoctor) {
  return doctors
    .map(doctor => {
      const queue = queuesByDoctor[doctor.id] || []
      const waitingEntries = queue.filter(e => e.status === 'waiting')
      const estimatedWait = waitingEntries.reduce(
        (total, e) => total + (e.predicted_consultation_time || doctor.consultation_avg_time),
        0
      )
      return {
        ...doctor,
        estimatedWaitMinutes: estimatedWait,
        queueLength: waitingEntries.length,
      }
    })
    .sort((a, b) => a.estimatedWaitMinutes - b.estimatedWaitMinutes)
}
