/**
 * Consultation Time Estimator
 * Predicts consultation duration based on patient and doctor factors
 * Uses historical data for improved accuracy
 */

import { differenceInMinutes } from 'date-fns'
import notificationService from '@/services/notificationService'
import { QueueEntry } from '@/types/queue'

// ─── BASE FACTORS ─────────────────────────────────────────────────────────────
const VISIT_TYPE_WEIGHTS: Record<string, number> = {
  first_visit: 1.5,
  follow_up: 1.0,
  emergency: 0.8,
  walk_in: 1.1,
}

const DEFAULT_CONSULTATION_TIME = 15 // minutes

const SYMPTOM_COMPLEXITY_MAP: Record<string, number> = {
  low: 0,      // 1-2 symptoms
  medium: 3,   // 3-5 symptoms
  high: 7,     // 6+ symptoms
}

const NEW_PATIENT_PENALTY = 5       // extra minutes for first-time patients
const FATIGUE_FACTOR_DIVISOR = 20  // patients per unit of fatigue
const FATIGUE_INCREMENT = 0.1      // 10% increase per fatigue unit

// Cache for doctor average times
const doctorAvgTimeCache = new Map<string, { time: number; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get doctor's average consultation time from history or use default
 */
export async function getDoctorAvgConsultationTime(doctorId: string, days = 7): Promise<number> {
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
export function clearDoctorAvgTimeCache(): void {
  doctorAvgTimeCache.clear()
}

/**
 * Predict consultation time for a patient
 */
export async function predictConsultationTime({
  doctorId,
  doctorAvgTime = DEFAULT_CONSULTATION_TIME,
  visitType = 'follow_up',
  symptomsCount = 1,
  isNewPatient = false,
  patientsSeenToday = 0,
}: {
  doctorId?: string;
  doctorAvgTime?: number;
  visitType?: string;
  symptomsCount?: number;
  isNewPatient?: boolean;
  patientsSeenToday?: number;
}): Promise<number> {
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
 */
export async function calculateEstimatedWait(queueAhead: QueueEntry[], doctorId: string | null = null, defaultConsultTime = DEFAULT_CONSULTATION_TIME): Promise<number> {
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
 */
export function calculateEstimatedWaitSync(queueAhead: QueueEntry[], defaultConsultTime = DEFAULT_CONSULTATION_TIME): number {
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
 */
export function getExpectedConsultationTime(now: Date | string, estimatedWaitMinutes: number): Date {
  const base = now instanceof Date ? now : new Date(now)
  return new Date(base.getTime() + estimatedWaitMinutes * 60 * 1000)
}

/**
 * Format wait time for display
 */
export function formatWaitTime(minutes: number): string {
  if (minutes <= 0) return 'Now'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

/**
 * Get consultation time summary for a queue entry
 */
export async function getQueueTimeSummary(entry: QueueEntry, queueAhead: QueueEntry[], doctorId: string | null = null) {
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
 */
export function getPatientsAheadCount(allEntries: QueueEntry[], patientId: string, doctorId: string | null = null): number {
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
 */
export function formatExpectedTime(date: Date | string): string {
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
 */
export function getDetailedWaitBreakdown(myEntry: QueueEntry, allEntries: QueueEntry[], defaultConsultTime = DEFAULT_CONSULTATION_TIME) {
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
  const breakdown: any[] = []
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
      patientName: entry.patient_name || entry.patient?.full_name || (entry as any).family_member?.name || 'Patient',
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
 */
export function calculateWaitConfidence(patientsAhead: number, avgConsultTime: number, historicalDataPoints = 0): number {
  let confidence = 70
  if (patientsAhead > 5) confidence -= 5
  if (patientsAhead > 10) confidence -= 5
  if (historicalDataPoints > 20) confidence += 10
  else if (historicalDataPoints > 10) confidence += 5
  if (avgConsultTime > 20) confidence -= 5
  return Math.max(20, Math.min(95, confidence))
}

/**
 * Get queue progress percentage
 */
export function getQueueProgress(myEntry: QueueEntry, allEntries: QueueEntry[]): number {
  if (!myEntry || !allEntries) return 0
  
  const activeEntries = allEntries
    .filter(e => e.status === 'waiting' || e.status === 'in_consultation')
    .sort((a, b) => b.priority_score - a.priority_score)
  
  const myIndex = activeEntries.findIndex(e => e.id === myEntry.id)
  const totalCount = activeEntries.length
  
  if (myIndex === -1 || totalCount === 0) return 0
  if (myEntry.status === 'in_consultation') return 100
  
  const progress = ((totalCount - myIndex) / totalCount) * 100
  return Math.round(progress)
}
