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
import { QueueEntry } from '@/types/queue'

export function useQueue(doctorId: string | null = null) {
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
    isOnBreak,
    breakUntil,
    breakMessage,
    toggleBreak,
    resumeFromBreak,
    manualReQueue,
    processSkippedPatients,
    noShowExpiresAt,
    currentCallingEntryId,
  } = useQueueStore()
  
  const { user, profile } = useAuth()

  const loadQueueRef = useRef(loadQueue)
  const recalculateRef = useRef(recalculate)
  
  useEffect(() => { loadQueueRef.current = loadQueue }, [loadQueue])
  useEffect(() => { recalculateRef.current = recalculate }, [recalculate])
  
  const [myEstimatedWait, setMyEstimatedWait] = useState(0)
  const [doctorAvgTime, setDoctorAvgTime] = useState(15)
  const [historicalDataPoints] = useState(0)

  const refreshQueue = useCallback(async () => {
    await loadQueueRef.current(doctorId)
  }, [doctorId])

  useEffect(() => {
    refreshQueue()
    const intervalId = setInterval(() => {
      refreshQueue()
    }, 60_000)
    return () => clearInterval(intervalId)
  }, [refreshQueue])

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

  const myEntry = useMemo(() => {
    if (!user) return null
    return filteredEntries.find(e => e.patient_id === user.id)
  }, [user, filteredEntries])

  const myPosition = useMemo(() => {
    if (!myEntry || !user) return 0
    return getPatientPosition(filteredEntries, user.id)
  }, [myEntry, filteredEntries, user])

  useEffect(() => {
    const fetchDoctorAvg = async () => {
      if (myEntry?.doctor_id) {
        const avg = await getDoctorAvgConsultationTime(myEntry.doctor_id)
        setDoctorAvgTime(avg || 15)
      }
    }
    fetchDoctorAvg()
  }, [myEntry?.doctor_id])

  useEffect(() => {
    const calculateWait = async () => {
      if (!myEntry) {
        setMyEstimatedWait(0)
        return
      }

      const sortedActive = sortQueue([...filteredEntries].filter(e => 
        e.status === 'waiting' || e.status === 'in_consultation'
      ))

      const myIndex = sortedActive.findIndex(e => e.id === myEntry.id)
      
      if (myIndex <= 0) {
        if (myEntry.status === 'in_consultation' && (myEntry as any).called_at) {
          const elapsed = Math.floor((Date.now() - new Date((myEntry as any).called_at).getTime()) / 60000)
          const remaining = Math.max(0, (myEntry.predicted_consultation_time || doctorAvgTime) - elapsed)
          setMyEstimatedWait(remaining)
        } else {
          setMyEstimatedWait(0)
        }
        return
      }

      const entriesAhead = sortedActive.slice(0, myIndex)
      const wait = calculateEstimatedWaitSync(entriesAhead, doctorAvgTime)
      setMyEstimatedWait(wait)
    }

    calculateWait()
    const interval = setInterval(calculateWait, 30_000)
    return () => clearInterval(interval)
  }, [myEntry, filteredEntries, doctorAvgTime])

  const waitConfidence = useMemo(() => {
    if (!myEntry) return 0
    return calculateWaitConfidence(myPosition, doctorAvgTime, historicalDataPoints)
  }, [myEntry, myPosition, doctorAvgTime, historicalDataPoints])

  const waitBreakdown = useMemo(() => {
    if (!myEntry) return null
    return getDetailedWaitBreakdown(myEntry, filteredEntries, doctorAvgTime)
  }, [myEntry, filteredEntries, doctorAvgTime])

  const queueProgress = useMemo(() => {
    return getQueueProgress(myEntry, filteredEntries)
  }, [myEntry, filteredEntries])

  const callNextPatient = useCallback(async () => {
    const targetDocId = doctorId || (profile?.doctor_id)
    if (targetDocId) return callNext(targetDocId)
  }, [doctorId, profile, callNext])

  const handleStatusChange = useCallback(async (entryId: string, status: string, extras = {}) => {
    await updateStatus(entryId, status, extras)
    setTimeout(() => recalculate(), 100)
  }, [updateStatus, recalculate])

  return {
    entries,
    filteredEntries,
    allEntries: entries,
    waitingEntries,
    skippedEntries,
    currentPatient,
    nextPatients,
    waitingCount,
    isLoading,
    error,
    myEntry,
    myPosition,
    myEstimatedWait,
    myEstimatedWaitFormatted: formatWaitTime(myEstimatedWait),
    waitConfidence,
    waitBreakdown,
    queueProgress,
    doctorAvgTime,
    isOnBreak,
    breakUntil,
    breakMessage,
    toggleBreak,
    resumeFromBreak,
    manualReQueue,
    processSkippedPatients,
    noShowExpiresAt,
    currentCallingEntryId,
    callNextPatient,
    handleStatusChange,
    updateStatus,
    checkIn,
    addWalkIn,
    recalculate,
    refreshQueue,
  }
}

export default useQueue
