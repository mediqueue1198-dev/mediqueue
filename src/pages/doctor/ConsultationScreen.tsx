import { useState, useEffect, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Stethoscope, Plus, Trash2, Save, FileText, User, Play, Pause, Square, Pill, ScrollText, AlertCircle } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { useQueue } from '@/hooks/useQueue'
import { medicalRecordSchema } from '@/utils/validators'
import { patientsService } from '@/services/patients.service'
import { useAuth } from '@/hooks/useAuth'
import { useDoctorProfile } from '@/hooks/useDoctorProfile'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import * as z from 'zod'

type MedicalRecordFormValues = z.infer<typeof medicalRecordSchema>;

export default function ConsultationScreen() {
  const { user } = useAuth()
  const { doctor, isLoading: isDoctorLoading } = useDoctorProfile(user?.id)
  const { currentPatient, updateStatus } = useQueue(doctor?.id)
  const [isSaving, setIsSaving] = useState(false)
  
  // Timer state
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef<any>(null)

  // Initialize timer when patient enters consultation
  useEffect(() => {
    if (currentPatient?.consultation_started_at) {
      const startTime = new Date(currentPatient.consultation_started_at)
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      setElapsedSeconds(Math.max(0, elapsed))
      setTimerRunning(true)
    } else {
      setElapsedSeconds(0)
      setTimerRunning(false)
    }
  }, [currentPatient?.id, currentPatient?.consultation_started_at])

  // Timer effect
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning])

  const formatTimeStr = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStart = () => {
    if (currentPatient && currentPatient.status !== 'in_consultation') {
      updateStatus(currentPatient.id, 'in_consultation', { 
        consultation_started_at: new Date().toISOString() 
      })
    }
    setTimerRunning(true)
  }

  const handlePause = () => setTimerRunning(false)
  const handleStop = () => setTimerRunning(false)

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm<MedicalRecordFormValues>({
    resolver: zodResolver(medicalRecordSchema),
    defaultValues: {
      diagnosis: '',
      notes: '',
      prescription: [{ name: '', dosage: '', frequency: '', duration: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'prescription' })

  if (isDoctorLoading) return <PageLoader />

  const onSubmit = async (data: MedicalRecordFormValues) => {
    if (!currentPatient) return
    setIsSaving(true)
    setTimerRunning(false)
    try {
      await patientsService.addMedicalRecord({
        patient_id: currentPatient.patient_id,
        patient_name: currentPatient.patient?.user?.full_name || currentPatient.patient_name || currentPatient.patient?.patient_name || 'Patient',
        patient_phone: currentPatient.patient_phone || currentPatient.patient?.user?.phone || currentPatient.patient?.phone,
        doctor_id: doctor?.id,
        appointment_id: currentPatient.appointment_id,
        queue_entry_id: currentPatient.id,
        diagnosis: data.diagnosis,
        prescription: (data.prescription || []).filter(p => p.name),
        notes: data.notes,
      })
      
      const durationMinutes = Math.ceil(elapsedSeconds / 60)
      await updateStatus(currentPatient.id, 'completed', { 
        completed_at: new Date().toISOString(),
        consultation_duration_minutes: durationMinutes
      })
      
      toast.success('Consultation saved successfully!')
      setElapsedSeconds(0)
      reset()
    } catch (err: any) {
      console.error('Save consultation error:', err)
      toast.error('Failed to save consultation: ' + (err.message || 'Unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DashboardLayout title="Live Consultation" subtitle="Real-time patient diagnosis and e-prescription">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-6">
        
        {/* Left Column: Patient Profile & Timer */}
        <div className="lg:col-span-1 space-y-6">
          {currentPatient ? (
            <>
              <Card className="border-none shadow-premium bg-white overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-primary-400 to-primary-600" />
                <CardBody className="p-6 text-center">
                  <div className="relative inline-block mb-4">
                    <Avatar 
                      name={currentPatient.patient?.user?.full_name || currentPatient.patient_name || currentPatient.patient?.patient_name} 
                      size="2xl" 
                      className="mx-auto ring-4 ring-primary-50" 
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-medical-500 rounded-full border-2 border-white flex items-center justify-center">
                      <Stethoscope className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-surface-900 font-display">
                    {currentPatient.patient?.user?.full_name || currentPatient.patient_name || currentPatient.patient?.patient_name || 'Patient'}
                  </h3>
                  <p className="text-sm text-surface-500 font-medium">{currentPatient.token_number} • {currentPatient.queue_type?.toUpperCase()}</p>
                  
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <div className="bg-surface-50 rounded-2xl p-3">
                      <p className="text-[10px] font-bold text-surface-400 uppercase">Wait Time</p>
                      <p className="font-bold text-surface-700">{currentPatient.priority_score > 100 ? 'Priority' : 'Normal'}</p>
                    </div>
                    <div className="bg-surface-50 rounded-2xl p-3">
                      <p className="text-[10px] font-bold text-surface-400 uppercase">Risk Level</p>
                      <Badge variant={(currentPatient.patient?.no_show_rate || 0) > 0.3 ? 'warning' : 'success'} className="mt-1">
                        {(currentPatient.patient?.no_show_rate || 0) > 0.3 ? 'High' : 'Low'}
                      </Badge>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Advanced Timer */}
              <Card className="border-none shadow-premium bg-surface-900 text-white overflow-hidden">
                <CardBody className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-surface-400 uppercase tracking-widest flex items-center gap-2">
                       Consultation Time
                    </span>
                    <Badge variant="medical" dot pulse className="bg-medical-500 text-white border-none py-0.5">Live</Badge>
                  </div>
                  
                  <div className="text-5xl font-mono font-bold tracking-widest text-center mb-6 py-2 bg-white/5 rounded-2xl">
                    {formatTimeStr(elapsedSeconds)}
                  </div>
                  
                  <div className="flex gap-2">
                    {!timerRunning ? (
                      <Button
                        onClick={handleStart}
                        className="flex-1 !bg-medical-500 hover:!bg-medical-600 border-none"
                      >
                        <Play className="w-4 h-4 mr-2" /> Resume
                      </Button>
                    ) : (
                      <Button
                        onClick={handlePause}
                        className="flex-1 !bg-amber-500 hover:!bg-amber-600 border-none"
                      >
                        <Pause className="w-4 h-4 mr-2" /> Pause
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleStop}
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </>
          ) : (
            <Card className="border-dashed border-2 border-surface-200 bg-surface-50">
              <CardBody className="p-12 text-center text-surface-400">
                <User className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">No patient in consultation</p>
                <p className="text-xs mt-1">Please call the next patient from your queue dashboard.</p>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Right Column: Medical Record Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card className="border-none shadow-premium overflow-hidden">
              <CardHeader className="bg-surface-50/50 border-b border-surface-100">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ScrollText className="w-5 h-5 text-primary-600" />
                  Diagnosis & Findings
                </CardTitle>
              </CardHeader>
              <CardBody className="p-6 space-y-5">
                <Input
                  label="Primary Diagnosis"
                  placeholder="e.g., Seasonal Influenza, Type 2 Diabetes..."
                  error={errors.diagnosis?.message}
                  required
                  className="rounded-xl border-surface-200"
                  {...register('diagnosis')}
                />
                <Textarea
                  label="Notes & Observations"
                  placeholder="Detailed findings, patient symptoms, vitals..."
                  rows={4}
                  className="rounded-xl border-surface-200 focus:ring-primary-500"
                  {...register('notes')}
                />
              </CardBody>
            </Card>

            <Card className="border-none shadow-premium overflow-hidden">
              <CardHeader className="bg-surface-50/50 border-b border-surface-100 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pill className="w-5 h-5 text-medical-600" />
                  E-Prescription
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: '', dosage: '', frequency: '', duration: '' })}
                  className="rounded-xl border-medical-200 text-medical-700 hover:bg-medical-50"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Medication
                </Button>
              </CardHeader>
              <CardBody className="p-6">
                {fields.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-surface-100 rounded-2xl">
                    <p className="text-sm text-surface-400 italic">No medications added yet.</p>
                  </div>
                )}
                <div className="space-y-4">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="group relative bg-surface-50/50 hover:bg-white hover:shadow-md border border-surface-100 rounded-2xl p-4 transition-all duration-300">
                      <div className="grid sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-1">
                          <label className="text-[10px] font-bold text-surface-400 uppercase mb-1 block">Medicine</label>
                          <input 
                            placeholder="Name" 
                            className="w-full bg-transparent border-b border-surface-200 focus:border-medical-500 focus:outline-none text-sm font-medium py-1"
                            {...register(`prescription.${idx}.name` as const)} 
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-surface-400 uppercase mb-1 block">Dosage</label>
                          <input 
                            placeholder="e.g. 10mg" 
                            className="w-full bg-transparent border-b border-surface-200 focus:border-medical-500 focus:outline-none text-sm py-1"
                            {...register(`prescription.${idx}.dosage` as const)} 
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-surface-400 uppercase mb-1 block">Frequency</label>
                          <input 
                            placeholder="e.g. 1-0-1" 
                            className="w-full bg-transparent border-b border-surface-200 focus:border-medical-500 focus:outline-none text-sm py-1"
                            {...register(`prescription.${idx}.frequency` as const)} 
                          />
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-surface-400 uppercase mb-1 block">Duration</label>
                            <input 
                              placeholder="5 days" 
                              className="w-full bg-transparent border-b border-surface-200 focus:border-medical-500 focus:outline-none text-sm py-1"
                              {...register(`prescription.${idx}.duration` as const)} 
                            />
                          </div>
                          {fields.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => remove(idx)} 
                              className="mt-4 p-1 text-surface-300 hover:text-danger-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-surface-500 text-xs italic">
                <AlertCircle className="w-3.5 h-3.5" />
                Data will be securely saved to medical history.
              </div>
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => reset()} 
                  className="rounded-xl text-surface-500"
                >
                  Discard
                </Button>
                <Button 
                  type="submit" 
                  isLoading={isSaving} 
                  disabled={!currentPatient} 
                  className="rounded-xl px-10 shadow-glow-primary !bg-primary-600 hover:!bg-primary-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Consultation
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
