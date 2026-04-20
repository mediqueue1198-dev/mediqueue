import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserCheck, Phone, Stethoscope, TriangleAlert, CheckCircle } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { walkInSchema } from '@/utils/validators'
import { useQueueStore } from '@/store/queueStore'
import { useAuthStore } from '@/store/authStore'
import { getSpecialtyIcon } from '@/utils/helpers'
import toast from 'react-hot-toast'
import * as z from 'zod'
import { QueueEntry } from '@/types/queue'
import { PageLoader } from '@/components/ui/LoadingSpinner'

type WalkInFormValues = z.infer<typeof walkInSchema>;

export default function WalkInRegistration() {
  const { addWalkIn } = useQueueStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastToken, setLastToken] = useState<QueueEntry | null>(null)
  const { profile } = useAuthStore()
  const [doctors, setDoctors] = useState<any[]>([])
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true)

  useEffect(() => {
    const fetchDoctors = async () => {
      const { doctorsService } = await import('@/services/doctors.service')
      const filters: any = {}
      if (profile?.role === 'mediator' && profile?.approvedDoctorIds) {
        filters.ids = profile.approvedDoctorIds
      }
      const data = await doctorsService.getAll(filters)
      setDoctors(data)
      setIsLoadingDoctors(false)
    }
    fetchDoctors()
  }, [profile?.approvedDoctorIds, profile?.role])

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<WalkInFormValues>({
    resolver: zodResolver(walkInSchema),
    defaultValues: { is_emergency: false },
  })

  const isEmergency = watch('is_emergency')
  const selectedDoctorId = watch('doctor_id')
  const availableDoctors = doctors.filter(d => d.is_available)

  const onSubmit = async (data: WalkInFormValues) => {
    setIsSubmitting(true)
    try {
      const selectedDoctor = doctors.find(d => d.id === data.doctor_id)
      const entry = await addWalkIn(data, selectedDoctor)
      setLastToken(entry as QueueEntry)
      toast.success(`Walk-in registered! Token: ${(entry as QueueEntry).token_number}`)
      reset()
    } catch (err: any) {
      toast.error(err.message || 'Failed to register walk-in')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingDoctors) return <PageLoader />

  return (
    <DashboardLayout title="Walk-in Registration" subtitle="Register walk-in and emergency patients">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Last token confirmation */}
        {lastToken && (
          <div className="bg-medical-50 border-2 border-medical-300 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-medical-100 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-medical-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-medical-800">Walk-in Registered Successfully!</p>
              <p className="text-sm text-medical-600">
                Token: <span className="font-mono font-bold text-lg">{lastToken.token_number}</span>
                {lastToken.queue_type === 'emergency' && ' • EMERGENCY'}
              </p>
            </div>
            <button onClick={() => setLastToken(null)} className="text-medical-500 hover:text-medical-700 text-xs font-medium">
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Patient Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary-600" /> Patient Information
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  placeholder="Patient full name"
                  error={errors.full_name?.message}
                  required
                  {...register('full_name')}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  icon={Phone}
                  placeholder="+1 (555) 000-0000"
                  error={errors.phone?.message}
                  required
                  {...register('phone')}
                />
              </div>
              <Input
                label="Symptoms / Reason"
                placeholder="Brief description of symptoms..."
                error={errors.symptoms?.message}
                required
                {...register('symptoms')}
              />
            </CardBody>
          </Card>

          {/* Doctor Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-medical-600" /> Select Doctor
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                {availableDoctors.map(doc => (
                  <label
                    key={doc.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedDoctorId === doc.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-surface-200 hover:border-primary-200'
                    }`}
                  >
                    <input type="radio" value={doc.id} className="sr-only" {...register('doctor_id')} />
                    <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                      {getSpecialtyIcon(doc.specialization)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-800">{doc.user?.full_name}</p>
                      <p className="text-xs text-surface-500">{doc.specialization}</p>
                      <p className="text-xs text-surface-400">{doc.patients_today} patients today</p>
                    </div>
                    {selectedDoctorId === doc.id && (
                      <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
                    )}
                  </label>
                ))}
              </div>
              {errors.doctor_id && (
                <p className="text-xs text-danger-600">{errors.doctor_id.message}</p>
              )}
              {availableDoctors.length === 0 && (
                <p className="text-sm text-surface-500 text-center py-4 bg-surface-50 rounded-xl border border-dashed border-surface-200">
                  No doctors available at the moment.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Emergency flag */}
          <Card className={isEmergency ? 'border-2 border-danger-400 bg-danger-50' : ''}>
            <CardBody className="p-4">
              <label className="flex items-center gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded accent-danger-600"
                  {...register('is_emergency')}
                />
                <div>
                  <p className="font-semibold text-surface-800 flex items-center gap-2">
                    <TriangleAlert className={`w-4 h-4 ${isEmergency ? 'text-danger-600' : 'text-surface-400'}`} />
                    Mark as Emergency
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5">
                    Patient will be placed at the top of the queue immediately
                  </p>
                </div>
              </label>
            </CardBody>
          </Card>

          <Button
            type="submit"
            isLoading={isSubmitting}
            size="lg"
            className={`w-full ${isEmergency ? '!bg-danger-600 hover:!bg-danger-700' : ''}`}
          >
            <UserCheck className="w-5 h-5" />
            {isEmergency ? '🚨 Register Emergency Patient' : 'Register Walk-in Patient'}
          </Button>
        </form>
      </div>
    </DashboardLayout>
  )
}
