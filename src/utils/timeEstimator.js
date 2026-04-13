/**
 * Consultation Time Estimator
 * Predicts consultation duration based on patient and doctor factors
 * Uses historical data for improved accuracy
 */

import { differenceInMinutes } from 'date-fns'
import notificationService from '@/services/notificationService'

// ─── BASE FACTORS ─────────────────────────────────────────────────────────────
const VISIT_TYPE_WEIGHTS = {
  first_visit: 1.5,
  follow_up: 1.0,
  emergency: 0.8,
  walk_in: 1.1,
}

const DEFAULT_CONSULTATION_TIME = 15 // minutes

const SYMPTOM_COMPLEXITY_MAP = {
  low: 0,      // 1-2 symptoms
  medium: 3,   // 3-5 symptoms
  high: 7,     // 6+ symptoms
}

const NEW_PATIENT_PENALTY = 5       // extra minutes for first-time patients
const FATIGUE_FACTOR_DIVISOR = 20  // patients per unit of fatigue
const FATIGUE_INCREMENT = 0.1      // 10% increase per fatigue unit

// Cache for doctor average times
const doctorAvgTimeCache = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get doctor's average consultation time from history or use default
 * @param {string} doctorId - Doctor's UUID
 * @param {number} days - Days to look back (default 7)
 * @returns {Promise<number>} Average consultation time in minutes
 */
export async function getDoctorAvgConsultationTime(doctorId, days = 7) {
  if (!doctorId) return DEFAULT_CONSULTATION_TIME
  
  // Check cache
  const cached = doctorAvgTimeCache.get(doctorId)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.time
  }
  
  try {
    const avgTime = await notificationService.getDoctorAvgConsultationTime(doctorId, days)
    doctorAvgTimeCache.set(doctorId, { time: avgTime, timestamp: Date.now() })
    return avgTime
  } catch (error) {
    console.error('Failed to get doctor avg consultation time:', error)
    return DEFAULT_CONSULTATION_TIME
  }
}

/**
 * Clear doctor average time cache
 */
export function clearDoctorAvgTimeCache() {
  doctorAvgTimeCache.clear()
}

/**
 * Predict consultation time for a patient
 * @param {Object} options
 * @param {string} options.doctorId - Doctor's UUID
 * @param {number} options.doctorAvgTime - Doctor's historical average (minutes)
 * @param {string} options.visitType - 'first_visit' | 'follow_up' | 'emergency' | 'walk_in'
 * @param {number} options.symptomsCount - Number of reported symptoms
 * @param {boolean} options.isNewPatient - Whether patient has visited this doctor before
 * @param {number} options.patientsSeenToday - How many patients doctor has already seen
 * @returns {number} Predicted time in minutes
 */
export async function predictConsultationTime({
  doctorId,
  doctorAvgTime = DEFAULT_CONSULTATION_TIME,
  visitType = 'follow_up',
  symptomsCount = 1,
  isNewPatient = false,
  patientsSeenToday = 0,
}) {
  // Try to get doctor historical average if doctorId provided
  let baseTime = doctorAvgTime
  if (doctorId) {
    baseTime = await getDoctorAvgConsultationTime(doctorId) || doctorAvgTime
  }

  // Base from doctor average
  let time = baseTime

  // Visit type multiplier
  const typeWeight = VISIT_TYPE_WEIGHTS[visitType] || 1.0
  time *= typeWeight

  // Symptom complexity add-on
  let complexityBonus = 0
  if (symptomsCount <= 2) complexityBonus = SYMPTOM_COMPLEXITY_MAP.low
  else if (symptomsCount <= 5) complexityBonus = SYMPTOM_COMPLEXITY_MAP.medium
  else complexityBonus = SYMPTOM_COMPLEXITY_MAP.high
  time += complexityBonus

  // New patient penalty
  if (isNewPatient) time += NEW_PATIENT_PENALTY

  // Doctor fatigue factor (the more patients seen, slightly longer each takes)
  const fatigueUnits = Math.floor(patientsSeenToday / FATIGUE_FACTOR_DIVISOR)
  const fatigueFactor = 1 + fatigueUnits * FATIGUE_INCREMENT
  time *= fatigueFactor

  // Round to nearest minute, minimum 5 minutes
  return Math.max(5, Math.round(time))
}

