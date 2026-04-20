import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChevronRight, SkipForward, Phone, TriangleAlert, CheckCheck,
  UserX, Clock, Timer, Coffee, Play, PauseCircle, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import { LoadingSpinner, PageLoader } from '@/components/ui/LoadingSpinner'
import { useQueue } from '@/hooks/useQueue'
import { useAuth } from '@/hooks/useAuth'
import { useDoctorProfile } from '@/hooks/useDoctorProfile'
import { QUEUE_STATUS_CONFIG, QUEUE_TYPE_CONFIG, formatRelativeTime } from '@/utils/helpers'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import notificationService from '@/services/notificationService'
import { useQueueStore } from '@/store/queueStore'
import { QueueEntry } from '@/types/queue'

const NO_SHOW_TIMEOUT_SECONDS = 300 // 5 minutes
const BREAK_DURATIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: 'Custom', value: 'custom' },
]

// ─── BREAK COUNTDOWN HOOK ────────────────────────────────────────────────────
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

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  return { remaining, formatted: `${mins}:${secs.toString().padStart(2, '0')}` }
}

// ─── BREAK MODAL ─────────────────────────────────────────────────────────────
interface BreakModalProps {
  onClose: () => void;
  onConfirm: (duration: number, message: string) => void;
}

function BreakModal({ onClose, onConfirm }: BreakModalProps) {
  const [selected, setSelected] = useState<number | null>(15)
  const [custom, setCustom] = useState('')
  const [message, setMessage] = useState('')
  const [isCustom, setIsCustom] = useState(false)

  const handleSelect = (val: number | string) => {
    if (val === 'custom') { setIsCustom(true); setSelected(null) }
    else { setIsCustom(false); setSelected(val as number) }
  }

  const duration = isCustom ? parseInt(custom || '15', 10) : selected

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
            <Coffee className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-surface-900">Take a Break</h3>
            <p className="text-sm text-surface-500">Queue will be paused</p>
          </div>
        </div>

        {/* Duration Options */}
        <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
          Break Duration
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {BREAK_DURATIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              className={`py-3 px-4 rounded-xl text-sm font-semibold border-2 transition-all ${
                (value !== 'custom' && selected === value && !isCustom) ||
                (value === 'custom' && isCustom)
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-surface-200 text-surface-600 hover:border-surface-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom input */}
        {isCustom && (
          <div className="mb-4">
            <input
              type="number"
              min={1}
              max={240}
              placeholder="Minutes (e.g. 45)"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              className="w-full border-2 border-surface-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary-400"
            />
          </div>
        )}

        {/* Message */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Optional message for patients..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full border-2 border-surface-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary-400"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 !bg-amber-500 hover:!bg-amber-600 text-white"
            onClick={() => {
              if (!duration || duration < 1) {
                toast.error('Please select a valid duration')
                return
              }
              onConfirm(duration, message)
              onClose()
            }}
          >
            <PauseCircle className="w-4 h-4 mr-1" />
            Start Break
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── ACTIVE BREAK BANNER ─────────────────────────────────────────────────────
interface BreakBannerProps {
  breakUntil?: string | null;
  breakMessage?: string | null;
  onResume: () => void;
}

function BreakBanner({ breakUntil, breakMessage, onResume }: BreakBannerProps) {
  const { formatted, remaining } = useBreakCountdown(breakUntil)
  const isUrgent = remaining < 60

  return (
    <div className={`rounded-2xl p-4 border-2 flex items-center gap-4 ${
      isUrgent
        ? 'bg-amber-50 border-amber-400'
        : 'bg-amber-50 border-amber-300'
    }`}>
      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <Coffee className={`w-5 h-5 text-amber-600 ${isUrgent ? 'animate-pulse' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-amber-900 text-sm">You're on a break</p>
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
            isUrgent ? 'bg-amber-300 text-amber-900' : 'bg-amber-200 text-amber-800'
          }`}>
            {formatted}
          </span>
        </div>
        <p className="text-xs text-amber-700 mt-0.5 truncate">
          {breakMessage || 'Queue is paused — patients are being notified'}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="flex-shrink-0 text-amber-700 border border-amber-300 hover:bg-amber-100"
        onClick={onResume}
      >
        <Play className="w-3.5 h-3.5 mr-1" />
        Resume
      </Button>
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function DoctorQueue() {
  const { user } = useAuth()
  const { doctor, isLoading: isDoctorLoading } = useDoctorProfile(user?.id)
  const {
    allEntries,
    waitingCount,
    isLoading,
    callNextPatient,
    updateStatus,
    manualReQueue,
    noShowExpiresAt,
    currentCallingEntryId,
    isOnBreak,
    breakUntil,
    breakMessage,
    toggleBreak,
    resumeFromBreak,
  } = useQueue(doctor?.id)

  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [capacityWarning, setCapacityWarning] = useState(false)
  const [showBreakModal, setShowBreakModal] = useState(false)
  const [showSkipped, setShowSkipped] = useState(false)
  const timerRef = useRef<any>(null)

  // ─── Derived lists ──────────────────────────────────────────────────────
  const activeEntries = (allEntries || []).filter(e => ['waiting', 'in_consultation'].includes(e.status))
  const skippedEntries = (allEntries || []).filter(e => e.status === 'skipped')

  // ─── Handlers ──────────────────────────────────────────────────────────
  const handleNoShow = async (entry: QueueEntry) => {
    await updateStatus(entry.id, 'no_show', { arrival_status: 'no_show' })
    toast.error(`${entry.token_number} marked as no-show`)
  }

  const handleCallNext = async () => {
    if (isOnBreak) {
      toast.error('Resume from break before calling the next patient')
      return
    }
    try {
      const next = await callNextPatient()
      if (next) {
        toast.success(`Calling ${next.patient_name || next.patient?.full_name || next.token_number}`)
      } else {
        toast('No more patients in queue')
      }
    } catch {
      toast.error('Failed to call next patient')
    }
  }

  const handleSkip = async (entry: QueueEntry) => {
    await updateStatus(entry.id, 'skipped', { skipped_at: new Date().toISOString() })
    toast(`${entry.token_number} skipped — will auto-return in 10 min`, { icon: '⏩' })
  }

  const handleComplete = async (entry: QueueEntry) => {
    await updateStatus(entry.id, 'completed', { completed_at: new Date().toISOString() })
    toast.success('Consultation completed')

    try {
      if (doctor?.id) {
        const result = await notificationService.checkDoctorCapacity(doctor.id)
        setCapacityWarning(result?.capacity_reached || false)
      }
    } catch (err) {
      console.error('Failed to check capacity:', err)
    }
  }

  const handleBreakConfirm = (duration: number, message: string) => {
    if (doctor?.id) toggleBreak(doctor.id, duration, message)
  }

  const handleResume = () => {
    if (doctor?.id) {
      resumeFromBreak(doctor.id)
      toast.success('Break ended. Queue is active.')
    }
  }

  const checkCapacity = useCallback(async () => {
    if (!doctor?.id) return
    try {
      const result = await notificationService.checkDoctorCapacity(doctor.id)
      setCapacityWarning(result?.capacity_reached || false)
    } catch (err) {
      console.error('Failed to check capacity:', err)
    }
  }, [doctor?.id])

  useEffect(() => {
    checkCapacity()
  }, [checkCapacity])

  // ─── Centralized No-show countdown tick ───────────────────────────────────
  useEffect(() => {
    if (!noShowExpiresAt) {
      setRemainingSeconds(0)
      return
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(noShowExpiresAt).getTime() - Date.now()) / 1000))
      setRemainingSeconds(diff)
    }

    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [noShowExpiresAt])

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const queueTypeColor = (type: string) => {
    if (type === 'emergency') return 'danger'
    if (type === 'appointment') return 'primary'
    return 'warning'
  }

  if (isDoctorLoading) return <PageLoader />

  return (
    <DashboardLayout
      title="My Queue (v2.1)"
      subtitle={
        isOnBreak
          ? '⏸ Queue paused — on break'
          : `${waitingCount} patient${waitingCount !== 1 ? 's' : ''} waiting`
      }
    >
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Break Modal */}
        {showBreakModal && (
          <BreakModal
            onClose={() => setShowBreakModal(false)}
            onConfirm={handleBreakConfirm}
          />
        )}

        {/* Active Break Banner */}
        {isOnBreak && (
          <BreakBanner
            breakUntil={breakUntil}
            breakMessage={breakMessage}
            onResume={handleResume}
          />
        )}

        {/* Capacity Warning */}
        {capacityWarning && (
          <Card className="border-2 border-warning-300 bg-warning-50">
            <CardBody className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-warning-100 rounded-xl flex items-center justify-center">
                <TriangleAlert className="w-5 h-5 text-warning-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-warning-800 text-sm">Queue Capacity Exceeded</p>
                <p className="text-xs text-warning-600">
                  Queue length exceeds daily capacity. Some patients may need to reschedule.
                </p>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-surface-500">
              {waitingCount} in queue
              &nbsp;•&nbsp;
              {(allEntries || []).filter(e => e.check_in_status).length} checked in
              {skippedEntries.length > 0 && (
                <span className="ml-2 text-warning-600">
                  • {skippedEntries.length} skipped
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Break toggle */}
            {isOnBreak ? (
              <Button
                variant="outline"
                onClick={handleResume}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <Play className="w-4 h-4 mr-1" />
                Resume Queue
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowBreakModal(true)}
                className="border-surface-300 text-surface-600"
              >
                <Coffee className="w-4 h-4 mr-1" />
                Take a Break
              </Button>
            )}

            <Button
              onClick={handleCallNext}
              size="lg"
              disabled={isOnBreak}
              className={`shadow-glow-green !bg-medical-600 hover:!bg-medical-700 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <ChevronRight className="w-4 h-4" />
              Call Next Patient
            </Button>

            <Link to="/doctor/consultation">
              <Button variant="outline">Open Consultation Screen</Button>
            </Link>
          </div>
        </div>

        {/* Main Queue List */}
        {isLoading ? (
          <LoadingSpinner className="py-12" label="Loading queue..." />
        ) : activeEntries.length === 0 && !isOnBreak ? (
          <EmptyState icon={CheckCheck} title="Queue is empty" description="No patients currently waiting." />
        ) : (
          <div className="space-y-3">
            {activeEntries.map((entry, idx) => (
              <Card
                key={entry.id}
                className={entry.status === 'in_consultation' ? 'border-2 border-primary-400 shadow-glow' : ''}
              >
                <CardBody className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Position badge */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      entry.status === 'in_consultation'
                        ? 'bg-primary-600 text-white'
                        : entry.queue_type === 'emergency'
                          ? 'bg-danger-100 text-danger-700'
                          : 'bg-surface-100 text-surface-600'
                    }`}>
                      {entry.status === 'in_consultation' ? '▶' : idx + 1}
                    </div>

                    <Avatar
                      name={entry.family_member?.name || entry.patient?.user?.full_name || entry.patient_name || entry.patient?.patient_name || 'Patient'}
                      size="sm"
                      className="flex-shrink-0"
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-surface-800">
                            {entry.family_member?.name || entry.patient?.user?.full_name || entry.patient_name || entry.patient?.patient_name || 'Patient'}
                            {entry.family_member && (
                              <span className="text-xs font-normal text-surface-500 ml-2">
                                ({entry.family_member.relationship})
                              </span>
                            )}
                          </p>
                          {entry.symptoms && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-tight">Reason:</span>
                              <span className="text-xs text-surface-600 bg-surface-50 px-2 py-0.5 rounded-md border border-surface-100">
                                {entry.symptoms}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-surface-500">{entry.token_number}</span>
                            <Badge variant={queueTypeColor(entry.queue_type)}>
                              {QUEUE_TYPE_CONFIG[entry.queue_type]?.icon}{' '}
                              {QUEUE_TYPE_CONFIG[entry.queue_type]?.label}
                            </Badge>
                            <Badge
                              variant={QUEUE_STATUS_CONFIG[entry.status]?.color || 'neutral'}
                              dot
                              pulse={entry.status === 'in_consultation'}
                            >
                              {QUEUE_STATUS_CONFIG[entry.status]?.label}
                            </Badge>
                            {/* No-show risk badge */}
                            {(entry.patient?.no_show_rate || 0) >= 0.3 && (
                              <Badge variant="warning" className="text-xs">
                                ⚠ No-show risk
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-surface-500">
                            ~{entry.predicted_consultation_time} min
                          </p>
                          <p className="text-xs text-surface-400">
                            Score: {entry.priority_score}
                          </p>
                          {!entry.check_in_status && (
                            <Badge variant="warning" className="mt-1">Not Checked In</Badge>
                          )}
                        </div>
                      </div>

                      {/* No-show countdown */}
                      {currentCallingEntryId === entry.id && remainingSeconds > 0 && (
                        <div className="mt-3 flex items-center gap-2 p-2 bg-danger-50 rounded-lg border border-danger-200">
                          <Timer className={`w-4 h-4 ${remainingSeconds < 60 ? 'text-danger-600 animate-pulse' : 'text-danger-500'}`} />
                          <span className="text-sm font-medium text-danger-700">
                            Patient arrival window: {formatCountdown(remainingSeconds)}
                          </span>
                          {remainingSeconds < 60 && (
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleNoShow(entry)}
                              className="text-danger-600 hover:bg-danger-50"
                            >
                              <UserX className="w-3.5 h-3.5" /> No Show
                            </Button>
                          </>
                        )}
                        {(entry.patient_phone || (entry.patient as any)?.phone) && (
                          <Button variant="ghost" size="sm" className="text-primary-600">
                            <Phone className="w-3.5 h-3.5" />
                            {entry.patient_phone || (entry.patient as any)?.phone}
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

        {/* ─── Skipped Patients Section ─────────────────────────────────── */}
        {skippedEntries.length > 0 && (
          <Card className="border border-warning-200">
            <CardBody className="p-0">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 transition-colors rounded-2xl"
                onClick={() => setShowSkipped(v => !v)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-warning-100 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-warning-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-surface-800">
                      Skipped Patients ({skippedEntries.length})
                    </p>
                    <p className="text-xs text-surface-500">
                      Auto re-queued after 10 min • Click to manage
                    </p>
                  </div>
                </div>
                {showSkipped
                  ? <ChevronUp className="w-4 h-4 text-surface-400" />
                  : <ChevronDown className="w-4 h-4 text-surface-400" />
                }
              </button>

              {showSkipped && (
                <div className="border-t border-surface-100 divide-y divide-surface-100">
                  {skippedEntries.map(entry => {
                    const skippedAt = entry.skipped_at ? new Date(entry.skipped_at) : null
                    const minsSkipped = skippedAt
                      ? Math.floor((Date.now() - skippedAt.getTime()) / 60000)
                      : null

                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                        <Avatar
                          name={entry.family_member?.name || entry.patient?.user?.full_name || entry.patient_name || entry.patient?.patient_name || 'Patient'}
                          size="xs"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-700 truncate">
                            {entry.family_member?.name || entry.patient?.user?.full_name || entry.patient_name || entry.patient?.patient_name || 'Patient'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-surface-400">{entry.token_number}</span>
                            {minsSkipped !== null && (
                              <span className={`text-xs ${minsSkipped >= 8 ? 'text-warning-600 font-medium' : 'text-surface-400'}`}>
                                {minsSkipped}m ago
                                {minsSkipped >= 8 && ' (re-queue soon)'}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-medical-600 hover:bg-medical-50 border border-medical-200 flex-shrink-0"
                          onClick={() => manualReQueue(entry.id)}
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          Re-add
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
