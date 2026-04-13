import { useState, useEffect, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Stethoscope, Plus, Trash2, Save, FileText, User, Play, Pause, Square } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { useQueue } from '@/hooks/useQueue'
import { medicalRecordSchema } from '@/utils/validators'
import { patientsService } from '@/services/patients.service'
import { useAuth } from '@/hooks/useAuth'
import { useDoctorProfile } from '@/hooks/useDoctorProfile'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

export default function ConsultationScreen() {
  const { user } = useAuth()
  const { doctor, isLoading: isDoctorLoading } = useDoctorProfile(user?.id)
  const { currentPatient, updateStatus } = useQueue(doctor?.id)
  const [isSaving, setIsSaving] = useState(false)
  
  // Timer state
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef(null)

  // Initialize timer when patient enters consultation
  useEffect(() => {
    if (currentPatient?.consultation_started_at) {
      const startTime = new Date(currentPatient.consultation_started_at)
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      setElapsedSeconds(elapsed)
      setTimerRunning(true)
    }
  }, [currentPatient?.consultation_started_at])

  // Timer effect
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [timerRunning])

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleStart = () => {
    if (currentPatient?.status !== 'in_consultation') {
      updateStatus(currentPatient?.id, 'in_consultation', { 
        consultation_started_at: new Date().toISOString() 
      })
    }
    setTimerRunning(true)
  }

  const handlePause = () => {
    setTimerRunning(false)
  }

  const handleStop = () => {
    setTimerRunning(false)
  }

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm({
    resolver: zodResolver(medicalRecordSchema),
    defaultValues: {
      diagnosis: '',
      notes: '',
      prescription: [{ name: '', dosage: '', frequency: '', duration: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'prescription' })

  if (isDoctorLoading) return <PageLoader />



  const onSubmit = async (data) => {
    setIsSaving(true)
    setTimerRunning(false)
    try {
      await patientsService.addMedicalRecord({
        patient_id: currentPatient?.patient_id,
        doctor_id: doctor?.id,
        appointment_id: currentPatient?.appointment_id,
        diagnosis: data.diagnosis,
        prescription: data.prescription.filter(p => p.name),
        notes: data.notes,
      })
      
      const durationMinutes = Math.ceil(elapsedSeconds / 60)
      await updateStatus(currentPatient?.id, 'completed', { 
        completed_at: new Date().toISOString(),
        consultation_duration_minutes: durationMinutes
      })
      
      toast.success('Consultation saved & patient marked complete!')
      setElapsedSeconds(0)
      reset()
    } catch (err) {
      console.error('Save consultation error:', err)
      toast.error('Failed to save consultation')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DashboardLayout title="Consultation Screen" subtitle="Record diagnosis and prescription">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Patient Info */}
        {currentPatient ? (
          <Card className="border-2 border-primary-200 bg-primary-50/30">
            <CardBody className="p-4">
              <div className="flex items-center gap-4">
                <Avatar name={currentPatient.patient?.full_name} size="lg" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-surface-800 text-lg">{currentPatient.patient?.full_name}</h3>
                    <Badge variant="primary" dot pulse>In Consultation</Badge>
                  </div>
                  <p className="text-sm text-surface-500 mt-0.5">
                    Token: {currentPatient.token_number} • {currentPatient.patient?.phone}
                  </p>
                  <p className="text-xs text-surface-400 mt-1">
                    Type: {currentPatient.queue_type?.replace('_', ' ')}
                  </p>
                </div>
                
                {/* Timer Display */}
                <div className="flex items-center gap-3 bg-white border-2 border-medical-200 rounded-xl p-3 shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-medical-600 uppercase tracking-wider">Duration</span>
                    <div className="text-2xl font-mono font-bold text-surface-800 tracking-widest tabular-nums">
                      {formatTime(elapsedSeconds)}
                    </div>
                  </div>
                  <div className="flex gap-1.5 ml-2">
                    {!timerRunning ? (
                      <button
                        type="button"
                        onClick={handleStart}
                        className="p-2 bg-medical-100 hover:bg-medical-200 rounded-lg transition-colors"
                        title="Start"
                      >
                        <Play className="w-4 h-4 text-medical-600" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePause}
                        className="p-2 bg-warning-100 hover:bg-warning-200 rounded-lg transition-colors"
                        title="Pause"
                      >
                        <Pause className="w-4 h-4 text-warning-600" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleStop}
                      className="p-2 bg-danger-100 hover:bg-danger-200 rounded-lg transition-colors"
                      title="Stop"
                    >
                      <Square className="w-4 h-4 text-danger-600" />
                    </button>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card className="border-2 border-surface-200">
            <CardBody className="p-6 text-center">
              <User className="w-10 h-10 text-surface-300 mx-auto mb-2" />
              <p className="text-surface-500 text-sm">No patient currently in consultation.</p>
              <p className="text-xs text-surface-400">Call the next patient from the queue.</p>
            </CardBody>
          </Card>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Diagnosis */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-medical-600" /> Diagnosis
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Primary Diagnosis"
                placeholder="e.g., Hypertension Stage 1, Type 2 Diabetes..."
                error={errors.diagnosis?.message}
                required
                {...register('diagnosis')}
              />
              <Textarea
                label="Clinical Notes"
                placeholder="Examination findings, patient history, observations..."
                rows={4}
                {...register('notes')}
              />
            </CardBody>
          </Card>

          {/* Prescription */}
          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-600" /> Prescription
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => append({ name: '', dosage: '', frequency: '', duration: '' })}
                >
                  <Plus className="w-4 h-4" /> Add Medicine
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {fields.map((field, idx) => (
                <div key={field.id} className="bg-surface-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-surface-600 uppercase tracking-wide">
                      Medicine {idx + 1}
                    </p>
                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(idx)} className="text-danger-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input placeholder="Medicine name" {...register(`prescription.${idx}.name`)} />
                    <Input placeholder="Dosage (e.g., 10mg)" {...register(`prescription.${idx}.dosage`)} />
                    <Input placeholder="Frequency (e.g., Twice daily)" {...register(`prescription.${idx}.frequency`)} />
                    <Input placeholder="Duration (e.g., 30 days)" {...register(`prescription.${idx}.duration`)} />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => reset()}>Clear</Button>
            <Button type="submit" isLoading={isSaving} disabled={!currentPatient}>
              <Save className="w-4 h-4" />
              Save & Complete
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
