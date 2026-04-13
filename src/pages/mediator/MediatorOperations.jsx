import { useState, useEffect } from 'react'
import { UserPlus, Activity, Shield, ListFilter, Search, UserCheck, Stethoscope, AlertTriangle, CheckCircle, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import Tabs from '@/components/ui/Tabs'
import { useQueueStore } from '@/store/queueStore'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { walkInSchema } from '@/utils/validators'
import { QUEUE_STATUS_CONFIG, QUEUE_TYPE_CONFIG, getSpecialtyIcon } from '@/utils/helpers'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'control', label: 'Queue Control', icon: Activity },
  { id: 'registration', label: 'Walk-in Entry', icon: UserPlus },
]

export default function MediatorOperations() {
  const [activeTab, setActiveTab] = useState('control')
  const { entries, loadQueue, updateStatus, changePriority, addWalkIn } = useQueueStore()
  const [doctorFilter, setDoctorFilter] = useState('')
  const [doctors, setDoctors] = useState([])
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true)
  const [lastToken, setLastToken] = useState(null)

  useEffect(() => {
    loadQueue()
    import('@/services/doctors.service').then(({ doctorsService }) => {
      doctorsService.getAll().then(data => {
        setDoctors(data)
        setIsLoadingDoctors(false)
      })
    })
  }, [])

  // Walk-in Form
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(walkInSchema),
    defaultValues: { is_emergency: false },
  })

  const isEmergency = watch('is_emergency')
  const selectedDoctorId = watch('doctor_id')
  const availableDoctors = doctors.filter(d => d.is_available)

  const onWalkInSubmit = async (data) => {
    try {
      const entry = await addWalkIn(data)
      setLastToken(entry)
      toast.success(`Walk-in registered! Token: ${entry.token_number}`)
      reset()
      setActiveTab('control')
    } catch (err) {
      toast.error(err.message || 'Failed to register walk-in')
    }
  }

  // Queue Control Methods
  const filteredEntries = doctorFilter
    ? entries.filter(e => e.doctor_id === doctorFilter)
    : entries

  const activeEntries = filteredEntries.filter(e => ['waiting', 'in_consultation'].includes(e.status))

  const handleBoost = async (entry) => {
    await changePriority(entry.id, entry.priority_score + 100)
    toast.success(`${entry.token_number} priority boosted`)
  }

  const handleLower = async (entry) => {
    await changePriority(entry.id, Math.max(0, entry.priority_score - 50))
    toast(`${entry.token_number} priority lowered`)
  }

  const handleCancel = async (entry) => {
    if (!window.confirm(`Cancel token ${entry.token_number}?`)) return
    await updateStatus(entry.id, 'cancelled')
    toast.error(`${entry.token_number} cancelled`)
  }

  const handleManualEmergency = async (entry) => {
    await changePriority(entry.id, 650)
    toast.success(`${entry.token_number} marked as EMERGENCY`)
  }

  return (
    <DashboardLayout title="Hospital Operations" subtitle="Patient registration and live queue management">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <Tabs 
            tabs={TABS} 
            activeTab={activeTab} 
            onChange={setActiveTab} 
            className="w-full sm:max-w-md"
          />
          
          {activeTab === 'control' && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Select
                value={doctorFilter}
                onChange={e => setDoctorFilter(e.target.value)}
                className="min-w-[180px] flex-1 sm:flex-initial"
              >
                <option value="">All Doctors</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.user?.full_name}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {activeTab === 'registration' && (
          <div className="grid lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSubmit(onWalkInSubmit)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                       Patient Information
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Input label="Full Name" placeholder="Patient full name" required {...register('full_name')} error={errors.full_name?.message} />
                      <Input label="Phone Number" placeholder="+1 (555) 000-0000" required {...register('phone')} error={errors.phone?.message} />
                    </div>
                    <Input label="Symptoms / Reason" placeholder="Brief description..." required {...register('symptoms')} error={errors.symptoms?.message} />
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Assign Doctor</CardTitle></CardHeader>
                  <CardBody>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {availableDoctors.map(doc => (
                        <label key={doc.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedDoctorId === doc.id ? 'border-primary-500 bg-primary-50' : 'border-surface-200 hover:border-primary-200'}`}>
                          <input type="radio" value={doc.id} className="sr-only" {...register('doctor_id')} />
                          <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center text-lg">{getSpecialtyIcon(doc.specialization)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{doc.user?.full_name}</p>
                            <p className="text-xs text-surface-500">{doc.specialization}</p>
                          </div>
                          {selectedDoctorId === doc.id && <CheckCircle className="w-4 h-4 text-primary-600" />}
                        </label>
                      ))}
                    </div>
                  </CardBody>
                </Card>

                <Card className={isEmergency ? 'border-2 border-danger-400 bg-danger-50' : ''}>
                  <CardBody className="p-4">
                    <label className="flex items-center gap-4 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded accent-danger-600" {...register('is_emergency')} />
                      <div>
                        <p className="font-semibold text-surface-800 flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${isEmergency ? 'text-danger-600' : 'text-surface-400'}`} />
                          Critical Emergency
                        </p>
                        <p className="text-xs text-surface-500">Places patient at top of queue</p>
                      </div>
                    </label>
                  </CardBody>
                </Card>

                <Button type="submit" size="lg" className={`w-full ${isEmergency ? '!bg-danger-600' : ''}`}>
                  {isEmergency ? '🚨 Rapid Emergency Admission' : 'Register Walk-in'}
                </Button>
              </form>
            </div>
            
            <div className="space-y-4">
              {lastToken && (
                <Card className="bg-medical-50 border-2 border-medical-200">
                  <CardBody className="p-6 text-center">
                    <div className="w-16 h-16 bg-medical-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-medical-600" />
                    </div>
                    <p className="text-sm font-medium text-medical-600 mb-1">Registration Complete</p>
                    <p className="text-4xl font-bold font-display text-medical-900 mb-2">{lastToken.token_number}</p>
                    <p className="text-sm text-medical-700 mb-6">Patient: {lastToken.patient?.full_name}</p>
                    <Button variant="outline" size="sm" onClick={() => setLastToken(null)}>Dismiss</Button>
                  </CardBody>
                </Card>
              )}
              
              <Card>
                <CardHeader><CardTitle>Quick Tips</CardTitle></CardHeader>
                <CardBody className="text-xs text-surface-500 space-y-2">
                  <p>• Emergency patients bypass standard priority logic.</p>
                  <p>• Walk-ins are assigned a lower initial score than pre-booked appointments.</p>
                  <p>• Ensure patient contact info is accurate for SMS notifications.</p>
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'control' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeEntries.length === 0 ? (
              <EmptyState icon={Shield} title="No Active Patients" description="The current selected queue is empty." />
            ) : (
              <div className="space-y-3">
                {activeEntries.map((entry, idx) => (
                  <Card key={entry.id} className={`${entry.queue_type === 'emergency' ? 'border-2 border-danger-400' : entry.status === 'in_consultation' ? 'border-2 border-primary-400' : ''}`}>
                    <CardBody className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold font-display ${entry.status === 'in_consultation' ? 'bg-primary-100 text-primary-700' : 'bg-surface-100 text-surface-600'}`}>
                          {idx + 1}
                        </div>
                        <Avatar name={entry.patient?.full_name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-surface-900">{entry.patient?.full_name}</span>
                            <Badge variant="neutral">{entry.token_number}</Badge>
                            <Badge variant={entry.queue_type === 'emergency' ? 'danger' : 'primary'}>{QUEUE_TYPE_CONFIG[entry.queue_type]?.label}</Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-surface-500">
                            <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" /> {entry.doctor?.user?.full_name}</span>
                            <span>Score: {entry.priority_score}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="xs" icon={ArrowUp} onClick={() => handleBoost(entry)} />
                          <Button variant="ghost" size="xs" icon={ArrowDown} onClick={() => handleLower(entry)} />
                          <Button variant="ghost" size="xs" icon={AlertTriangle} className="text-danger-500" onClick={() => handleManualEmergency(entry)} />
                          <Button variant="ghost" size="xs" icon={Trash2} className="text-surface-400" onClick={() => handleCancel(entry)} />
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
