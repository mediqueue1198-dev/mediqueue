/**
 * Intelligent Queue Engine
 * Hybrid algorithm for merging appointments, walk-ins, and emergencies
 * Enhanced with severity scores and triage levels
 */

import { differenceInMinutes } from 'date-fns'

// ─── PRIORITY WEIGHTS ─────────────────────────────────────────────────────────
const WEIGHTS = {
  APPOINTMENT_BASE: 100,
  WALK_IN_BASE: 60,
  EMERGENCY_BONUS: 500,
  CHECK_IN_BONUS: 80,
  WAITING_TIME_PER_MIN: 1,
  LATENESS_PENALTY_PER_5MIN: 30,
  EARLY_ARRIVAL_BONUS: 20,
  EARLY_ARRIVAL_MULTIPLIER: 2,
}

// ─── SEVERITY WEIGHTS ──────────────────────────────────────────────────────────
const SEVERITY_WEIGHTS = {
  critical: 200,    // Life-threatening conditions
  high: 100,        // Severe pain/symptoms requiring immediate attention
  medium: 50,       // Moderate symptoms
  low: 25,          // Minor issues/routine checkups
  none: 0,          // No severity specified
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

/**
 * Calculate queue priority score for a single entry
 * Enhanced with severity scores, triage levels, and symptom matching
 * Higher score = higher priority (served sooner)
 */
export function calculatePriorityScore(entry, doctorSpecialization = null) {
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
      score += WEIGHTS.WALK_IN_BASE
      break
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
    if (doctorSpecialization.toLowerCase() === specialty || 
        SYMPTOM_SPECIALTY_BONUS[specialty]) {
      score += SYMPTOM_SPECIALTY_BONUS[specialty] || 0
    }
  }

  // 5. Waiting time bonus (longer wait = higher priority)
  const createdAt = new Date(entry.created_at)
  const waitingMinutes = differenceInMinutes(now, createdAt)
  score += waitingMinutes * WEIGHTS.WAITING_TIME_PER_MIN

  // 6. Check-in bonus
  if (entry.check_in_status) {
    score += WEIGHTS.CHECK_IN_BONUS

    // Early arrival bonus - more minutes early = higher bonus
    if (entry.appointment_id && entry.check_in_time && entry.scheduled_time) {
      const checkIn = new Date(entry.check_in_time)
      const scheduled = new Date(entry.scheduled_time)
      const minutesEarly = differenceInMinutes(scheduled, checkIn)
      if (minutesEarly >= 5) {
        // Base bonus + bonus for each 5 minutes early
        const earlyBonus = WEIGHTS.EARLY_ARRIVAL_BONUS + Math.floor(minutesEarly / 5) * WEIGHTS.EARLY_ARRIVAL_MULTIPLIER
        score += earlyBonus
      }
    }
  }

  // 7. Lateness penalty (for appointment patients who are late)
  if (entry.scheduled_time && entry.queue_type === 'appointment') {
    const scheduled = new Date(entry.scheduled_time)
    if (now > scheduled) {
      const lateMinutes = differenceInMinutes(now, scheduled)
      const penaltyUnits = Math.floor(lateMinutes / 5)
      score -= penaltyUnits * WEIGHTS.LATENESS_PENALTY_PER_5MIN
      // Floor the score - still keep them above walk-ins if only slightly late
      score = Math.max(score, WEIGHTS.WALK_IN_BASE + 10)
    }
  }

  return Math.round(score)
}

/**
 * Sort queue entries by priority
 * Returns a new sorted array (does not mutate original)
 */
export function sortQueue(entries) {
  return [...entries].sort((a, b) => {
    // Always keep in_consultation at top
    if (a.status === 'in_consultation') return -1
    if (b.status === 'in_consultation') return 1

    // Only sort 'waiting' entries by score
    if (a.status === 'waiting' && b.status === 'waiting') {
      return b.priority_score - a.priority_score
    }

    // Status ordering for non-waiting
    return (STATUS_ORDER[a.status] || 99) - (STATUS_ORDER[b.status] || 99)
  })
}

/**
 * Get the current patient being seen (in_consultation)
 */
export function getCurrentPatient(entries) {
  return entries.find(e => e.status === 'in_consultation') || null
}

/**
 * Get the next patient(s) in queue (waiting, sorted by priority)
 */
export function getNextPatients(entries, count = 3) {
  return entries
    .filter(e => e.status === 'waiting' && e.check_in_status)
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, count)
}

/**
 * Get total waiting count
 */
export function getWaitingCount(entries) {
  return entries.filter(e => e.status === 'waiting').length
}

/**
 * Get position of a specific patient in queue
 * Returns 1-indexed position, 0 if not in waiting
 */
export function getPatientPosition(entries, patientId) {
  const sorted = entries
    .filter(e => e.status === 'waiting')
    .sort((a, b) => b.priority_score - a.priority_score)

  const idx = sorted.findIndex(e => e.patient_id === patientId)
  return idx === -1 ? 0 : idx + 1
}

/**
 * Emergency override: insert emergency patient at front of queue
 * Recalculates priority scores
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
 * Late patient recovery: recalculate and re-insert late patient
 * Prevents starvation by giving at minimum walk-in priority
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
 * Recalculate all queue scores (call periodically for fresh state)
 */
export function recalculateQueue(entries) {
  const updated = entries.map(e => ({
    ...e,
    priority_score: e.status === 'waiting' ? calculatePriorityScore(e) : e.priority_score,
  }))
  return sortQueue(updated)
}

/**
 * Department prefix mapping - each department has a unique prefix
 */
export const DEPARTMENT_PREFIXES = {
  // Unique prefixes - no duplicates
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
  // Default fallback for unknown departments
  'default': 'XX'
}

/**
 * Get department prefix from doctor specialization
 */
export function getDepartmentPrefix(specialization) {
  if (!specialization) return DEPARTMENT_PREFIXES.default
  const lower = specialization.toLowerCase().trim()
  return DEPARTMENT_PREFIXES[lower] || DEPARTMENT_PREFIXES.default
}

/**
 * Generate a unique token number - resets daily
 * For appointments: uses department prefix (e.g., C01, O01)
 * For walk-ins/emergency: uses W/E prefix
 */
export function generateToken(queueType, existingEntries, doctorInfo = null) {
  const today = new Date().toISOString().split('T')[0]
  
  let prefix
  if (queueType === 'appointment' && doctorInfo?.specialization) {
    // Use department prefix for appointments
    prefix = getDepartmentPrefix(doctorInfo.specialization)
  } else if (queueType === 'emergency') {
    prefix = 'E'
  } else {
    prefix = 'W' // walk-in
  }
  
  // Filter entries by same prefix and today
  const todayEntries = existingEntries.filter(e => {
    if (!e.token_number?.startsWith(prefix)) return false
    const created = e.created_at
    if (!created) return true
    const createdDate = new Date(created).toISOString().split('T')[0]
    return createdDate === today
  })
  
  const count = todayEntries.length + 1
  return `${prefix}${String(count).padStart(2, '0')}`
}

/**
 * Multi-doctor load balancing
 * Returns doctors sorted by estimated wait time (lowest first)
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
