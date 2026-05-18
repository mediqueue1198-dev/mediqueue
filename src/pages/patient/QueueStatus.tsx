import { useEffect, useState } from 'react'
import { Clock, Activity, AlertCircle, Calendar, Footprints, Siren, ArrowRight, TrendingUp, Coffee } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { useQueue } from '@/hooks/useQueue'
import { useAuth } from '@/hooks/useAuth'
import { QUEUE_STATUS_CONFIG, QUEUE_TYPE_CONFIG } from '@/utils/helpers'
import { 
  formatWaitTime, 
  calculateEstimatedWaitSync, 
  getExpectedConsultationTime, 
  formatExpectedTime,
} from '@/utils/timeEstimator'
import { getCurrentPatient, sortQueue } from '@/utils/queueEngine'
import { Link } from 'react-router-dom'
import notificationService from '@/services/notificationService'
import { QueueEntry } from '@/types/queue'

// ─── DOCTOR BREAK COUNTDOWN ──────────────────────────────────────────────────
function useBreakCountdown(breakUntil: string | null | undefined) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!breakUntil) { setRemaining(0); return }
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(breakUntil).getTime() - new Date().getTime()) / 1000))
      setRemaining(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [breakUntil])

  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const resumeTime = breakUntil ? new Date(breakUntil).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''
  return { remaining, resumeTime, label: h > 0 ? `${h}h ${m}m` : `${m} min` }
}

// ─── DOCTOR BREAK BANNER ─────────────────────────────────────────────────────
interface DoctorBreakBannerProps {
  breakUntil: string | null;
  breakMessage: string | null;
}