/**
 * Calculate estimated wait time for a patient
 * Uses individual predicted times or falls back to doctor average
 * Properly handles patients currently in consultation by calculating remaining time
 * @param {Array} queueAhead - Queue entries ahead of this patient (already sorted)
 * @param {string} doctorId - Doctor's UUID for fetching average
 * @param {number} defaultConsultTime - Fallback if no predicted time on entries
 * @returns {Promise<number>} Estimated wait time in minutes
 */
export async function calculateEstimatedWait(queueAhead, doctorId = null, defaultConsultTime = DEFAULT_CONSULTATION_TIME) {
  if (!queueAhead || queueAhead.length === 0) return 0

  // Get doctor average time if doctorId provided
  let avgTime = defaultConsultTime
  if (doctorId) {
    avgTime = await getDoctorAvgConsultationTime(doctorId) || defaultConsultTime
  }

  let totalWait = 0
  
  for (const entry of queueAhead) {
    let time = entry.predicted_consultation_time || avgTime
    
    // If entry is currently in consultation, calculate remaining time
    if (entry.status === 'in_consultation' && entry.called_at) {
      const elapsed = differenceInMinutes(new Date(), new Date(entry.called_at))
      // Only count remaining time, not full duration
      const remaining = Math.max(0, time - elapsed)
      totalWait += remaining
    } else {
      // Waiting patients get full estimated time
      totalWait += time
    }
  }
  
  return totalWait
}

/**
 * Synchronous version for cases where async is not needed
 * Properly handles patients currently in consultation
 * @param {Array} queueAhead - Queue entries ahead of this patient
 * @param {number} defaultConsultTime - Default consultation time
 * @returns {number} Estimated wait time in minutes
 */
export function calculateEstimatedWaitSync(queueAhead, defaultConsultTime = DEFAULT_CONSULTATION_TIME) {
  if (!queueAhead || queueAhead.length === 0) return 0

  let totalWait = 0
  
  for (const entry of queueAhead) {
    const time = entry.predicted_consultation_time || defaultConsultTime
    
    // If entry is currently in consultation, calculate remaining time
    if (entry.status === 'in_consultation' && entry.called_at) {
      const elapsed = differenceInMinutes(new Date(), new Date(entry.called_at))
      const remaining = Math.max(0, time - elapsed)
      totalWait += remaining
    } else {
      totalWait += time
    }
  }
  
  return totalWait
}

/**
 * Get expected consultation start time for a patient
 * @param {Date|string} now - Current time
 * @param {number} estimatedWaitMinutes - Minutes until consultation
 * @returns {Date} Expected start time
 */
export function getExpectedConsultationTime(now, estimatedWaitMinutes) {
  const base = now instanceof Date ? now : new Date(now)
  return new Date(base.getTime() + estimatedWaitMinutes * 60 * 1000)
}

/**
 * Format wait time for display
 * @param {number} minutes
 * @returns {string} e.g. "45 min" or "1h 15min"
 */
