import { useEffect, useState } from 'react'
import { SkipForward, ArrowUp, ArrowDown, Trash2, TriangleAlert, Activity, Filter } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Input'
import { useQueueStore } from '@/store/queueStore'
import { QUEUE_STATUS_CONFIG, QUEUE_TYPE_CONFIG, formatRelativeTime } from '@/utils/helpers'
import toast from 'react-hot-toast'

export default function QueueControl() {
  const { entries, loadQueue, updateStatus, changePriority } = useQueueStore()
  const [doctorFilter, setDoctorFilter] = useState('')
  const [doctors, setDoctors] = useState([])

  useEffect(() => { 
    loadQueue() 
    import('@/services/doctors.service').then(({ doctorsService }) => {
      doctorsService.getAll().then(setDoctors)
    })
  }, [])

  const filtered = doctorFilter
    ? entries.filter(e => e.doctor_id === doctorFilter)
    : entries

  const activeEntries = filtered.filter(e => ['waiting', 'in_consultation'].includes(e.status))

  const handleBoostPriority = async (entry) => {
    const newScore = entry.priority_score + 100
    await changePriority(entry.id, newScore)
    toast.success(`${entry.token_number} priority boosted`)
  }

  const handleLowerPriority = async (entry) => {
    const newScore = Math.max(0, entry.priority_score - 50)
    await changePriority(entry.id, newScore)
    toast(`${entry.token_number} priority lowered`)
  }

  const handleCancel = async (entry) => {
    if (!window.confirm(`Cancel token ${entry.token_number}?`)) return
    await updateStatus(entry.id, 'cancelled')
    toast.error(`${entry.token_number} cancelled`)
  }

  const handleMarkEmergency = async (entry) => {
    await changePriority(entry.id, 650)
    toast.success(`${entry.token_number} marked as EMERGENCY`)
  }

  return (
    <DashboardLayout title="Queue Control Panel" subtitle="Manage and adjust the hospital queue">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <Select
            value={doctorFilter}
            onChange={e => setDoctorFilter(e.target.value)}
            className="max-w-[250px]"
          >
            <option value="">All Doctors</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.user?.full_name}</option>
            ))}
          </Select>
          <div className="flex gap-2 ml-auto">
            <Badge variant="neutral">{activeEntries.length} active</Badge>
            <Badge variant="warning">{activeEntries.filter(e => e.status === 'waiting').length} waiting</Badge>
            <Badge variant="danger">{activeEntries.filter(e => e.queue_type === 'emergency').length} emergency</Badge>
          </div>
        </div>

        {activeEntries.length === 0 ? (
          <EmptyState icon={Activity} title="Queue is empty" description="No active patients in the selected queue." />
        ) : (
          <div className="space-y-3">
            {activeEntries.map((entry, idx) => (
              <Card key={entry.id} className={
                entry.queue_type === 'emergency' ? 'border-2 border-danger-400 shadow-glow-red' :
                entry.status === 'in_consultation' ? 'border-2 border-primary-400 shadow-glow' : ''
              }>
                <CardBody className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Rank */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      entry.status === 'in_consultation' ? 'bg-primary-100 text-primary-700' :
                      entry.queue_type === 'emergency' ? 'bg-danger-100 text-danger-700' :
                      'bg-surface-100 text-surface-600'
                    }`}>
                      {idx + 1}
                    </div>

                    {/* Avatar */}
                    <Avatar name={entry.patient?.full_name} size="sm" className="flex-shrink-0" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-semibold text-surface-800">{entry.patient?.full_name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-mono text-xs text-surface-600">{entry.token_number}</span>
                            <Badge variant={entry.queue_type === 'emergency' ? 'danger' : entry.queue_type === 'appointment' ? 'primary' : 'warning'}>
                              {QUEUE_TYPE_CONFIG[entry.queue_type]?.label}
                            </Badge>
                            <Badge
                              variant={QUEUE_STATUS_CONFIG[entry.status]?.color || 'neutral'}
                              dot pulse={entry.status === 'in_consultation'}
                            >
                              {QUEUE_STATUS_CONFIG[entry.status]?.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right text-xs text-surface-500 flex-shrink-0">
                          <p>Score: <span className="font-semibold text-surface-700">{entry.priority_score}</span></p>
                          <p>Doctor: {entry.doctor?.user?.full_name?.split(' ').pop()}</p>
                          {!entry.check_in_status && <Badge variant="warning" className="mt-1">No Check-in</Badge>}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBoostPriority(entry)}
                          className="text-medical-600 hover:bg-medical-50"
                          title="Boost priority"
                        >
                          <ArrowUp className="w-3.5 h-3.5" /> Boost
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLowerPriority(entry)}
                          title="Lower priority"
                        >
                          <ArrowDown className="w-3.5 h-3.5" /> Lower
                        </Button>
                        {entry.queue_type !== 'emergency' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkEmergency(entry)}
                            className="text-danger-600 hover:bg-danger-50"
                          >
                            <TriangleAlert className="w-3.5 h-3.5" /> Emergency
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(entry)}
                          className="text-danger-500 hover:bg-danger-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Cancel
                        </Button>
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
