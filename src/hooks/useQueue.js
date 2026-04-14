import { useEffect, useCallback, useState, useMemo, useRef } from 'react'
import { useQueueStore } from '@/store/queueStore'
import { useAuth } from './useAuth'
import { getPatientPosition, getNextPatients, getCurrentPatient, getWaitingCount, sortQueue } from '@/utils/queueEngine'
import { 
  calculateEstimatedWaitSync, 
  formatWaitTime, 
  getDoctorAvgConsultationTime,
  getDetailedWaitBreakdown,
  calculateWaitConfidence,
  getQueueProgress,
} from '@/utils/timeEstimator'

export function useQueue(doctorId = null) {
  const { 
    entries, 
    isLoading, 
    error, 
    loadQueue, 
    callNext, 
    updateStatus, 
    checkIn, 
    addWalkIn, 
    recalculate,
    // Break mode
    isOnBreak,
    breakUntil,
    breakMessage,
    toggleBreak,
    resumeFromBreak,
    // Skipped re-queue
    manualReQueue,
    processSkippedPatients,
  } = useQueueStore()
  const { user, isDoctor, profile } = useAuth()

  // Stable refs to avoid stale-closure issues in effects
  const loadQueueRef = useRef(loadQueue)
  const recalculateRef = useRef(recalculate)
  useEffect(() => { loadQueueRef.current = loadQueue }, [loadQueue])
  useEffect(() => { recalculateRef.current = recalculate }, [recalculate])
  
  const [myEstimatedWait, setMyEstimatedWait] = useState(0)
  const [doctorAvgTime, setDoctorAvgTime] = useState(15)
  const [historicalDataPoints, setHistoricalDataPoints] = useState(0)

  // Load queue on mount / doctorId change only.
  // Bug 10 fix: loadQueue & recalculate intentionally excluded from deps —
  // they are Zustand actions whose references change on every store update,
  // which would cause an infinite request loop if included.
  useEffect(() => {
    loadQueueRef.current(doctorId)
    const interval = setInterval(() => {
      recalculateRef.current()
    }, 120_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId])

  // Filter entries by doctor
  const filteredEntries = useMemo(() => {
    return doctorId
      ? entries.filter(e => e.doctor_id === doctorId)
      : entries
  }, [entries, doctorId])

  const waitingEntries = useMemo(() => 
    filteredEntries.filter(e => e.status === 'waiting'), 
  [filteredEntries])

  const skippedEntries = useMemo(() =>
    filteredEntries.filter(e => e.status === 'skipped'),
  [filteredEntries])

  const currentPatient = useMemo(() => 
    getCurrentPatient(filteredEntries), 
  [filteredEntries])

  const nextPatients = useMemo(() => 
    getNextPatients(filteredEntries, 3), 
  [filteredEntries])

  const waitingCount = useMemo(() => 
    getWaitingCount(filteredEntries), 
  [filteredEntries])

  // Get patient's queue entry and position.
  // Bug 5 fix: queue_entries.patient_id stores the patients table UUID (profile.patient_id),
  // NOT the Supabase auth UID (user.id). Using user.id here always returned null.
  const myEntry = useMemo(() => {
    if (!user) return null
    const patientId = profile?.patient_id || user.id
    return filteredEntries.find(e => e.patient_id === patientId)
  }, [user, profile, filteredEntries])

  const myPosition = useMemo(() => {
    if (!myEntry) return 0
    const patientId = profile?.patient_id || user?.id
    return getPatientPosition(filteredEntries, patientId)
  }, [myEntry, filteredEntries, user, profile])

  // Fetch doctor average consultation time
  useEffect(() => {
    const fetchDoctorAvg = async () => {
      if (myEntry?.doctor_id) {
        const avg = await getDoctorAvgConsultationTime(myEntry.doctor_id)
        setDoctorAvgTime(avg || 15)
      }
    }
    fetchDoctorAvg()
  }, [myEntry?.doctor_id])

  // Calculate estimated wait with improved logic
  useEffect(() => {
    const calculateWait = async () => {
      if (!myEntry) {
        setMyEstimatedWait(0)
        return
      }

      // Get all active entries (waiting + in_consultation) sorted by priority
      const sortedActive = sortQueue([...filteredEntries].filter(e => 
        e.status === 'waiting' || e.status === 'in_consultation'
      ))

      // Find my index in the sorted queue
      const myIndex = sortedActive.findIndex(e => e.id === myEntry.id)
      
      // If I'm at position 0 or in consultation, wait is 0 or remaining time
      if (myIndex <= 0) {
        if (myEntry.status === 'in_consultation' && myEntry.called_at) {
          // Calculate remaining consultation time
          const elapsed = Math.floor((Date.now() - new Date(myEntry.called_at).getTime()) / 60000)
          const remaining = Math.max(0, (myEntry.predicted_consultation_time || doctorAvgTime) - elapsed)
          setMyEstimatedWait(remaining)
        } else {
          setMyEstimatedWait(0)
        }
        return
      }

      // Get entries ahead of me
      const entriesAhead = sortedActive.slice(0, myIndex)
      const wait = calculateEstimatedWaitSync(entriesAhead, doctorAvgTime)
      setMyEstimatedWait(wait)
    }

    calculateWait()

    // Update every 30 seconds for real-time feel
    const interval = setInterval(calculateWait, 30_000)
    return () => clearInterval(interval)
  }, [myEntry, filteredEntries, doctorAvgTime])

  // Calculate wait confidence
  const waitConfidence = useMemo(() => {
    if (!myEntry) return 0
    return calculateWaitConfidence(myPosition, doctorAvgTime, historicalDataPoints)
  }, [myEntry, myPosition, doctorAvgTime, historicalDataPoints])

  // Get detailed wait breakdown
  const waitBreakdown = useMemo(() => {
    if (!myEntry) return null
    return getDetailedWaitBreakdown(myEntry, filteredEntries, doctorAvgTime)
  }, [myEntry, filteredEntries, doctorAvgTime])

  // Get queue progress
  const queueProgress = useMemo(() => {
    return getQueueProgress(myEntry, filteredEntries)
  }, [myEntry, filteredEntries])

  const callNextPatient = useCallback(async () => {
    const targetDocId = doctorId || (profile?.doctor_id)
    if (targetDocId) return callNext(targetDocId)
  }, [doctorId, profile, callNext])

  // Handle status change with recalculation
  const handleStatusChange = useCallback(async (entryId, status, extras = {}) => {
    await updateStatus(entryId, status, extras)
    // Recalculate after status change
    setTimeout(() => recalculate(), 100)
  }, [updateStatus, recalculate])

  return {
    entries: filteredEntries,
    waitingEntries,
    skippedEntries,
    currentPatient,
    nextPatients,
    waitingCount,
    isLoading,
    error,
    // Patient-specific
    myEntry,
    myPosition,
    myEstimatedWait,
    myEstimatedWaitFormatted: formatWaitTime(myEstimatedWait),
    waitConfidence,
    waitBreakdown,
    queueProgress,
    doctorAvgTime,
    // Break mode
    isOnBreak,
    breakUntil,
    breakMessage,
    toggleBreak,
    resumeFromBreak,
    // Skipped re-queue
    manualReQueue,
    processSkippedPatients,
    // Actions
    callNextPatient,
    handleStatusChange,
    updateStatus,
    checkIn,
    addWalkIn,
    recalculate,
  }
}

export default useQueue