function DoctorBreakBanner({ breakUntil, breakMessage }: DoctorBreakBannerProps) {
  const { remaining, resumeTime, label } = useBreakCountdown(breakUntil)
  return (
    <Card className="border-2 border-amber-300 bg-amber-50">
      <CardBody className="p-4 flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Coffee className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-amber-900 text-sm">Doctor is on a short break</p>
          <p className="text-xs text-amber-700 mt-0.5">
            {breakMessage || 'The doctor stepped away briefly.'}
          </p>
          {resumeTime && (
            <p className="text-xs font-semibold text-amber-800 mt-1">
              Estimated resume: {resumeTime}
              {remaining > 0 && <span className="font-normal text-amber-600 ml-1">(~{label} remaining)</span>}
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export default function QueueStatus() {
  const { user, profile } = useAuth()
  const { 
    entries, 
    myEntry, 
    myPosition, 
    myEstimatedWait, 
    myEstimatedWaitFormatted, 
    isLoading, 
    checkIn,
    waitBreakdown,
    queueProgress,
    doctorAvgTime,
    refreshQueue,
  } = useQueue()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await refreshQueue()
    setTimeout(() => setIsRefreshing(false), 1000)
    toast.success('Queue updated')
  }
  const [expectedTime, setExpectedTime] = useState<Date | null>(null)
  const [capacityWarning, setCapacityWarning] = useState(false)
  const [doctorBreak, setDoctorBreak] = useState<{ isOnBreak: boolean, breakUntil: string | null, breakMessage: string | null }>({ isOnBreak: false, breakUntil: null, breakMessage: null })

  useEffect(() => {
    const loadData = async () => {
      if (!myEntry?.doctor_id) return

      try {
        const capacity = await notificationService.checkDoctorCapacity(myEntry.doctor_id)
        setCapacityWarning(capacity?.capacity_reached || false)
      } catch (err) {
        console.error('Failed to check capacity:', err)
      }

      try {
        const { default: supabase } = await import('@/lib/supabase')
        const { data } = await supabase
          .from('doctors')
          .select('is_on_break, break_until, break_message')
          .eq('id', myEntry.doctor_id)
          .single()
        if (data) {
          const breakExpired = data.break_until && new Date(data.break_until) < new Date()
          setDoctorBreak({
            isOnBreak: (data.is_on_break && !breakExpired) || false,
            breakUntil: data.break_until,
            breakMessage: data.break_message,
          })
        }
      } catch (err) {
        console.error('Failed to fetch doctor break state:', err)
      }
    }

    if (myEntry?.doctor_id) {
      loadData()
      const id = setInterval(loadData, 30_000)
      return () => clearInterval(id)
    }
  }, [myEntry?.doctor_id])

  useEffect(() => {
    if (myEstimatedWait > 0) {
      const expected = getExpectedConsultationTime(new Date(), myEstimatedWait)
      setExpectedTime(expected)
    } else {
      setExpectedTime(null)
    }
  }, [myEstimatedWait])

  const handleCheckIn = async () => {
    if (!myEntry?.id) return
    await checkIn(myEntry.id)
  }

  const patientId = profile?.patient_id || user?.id
  const waitingEntries = entries.filter(e => e.status === 'waiting' || e.status === 'in_consultation')
  const patientsAhead = myPosition > 0 
    ? waitingEntries.filter(e => e.patient_id !== patientId).slice(0, myPosition - 1).length 
    : 0

  const getPositionInQueue = (entryId: string) => {
    const waiting = entries.filter(e => e.status === 'waiting')
    const index = waiting.findIndex(e => e.id === entryId)
    return index >= 0 ? index + 1 : 0
  }

  const getEstimatedWaitForEntry = (entry: QueueEntry) => {
    const entryIdx = waitingEntries.findIndex(e => e.id === entry.id)
    if (entryIdx === -1) return 0
    
    const entriesAhead = waitingEntries.slice(0, entryIdx)
    return calculateEstimatedWaitSync([...entriesAhead, entry] as any, doctorAvgTime)
  }

  const getQueueTypeIcon = (type: string) => {
    switch (type) {
      case 'emergency':
        return <Siren className="w-4 h-4" />
      case 'appointment':
        return <Calendar className="w-4 h-4" />
      case 'walk_in':
        return <Footprints className="w-4 h-4" />
      default:
        return null
    }
  }

  const getQueueTypeBadge = (type: string) => {
    const config = QUEUE_TYPE_CONFIG[type]
    if (!config) return null
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        type === 'emergency' ? 'bg-danger-100 text-danger-700' :
        type === 'appointment' ? 'bg-primary-100 text-primary-700' :
        'bg-surface-100 text-surface-600'
      }`}>
        {getQueueTypeIcon(type)}
        {config.label}
      </span>
    )
  }

  const doctorName = (myEntry as any)?.doctor?.user?.full_name || (myEntry as any)?.doctor?.name || 'Doctor'

  return (
    <DashboardLayout 
      title="Queue Status" 
      subtitle="Real-time queue position and wait time"
      actions={
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleManualRefresh}
          isLoading={isRefreshing}
          className="bg-white/50 backdrop-blur-sm"
        >
          <TrendingUp className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {isLoading ? (
          <LoadingSpinner className="py-12" label="Checking queue..." />
        ) : !myEntry ? (
          <EmptyState
            icon={Activity}
            title="You're not in any queue"
            description="Book an appointment or ask hospital staff to add you to a queue."
          />
        ) : (
          <>
            {/* Token Card */}
            <div className={`rounded-3xl p-8 text-center text-white shadow-lg relative overflow-hidden ${
              myEntry.status === 'in_consultation' ? 'gradient-medical' :
              myEntry.queue_type === 'emergency' ? 'gradient-danger' :
              'gradient-primary'
            }`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
              <div className="relative">
                <p className="text-white/70 text-sm font-medium mb-3">Your Token Number</p>
                <div className="w-24 h-24 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <span className="text-3xl font-bold font-display">{myEntry.token_number}</span>
                </div>
                {myEntry.status === 'in_consultation' ? (
                  <div>
                    <p className="text-2xl font-bold font-display mb-2">It's your turn!</p>
                    <p className="text-white/80 text-sm">Please proceed to the consultation room</p>
                  </div>
                ) : (
                  <div>

                    <p className="text-white/80 text-sm mb-2">
                      {myPosition <= 1 ? "You're next in line!" : `${patientsAhead} patient${patientsAhead !== 1 ? 's' : ''} ahead of you`}
                    </p>
                    <div className="inline-flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2">
                      <Clock className="w-4 h-4" />
                      <span className="font-semibold">~{myEstimatedWaitFormatted} wait</span>
                    </div>
                    
                    {/* Progress Bar */}
                    {queueProgress > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between text-xs text-white/60 mb-1">
                          <span>Queue Progress</span>
                          <span>{queueProgress}%</span>
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-white rounded-full transition-all duration-500"
                            style={{ width: `${queueProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Doctor Break Banner */}
            {doctorBreak.isOnBreak && (
              <DoctorBreakBanner
                breakUntil={doctorBreak.breakUntil}
                breakMessage={doctorBreak.breakMessage}
              />
            )}

            {/* Capacity Warning */}
            {capacityWarning && (
              <Card className="border-2 border-warning-300 bg-warning-50">
                <CardBody className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-warning-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-warning-800 text-sm">High Queue Volume</p>
                    <p className="text-xs text-warning-600">Doctor may not be able to attend all patients today.</p>
                  </div>
                  <Link to="/patient/book">
                    <Button variant="warning" size="sm">
                      Reschedule
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            )}

            {/* Check-in prompt */}
            {!myEntry.check_in_status && (
              <Card className="border-2 border-warning-300 bg-warning-50">
                <CardBody className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-warning-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-warning-800 text-sm">Check-in required</p>
                    <p className="text-xs text-warning-600">Please check in to confirm your presence</p>
                  </div>
                  <Button variant="warning" size="sm" onClick={handleCheckIn}>
                    Check In
                  </Button>
                </CardBody>
              </Card>
            )}

            {/* Status details */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardBody className="p-4 text-center">
                  <Activity className="w-6 h-6 text-primary-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold font-display text-surface-800">{myPosition || 0}</p>
                  <p className="text-xs text-surface-500">Position in Queue</p>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="p-4 text-center">
                  <Clock className="w-6 h-6 text-medical-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold font-display text-surface-800">{myEstimatedWaitFormatted}</p>
                  <p className="text-xs text-surface-500">Estimated Wait</p>
                </CardBody>
              </Card>
            </div>

            {/* Extended Info */}
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-surface-700">Queue Details</p>
                  <Badge
                    variant={(QUEUE_STATUS_CONFIG as any)[myEntry.status]?.color || 'neutral'}
                    dot
                    pulse={myEntry.status === 'in_consultation'}
                  >
                    {(QUEUE_STATUS_CONFIG as any)[myEntry.status]?.label}
                  </Badge>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-surface-500">Doctor</span>
                    <span className="font-medium text-surface-700">{doctorName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-surface-500">Queue Type</span>
                    <span className="font-medium text-surface-700">
                      {getQueueTypeBadge(myEntry.queue_type)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-surface-500">Check-in</span>
                    <span className={`font-medium ${myEntry.check_in_status ? 'text-medical-600' : 'text-warning-600'}`}>
                      {myEntry.check_in_status ? '✓ Checked In' : 'Not checked in'}
                    </span>
                  </div>
                  {expectedTime && (
                    <div className="flex justify-between items-center">
                      <span className="text-surface-500">Expected Consultation</span>
                      <span className="font-medium text-primary-600">
                        {formatExpectedTime(expectedTime)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-surface-500">Avg. Consultation</span>
                    <span className="font-medium text-surface-700">~{doctorAvgTime} min</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Wait Breakdown */}
            {waitBreakdown && waitBreakdown.patientsAhead > 0 && (
              <Card className="border border-primary-100">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-primary-600" />
                    Wait Time Breakdown
                  </CardTitle>
                </CardHeader>
                <CardBody className="p-4 pt-0">
                  <div className="space-y-2">
                    {waitBreakdown.breakdown.slice(0, 5).map((patient, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-surface-700">{patient.token}</span>
                          <span className="text-surface-500 truncate max-w-[120px]">
                            {patient.patientName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={patient.status === 'in_consultation' ? 'medical' : 'neutral'} size="sm">
                            {patient.status === 'in_consultation' ? 'In Progress' : 'Waiting'}
                          </Badge>
                          <span className="text-surface-500 text-xs">
                            ~{patient.estimatedMinutes} min
                          </span>
                        </div>
                      </div>
                    ))}
                    {waitBreakdown.patientsAhead > 5 && (
                      <p className="text-xs text-surface-500 text-center pt-2">
                        + {waitBreakdown.patientsAhead - 5} more patients ahead
                      </p>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-surface-100 flex justify-between items-center">
                    <span className="text-sm text-surface-600">Total estimated wait:</span>
                    <span className="font-bold text-primary-600">{formatWaitTime(waitBreakdown.totalEstimatedMinutes)}</span>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Full Queue List */}
            {waitingEntries.length > 0 && (
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="flex items-center justify-between">
                    <span>Queue Overview</span>
                    <span className="text-sm font-normal text-surface-500">{waitingEntries.length} patients in queue</span>
                  </CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-surface-100">
                    {sortQueue(waitingEntries as any).map((entry, idx) => {
                      const position = getPositionInQueue(entry.id)
                      const estimatedWait = getEstimatedWaitForEntry(entry as QueueEntry)
                      const isMe = entry.patient_id === patientId
                      
                      return (
                        <div 
                          key={entry.id} 
                          className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-primary-50' : 'hover:bg-surface-50'}`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            isMe ? 'bg-primary-600 text-white' :
                            entry.status === 'in_consultation' ? 'bg-medical-600 text-white' :
                            'bg-surface-100 text-surface-600'
                          }`}>
                            {entry.status === 'in_consultation' ? '🩺' : `#${position}`}
                          </div>
                          
                          <div className="w-16">
                            <p className="text-sm font-bold text-surface-800">{entry.token_number}</p>
                          </div>
                          
                          <div className="flex-1">
                            {getQueueTypeBadge(entry.queue_type)}
                          </div>
                          
                          <div className="text-right min-w-[80px]">
                            {entry.status === 'in_consultation' ? (
                              <span className="text-xs font-medium text-medical-600">In Progress</span>
                            ) : (
                              <span className="text-xs text-surface-500">~{formatWaitTime(estimatedWait)}</span>
                            )}
                          </div>
                          
                          <div className="min-w-[80px] text-right">
                            {entry.status === 'in_consultation' ? (
                              <Badge variant="medical" dot pulse>Now</Badge>
                            ) : isMe ? (
                              <Badge variant="primary" dot>You</Badge>
                            ) : (
                              <Badge variant="neutral" dot>Waiting</Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