export function formatWaitTime(minutes) {
  if (minutes <= 0) return 'Now'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

/**
 * Get consultation time summary for a queue entry
 * @param {Object} entry - Queue entry
 * @param {Array} queueAhead - Entries ahead in queue
 * @param {string} doctorId - Doctor's UUID
 * @returns {Promise<Object>} Time summary
 */
export async function getQueueTimeSummary(entry, queueAhead, doctorId = null) {
  const estimatedWaitMinutes = await calculateEstimatedWait(queueAhead, doctorId)
  const expectedStart = getExpectedConsultationTime(new Date(), estimatedWaitMinutes)
  
  const avgTime = doctorId 
    ? await getDoctorAvgConsultationTime(doctorId) 
    : DEFAULT_CONSULTATION_TIME

  return {
    estimatedWaitMinutes,
    estimatedWaitFormatted: formatWaitTime(estimatedWaitMinutes),
    expectedStartTime: expectedStart,
    predictedDuration: entry.predicted_consultation_time || avgTime,
    doctorAvgTime: avgTime,
  }
}

/**
 * Calculate patients ahead count
 * @param {Array} allEntries - All queue entries
 * @param {string} patientId - Patient's UUID
 * @param {string} doctorId - Doctor's UUID to filter by
 * @returns {number} Number of patients ahead
 */
export function getPatientsAheadCount(allEntries, patientId, doctorId = null) {
  const filtered = doctorId 
    ? allEntries.filter(e => e.doctor_id === doctorId)
    : allEntries
  
  const waitingEntries = filtered
    .filter(e => e.status === 'waiting' || e.status === 'in_consultation')
    .sort((a, b) => b.priority_score - a.priority_score)
  
  const idx = waitingEntries.findIndex(e => e.patient_id === patientId)
  return idx === -1 ? 0 : idx
}

/**
 * Format expected consultation time
 * @param {Date} date - Expected consultation date
 * @returns {string} Formatted time string (e.g., "10:31 AM")
 */
export function formatExpectedTime(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

/**
 * Get detailed wait time breakdown for a patient
 * Shows how many patients ahead and their estimated times
 * @param {Object} myEntry - Patient's queue entry
 * @param {Array} allEntries - All queue entries for the doctor
 * @param {number} defaultConsultTime - Default consultation time
 * @returns {Object} Detailed breakdown object
 */
export function getDetailedWaitBreakdown(myEntry, allEntries, defaultConsultTime = DEFAULT_CONSULTATION_TIME) {
  if (!myEntry || !allEntries || allEntries.length === 0) {
    return {
      patientsAhead: 0,
      totalEstimatedMinutes: 0,
      breakdown: [],
      inConsultationNow: null,
    }
  }

  // Filter to waiting + in_consultation entries sorted by priority
  const activeEntries = allEntries
    .filter(e => e.status === 'waiting' || e.status === 'in_consultation')
    .sort((a, b) => b.priority_score - a.priority_score)

  // Find my position
  const myIndex = activeEntries.findIndex(e => e.id === myEntry.id)
  
  if (myIndex === -1 || myIndex === 0) {
    return {
      patientsAhead: 0,
      totalEstimatedMinutes: 0,
      breakdown: [],
      inConsultationNow: myEntry.status === 'in_consultation' ? myEntry : null,
    }
  }

  const entriesAhead = activeEntries.slice(0, myIndex)
  const breakdown = []
  let totalMinutes = 0

  for (const entry of entriesAhead) {
    const time = entry.predicted_consultation_time || defaultConsultTime
    let actualTime = time
    
    // If in consultation, calculate remaining time
    if (entry.status === 'in_consultation' && entry.called_at) {
      const elapsed = differenceInMinutes(new Date(), new Date(entry.called_at))
      actualTime = Math.max(0, time - elapsed)
    }
    
    breakdown.push({
      token: entry.token_number,
      patientName: entry.patient?.full_name || entry.family_member?.name || 'Patient',
      estimatedMinutes: actualTime,
      status: entry.status,
    })
    
    totalMinutes += actualTime
  }

  // Check if there's someone currently in consultation
  const inConsultationNow = activeEntries.find(e => e.status === 'in_consultation' && e.id !== myEntry.id) || null

  return {
    patientsAhead: entriesAhead.length,
    totalEstimatedMinutes: totalMinutes,
    breakdown,
    inConsultationNow,
  }
}

/**
 * Calculate a confidence score for the estimated wait time
 * Based on how accurate historical data is
 * @param {number} patientsAhead - Number of patients ahead
 * @param {number} avgConsultTime - Doctor's average consultation time
 * @param {number} historicalDataPoints - Number of consultations to base avg on
 * @returns {number} Confidence percentage (0-100)
 */
export function calculateWaitConfidence(patientsAhead, avgConsultTime, historicalDataPoints = 0) {
  // Base confidence starts at 70%
  let confidence = 70
  
  // More patients ahead = slightly less confident
  if (patientsAhead > 5) confidence -= 5
  if (patientsAhead > 10) confidence -= 5
  
  // More historical data = more confident
  if (historicalDataPoints > 20) confidence += 10
  else if (historicalDataPoints > 10) confidence += 5
  
  // Higher avg consultation time = more variable = less confident
  if (avgConsultTime > 20) confidence -= 5
  
  return Math.max(20, Math.min(95, confidence))
}

/**
 * Get queue progress percentage
 * @param {Object} myEntry - Patient's queue entry
 * @param {Array} allEntries - All queue entries
 * @returns {number} Progress percentage (0-100)
 */
export function getQueueProgress(myEntry, allEntries) {
  if (!myEntry || !allEntries) return 0
  
  const activeEntries = allEntries
    .filter(e => e.status === 'waiting' || e.status === 'in_consultation')
    .sort((a, b) => b.priority_score - a.priority_score)
  
  const myIndex = activeEntries.findIndex(e => e.id === myEntry.id)
  const totalCount = activeEntries.length
  
  if (myIndex === -1 || totalCount === 0) return 0
  
  // If in consultation, show as 100%
  if (myEntry.status === 'in_consultation') return 100
  
  // Otherwise calculate progress based on position
  const progress = ((totalCount - myIndex) / totalCount) * 100
  return Math.round(progress)
}
