import { useState, useEffect, useRef } from 'react'
import { ChevronRight, SkipForward, Phone, TriangleAlert, CheckCheck, UserX, Clock, Timer } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useQueue } from '@/hooks/useQueue'
import { useAuth } from '@/hooks/useAuth'
import { useDoctorProfile } from '@/hooks/useDoctorProfile'
import { QUEUE_STATUS_CONFIG, QUEUE_TYPE_CONFIG, formatRelativeTime } from '@/utils/helpers'
import { formatWaitTime } from '@/utils/timeEstimator'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import notificationService from '@/services/notificationService'

const NO_SHOW_TIMEOUT_SECONDS = 300 // 5 minutes

export default function DoctorQueue() {
  const { user } = useAuth()
  const { doctor, isLoading: isDoctorLoading } = useDoctorProfile(user?.id)
  const { entries, currentPatient, nextPatients, waitingCount, isLoading, callNextPatient, updateStatus } = useQueue(doctor?.id)
  
  const [calledPatient, setCalledPatient] = useState(null)
  const [countdown, setCountdown] = useState(NO_SHOW_TIMEOUT_SECONDS)
  const [capacityWarning, setCapacityWarning] = useState(false)
  const timerRef = useRef(null)

  const handleNoShow = async (entry) => {
    await updateStatus(entry.id, 'no_show', { arrival_status: 'no_show' })
    toast.error(`${entry.token_number} marked as no-show`)
    setCalledPatient(null)
    setCountdown(NO_SHOW_TIMEOUT_SECONDS)
  }

  const handleCallNext = async () => {
    try {
      const next = await callNextPatient()
      if (next) {
        toast.success(`Calling ${next.patient?.full_name || next.token_number}`)
        setCalledPatient(next)
        setCountdown(NO_SHOW_TIMEOUT_SECONDS)
      } else {
        toast('No more patients in queue')
      }
    } catch {
      toast.error('Failed to call next patient')
    }
  }

  const handleSkip = async (entry) => {
    await updateStatus(entry.id, 'skipped')
    toast(`${entry.token_number} skipped`)
  }

  const handleComplete = async (entry) => {
    await updateStatus(entry.id, 'completed', { completed_at: new Date().toISOString() })
    toast.success('Consultation completed')
    setCalledPatient(null)
    setCountdown(NO_SHOW_TIMEOUT_SECONDS)
    
    // Check capacity after completion
    try {
      const result = await notificationService.checkDoctorCapacity(doctor?.id)
      setCapacityWarning(result?.capacity_reached || false)
    } catch (err) {
      console.error('Failed to check capacity:', err)
    }
  }

  // Check capacity on mount
  useEffect(() => {
    const checkCapacity = async () => {
      if (!doctor?.id) return
      try {
        const result = await notificationService.checkDoctorCapacity(doctor.id)
        setCapacityWarning(result?.capacity_reached || false)
      } catch (err) {
        console.error('Failed to check capacity:', err)
      }
    }
    checkCapacity()
  }, [doctor?.id])

  // Countdown timer for called patient
  useEffect(() => {
    if (calledPatient && countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown(prev => prev - 1)
      }, 1000)
    } else if (calledPatient && countdown === 0) {
      // Auto mark as no-show
      handleNoShow(calledPatient)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [calledPatient, countdown])

  // Update called patient from entries
  useEffect(() => {
    const inConsultation = entries.find(e => e.status === 'in_consultation')
    if (inConsultation && inConsultation.called_at) {
      setCalledPatient(inConsultation)
      // Calculate remaining time
      const calledAt = new Date(inConsultation.called_at)
      const elapsed = Math.floor((Date.now() - calledAt.getTime()) / 1000)
      const remaining = Math.max(0, NO_SHOW_TIMEOUT_SECONDS - elapsed)
      setCountdown(remaining)
    } else {
      setCalledPatient(null)
      setCountdown(NO_SHOW_TIMEOUT_SECONDS)
    }
  }, [entries])

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isDoctorLoading) return <PageLoader />



  const queueTypeColor = (type) => {
    if (type === 'emergency') return 'danger'
    if (type === 'appointment') return 'primary'
    return 'warning'
  }

  return (
    <DashboardLayout title="My Queue" subtitle={`${waitingCount} patients waiting`}>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Capacity Warning */}
        {capacityWarning && (
          <Card className="border-2 border-warning-300 bg-warning-50">
            <CardBody className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center">
                <TriangleAlert className="w-5 h-5 text-warning-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-warning-800 text-sm">Queue Capacity Exceeded</p>
                <p className="text-xs text-warning-600">Queue length exceeds daily capacity. Some patients may need to reschedule.</p>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Call Next Button */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-surface-500">{waitingCount} in queue • {entries.filter(e => e.check_in_status).length} checked in</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCallNext} size="lg" className="shadow-glow-green !bg-medical-600 hover:!bg-medical-700">
              <ChevronRight className="w-4 h-4" />
              Call Next Patient
            </Button>
            <Link to="/doctor/consultation">
              <Button variant="outline">Open Consultation Screen</Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-12" label="Loading queue..." />
        ) : entries.filter(e => ['waiting','in_consultation'].includes(e.status)).length === 0 ? (
          <EmptyState icon={CheckCheck} title="Queue is empty" description="No patients currently waiting." />
        ) : (
          <div className="space-y-3">
            {entries
              .filter(e => ['waiting', 'in_consultation'].includes(e.status))
              .map((entry, idx) => (
                <Card 
                  key={entry.id} 
                  className={entry.status === 'in_consultation' ? 'border-2 border-primary-400 shadow-glow' : ''}
                >
                  <CardBody className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Position */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        entry.status === 'in_consultation' ? 'bg-primary-600 text-white' :
                        entry.queue_type === 'emergency' ? 'bg-danger-100 text-danger-700' :
                        'bg-surface-100 text-surface-600'
                      }`}>
                        {entry.status === 'in_consultation' ? '▶' : idx + 1}
                      </div>

                      {/* Avatar */}
                      <Avatar name={entry.family_member?.name || entry.patient?.full_name || 'Patient'} size="sm" className="flex-shrink-0" />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-surface-800">
                              {entry.family_member?.name || entry.patient?.full_name || 'Patient'}
                              {entry.family_member && <span className="text-xs font-normal text-surface-500 ml-2">({entry.family_member.relationship})</span>}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-surface-500">{entry.token_number}</span>
                              <Badge variant={queueTypeColor(entry.queue_type)}>
                                {QUEUE_TYPE_CONFIG[entry.queue_type]?.icon} {QUEUE_TYPE_CONFIG[entry.queue_type]?.label}
                              </Badge>
                              <Badge
                                variant={QUEUE_STATUS_CONFIG[entry.status]?.color || 'neutral'}
                                dot
                                pulse={entry.status === 'in_consultation'}
                              >
                                {QUEUE_STATUS_CONFIG[entry.status]?.label}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-surface-500">~{entry.predicted_consultation_time} min</p>
                            <p className="text-xs text-surface-400">Score: {entry.priority_score}</p>
                            {!entry.check_in_status && (
                              <Badge variant="warning" className="mt-1">Not Checked In</Badge>
                            )}
                          </div>
                        </div>

                        {/* No-show timer for called patient */}
                        {calledPatient?.id === entry.id && countdown < NO_SHOW_TIMEOUT_SECONDS && (
                          <div className="mt-3 flex items-center gap-2 p-2 bg-danger-50 rounded-lg border border-danger-200">
                            <Timer className={`w-4 h-4 ${countdown < 60 ? 'text-danger-600 animate-pulse' : 'text-danger-500'}`} />
                            <span className="text-sm font-medium text-danger-700">
                              Patient arrival: {formatCountdown(countdown)}
                            </span>
                            {countdown < 60 && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleNoShow(entry)}
                                className="text-danger-600 hover:bg-danger-100 ml-auto"
                              >
                                Mark No-Show
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {entry.status === 'in_consultation' && (
                            <Button variant="success" size="sm" onClick={() => handleComplete(entry)}>
                              <CheckCheck className="w-3.5 h-3.5" /> Complete
                            </Button>
                          )}
                          {entry.status === 'waiting' && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleSkip(entry)}>
                                <SkipForward className="w-3.5 h-3.5" /> Skip
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleNoShow(entry)} className="text-danger-600 hover:bg-danger-50">
                                <UserX className="w-3.5 h-3.5" /> No Show
                              </Button>
                            </>
                          )}
                          {entry.patient?.phone && (
                            <Button variant="ghost" size="sm" className="text-primary-600">
                              <Phone className="w-3.5 h-3.5" />
                              {entry.patient.phone}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
