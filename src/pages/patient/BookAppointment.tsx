import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Calendar, Clock, CheckCircle, ChevronRight, Star, CreditCard, Banknote, Smartphone, Wallet, MapPin } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'

import { appointmentSchema } from '@/utils/validators'
import { useAppointments } from '@/hooks/useAppointments'
import { useAuth } from '@/hooks/useAuth'
import { generateSlots, getRecommendedSlots, Slot } from '@/utils/slotGenerator'
import { getSpecialtyIcon } from '@/utils/helpers'
import { format, addDays } from 'date-fns'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { patientsService } from '@/services/patients.service'
import { appointmentsService } from '@/services/appointments.service'
import * as z from 'zod'

const STEPS = ['Select Doctor', 'Choose Slot', 'Payment', 'Confirm']

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote, color: 'bg-green-100 text-green-700' },
  { value: 'card', label: 'Card', icon: CreditCard, color: 'bg-blue-100 text-blue-700' },
  { value: 'upi', label: 'UPI', icon: Smartphone, color: 'bg-purple-100 text-purple-700' },
]

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

export default function BookAppointment() {
  const [step, setStep] = useState(0)
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [specialtyFilter, setSpecialtyFilter] = useState('')
  const [doctors, setDoctors] = useState<any[]>([])
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true)
  const { createAppointment, isLoading } = useAppointments()
  const { user, profile } = useAuth()
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [patientProfile, setPatientProfile] = useState<any>(null)
  const navigate = useNavigate()
  
  // Payment state
  const [consultationFee, setConsultationFee] = useState(0)
  const [paymentTiming, setPaymentTiming] = useState('pay_later')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  useEffect(() => {
    const fetchDoctors = async () => {
      const { doctorsService } = await import('@/services/doctors.service')
      const data = await doctorsService.getAll()
      setDoctors(data)
      setIsLoadingDoctors(false)
    }
    fetchDoctors()

    if (user?.id) {
      patientsService.getFamilyMembers(user.id).then(setFamilyMembers)
      patientsService.getByUserId(user.id).then(setPatientProfile)
    }
  }, [user?.id])

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { 
      visit_type: 'first_visit',
      patient_type: 'self',
    },
  })

  // const symptoms = watch('symptoms')
  const patientType = watch('patient_type')
  const specialties = Array.from(new Set(doctors.map(d => d.specialization)))
  const filteredDoctors = specialtyFilter
    ? doctors.filter(d => d.specialization === specialtyFilter)
    : doctors

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      // If doctor uses multi-location array but no location selected yet, don't generate slots.
      if (Array.isArray(selectedDoctor.availability_schedule) && !selectedLocationId) {
        setSlots([])
        setSelectedSlot(null)
        return
      }

      const date = new Date(selectedDate)
      appointmentsService.getByDoctorAndDate(selectedDoctor.id, selectedDate)
        .then(booked => {
          const generated = generateSlots(selectedDoctor, date, booked || [], selectedLocationId || undefined)
          setSlots(generated)
          setSelectedSlot(null)
        })
        .catch(() => {
          const generated = generateSlots(selectedDoctor, date, [], selectedLocationId || undefined)
          setSlots(generated)
          setSelectedSlot(null)
        })
    }
  }, [selectedDoctor, selectedDate, selectedLocationId])

  const calculateFee = async (doctor: any) => {
    const visitType = watch('visit_type')
    try {
      const fee = await appointmentsService.calculateFee(doctor.id, visitType as any, doctor)
      setConsultationFee(fee)
    } catch (err) {
      console.error('Error calculating fee:', err)
      setConsultationFee(0)
    }
  }

  const handleSelectDoctor = (doctor: any) => {
    setSelectedDoctor(doctor)
    setValue('doctor_id', doctor.id)
    calculateFee(doctor)
    
    // Auto-select location if only 1 exists
    if (Array.isArray(doctor.availability_schedule) && doctor.availability_schedule.length === 1) {
      setSelectedLocationId(doctor.availability_schedule[0].id)
    } else {
      setSelectedLocationId(null)
    }

    setStep(1)
  }

  useEffect(() => {
    if (selectedDoctor) {
      calculateFee(selectedDoctor)
    }
  }, [watch('visit_type')]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectSlot = (slot: Slot) => {
    if (!slot.available) return
    setSelectedSlot(slot)
    setValue('scheduled_time', slot.time.toISOString())
    setStep(2)
  }

  const handlePaymentContinue = () => {
    setStep(3)
  }

  const onSubmit = async (data: AppointmentFormValues) => {
    try {
      const { patient_type, family_member_id, ...rest } = data
      const isPayNow = paymentTiming === 'pay_now'
      
      // Inject location info into notes
      let finalNotes = rest.notes || ''
      if (Array.isArray(selectedDoctor.availability_schedule) && selectedLocationId) {
        const locObj = selectedDoctor.availability_schedule.find((l: any) => l.id === selectedLocationId)
        if (locObj) {
          finalNotes = `[Location: ${locObj.name} - ${locObj.address}]\n\n` + finalNotes
        }
      }
      
      const finalPatientId = user?.id
      
      if (!finalPatientId) {
        throw new Error('User session not found. Please log in again.')
      }

      console.log('Attempting to create appointment with data:', {
        ...rest,
        patient_id: finalPatientId,
        status: 'pending'
      });
      
      await createAppointment({
        ...rest,
        notes: finalNotes.trim(),
        family_member_id: patient_type === 'family' ? family_member_id : null,
        patient_id: finalPatientId,
        status: 'pending',
        consultation_fee: consultationFee,
        total_amount: consultationFee,
        payment_status: isPayNow ? 'paid' : 'pending',
        payment_method: isPayNow ? paymentMethod : null,
        payment_time: isPayNow ? new Date().toISOString() : null,
      })
      toast.success('Appointment request submitted! The doctor will review and confirm your appointment.')
      navigate('/patient/appointments')
    } catch (err: any) {
      toast.error(err.message || 'Failed to book appointment')
    }
  }

  const recommendedSlots = getRecommendedSlots(slots, 3)

  if (isLoadingDoctors) return <PageLoader />

  return (
    <DashboardLayout title="Book Appointment" subtitle="Schedule a consultation with a doctor">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Step Progress */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${i <= step ? 'text-primary-600' : 'text-surface-400'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${
                  i < step ? 'bg-primary-600 border-primary-600 text-white' :
                  i === step ? 'border-primary-600 text-primary-600' :
                  'border-surface-300 text-surface-400'
                }`}>
                  {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className="text-xs font-medium hidden sm:block">{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 rounded ${i < step ? 'bg-primary-600' : 'bg-surface-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Select Doctor */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Select
                value={specialtyFilter}
                onChange={e => setSpecialtyFilter(e.target.value)}
                className="max-w-[200px]"
              >
                <option value="">All Specializations</option>
                {specialties.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {filteredDoctors.map((doc) => (
                <Card
                  key={doc.id}
                  hover
                  onClick={() => handleSelectDoctor(doc)}
                  className={`cursor-pointer transition-all ${!doc.is_available ? 'opacity-60' : ''}`}
                >
                  <CardBody className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                        {getSpecialtyIcon(doc.specialization)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-surface-800 text-sm">{doc.user?.full_name}</p>
                            <p className="text-xs text-surface-500">{doc.specialization}</p>
                          </div>
                          <Badge variant={doc.is_available ? 'success' : 'neutral'} dot>
                            {doc.is_available ? 'Available' : 'Busy'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1 text-xs text-warning-600">
                            <Star className="w-3 h-3 fill-warning-400 text-warning-400" /> {doc.rating}
                          </span>
                          <span className="text-xs text-surface-500">{doc.experience_years}y exp</span>
                          <span className="flex items-center gap-1 text-xs text-surface-500">
                            <Clock className="w-3 h-3" /> ~{doc.consultation_avg_time} min
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-surface-400">{doc.patients_today} patients today</p>
                      <ChevronRight className="w-4 h-4 text-surface-400" />
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Choose Slot */}
        {step === 1 && selectedDoctor && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-surface-800">Booking with {selectedDoctor.user?.full_name}</p>
                <p className="text-sm text-surface-500">{selectedDoctor.specialization}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep(0)}>← Back</Button>
            </div>

            {/* Location Selection */}
            {Array.isArray(selectedDoctor.availability_schedule) && selectedDoctor.availability_schedule.length > 0 && (
              <div className="space-y-3 pb-4 border-b border-surface-100">
                <p className="text-sm font-semibold text-surface-700 flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> Select Clinic Location
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {selectedDoctor.availability_schedule.map((loc: any) => (
                    <button
                      key={loc.id}
                      onClick={() => setSelectedLocationId(loc.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedLocationId === loc.id 
                        ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-100' 
                        : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50'
                      }`}
                    >
                      <p className={`font-semibold text-sm ${selectedLocationId === loc.id ? 'text-primary-800' : 'text-surface-700'}`}>{loc.name}</p>
                      {loc.address && <p className="text-xs text-surface-500 mt-0.5">{loc.address}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date Pickers */}
            {(!Array.isArray(selectedDoctor.availability_schedule) || selectedLocationId) && (
              <>
                <Input
                  label="Select Date"
                  type="date"
                  value={selectedDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                  onChange={e => setSelectedDate(e.target.value)}
                />

            {slots.length === 0 ? (
              <div className="p-6 text-center text-surface-500 text-sm">No slots available on this day</div>
            ) : (
              <>
                {recommendedSlots.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-surface-500 mb-2">⭐ Recommended Slots</p>
                    <div className="grid grid-cols-3 gap-2">
                      {recommendedSlots.map((slot) => (
                        <button
                          key={slot.timeFormatted}
                          onClick={() => handleSelectSlot(slot)}
                          className="relative p-3 rounded-xl border-2 text-sm font-medium transition-all border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100"
                        >
                          {slot.isRecommended && (
                            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full">Best</span>
                          )}
                          {slot.timeFormatted}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-surface-500 mb-2">All available slots</p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.timeFormatted}
                        disabled={!slot.available}
                        onClick={() => handleSelectSlot(slot)}
                        className={`p-2.5 rounded-xl text-xs font-medium transition-all border ${
                          slot.available
                            ? selectedSlot?.timeFormatted === slot.timeFormatted
                              ? 'border-primary-600 bg-primary-600 text-white shadow-glow'
                              : 'border-surface-200 bg-white text-surface-700 hover:border-primary-300 hover:bg-primary-50'
                            : 'border-surface-100 bg-surface-50 text-surface-300 cursor-not-allowed line-through'
                        }`}
                      >
                        {slot.timeFormatted}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
              </>
            )}
          </div>
        )}

        {/* Step 2: Payment */}
        {step === 2 && selectedDoctor && selectedSlot && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-surface-800">Payment Options</p>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>← Back</Button>
            </div>

            {/* Fee Display */}
            <Card className="border-2 border-primary-200 bg-primary-50">
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-surface-600">Consultation Fee</p>
                    <p className="text-2xl font-bold text-primary-700">₹{consultationFee}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-surface-500">{selectedDoctor.specialization}</p>
                    <p className="text-sm text-surface-600">Dr. {selectedDoctor.user?.full_name}</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Payment Timing */}
            <div>
              <p className="text-sm font-medium text-surface-700 mb-2">When to Pay</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentTiming('pay_now')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    paymentTiming === 'pay_now'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-surface-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentTiming === 'pay_now' ? 'bg-primary-600' : 'bg-surface-100'}`}>
                      <Wallet className={`w-5 h-5 ${paymentTiming === 'pay_now' ? 'text-white' : 'text-surface-500'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-surface-800">Pay Now</p>
                      <p className="text-xs text-surface-500">Book & pay instantly</p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentTiming('pay_later')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    paymentTiming === 'pay_later'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-surface-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentTiming === 'pay_later' ? 'bg-primary-600' : 'bg-surface-100'}`}>
                      <Clock className={`w-5 h-5 ${paymentTiming === 'pay_later' ? 'text-white' : 'text-surface-500'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-surface-800">Pay Later</p>
                      <p className="text-xs text-surface-500">Pay after consultation</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Payment Method */}
            {paymentTiming === 'pay_now' && (
              <div>
                <p className="text-sm font-medium text-surface-700 mb-2">Payment Method</p>
                <div className="grid grid-cols-3 gap-3">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value)}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                        paymentMethod === method.value
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-surface-200 hover:border-primary-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method.color}`}>
                        <method.icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-surface-700">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handlePaymentContinue} size="lg" className="w-full">
              Continue to Confirm
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && selectedDoctor && selectedSlot && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-surface-800">Confirm Appointment</p>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>← Back</Button>
            </div>

            {/* Summary card */}
            <Card>
              <CardBody className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-xl">
                    {getSpecialtyIcon(selectedDoctor.specialization)}
                  </div>
                  <div>
                    <p className="font-semibold text-surface-800">{selectedDoctor.user?.full_name}</p>
                    <p className="text-xs text-surface-500">{selectedDoctor.specialization}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-primary-500" />
                  <span className="text-surface-700">
                    {format(new Date(selectedDate), 'EEEE, MMMM dd, yyyy')} at {selectedSlot.timeFormatted}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-primary-500" />
                  <span className="text-surface-500">~{selectedDoctor.consultation_avg_time} min consultation</span>
                </div>
              </CardBody>
            </Card>

            {/* Payment Summary */}
            <Card className="border-2 border-surface-200">
              <CardBody className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-700">Payment Summary</p>
                    <p className="text-xs text-surface-500">
                      {paymentTiming === 'pay_now' ? 'Paid via ' + paymentMethod.toUpperCase() : 'Pay at clinic'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-surface-800">₹{consultationFee}</p>
                    <Badge variant={paymentTiming === 'pay_now' ? 'success' : 'warning'}>
                      {paymentTiming === 'pay_now' ? 'Paid' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              </CardBody>
            </Card>

            <div className="grid sm:grid-cols-2 gap-4">
              <Select
                label="Appointment for"
                error={errors.patient_type?.message}
                required
                {...register('patient_type' as const)}
              >
                <option value="self">Myself ({profile?.full_name})</option>
                {familyMembers.length > 0 && <option value="family">Family Member</option>}
              </Select>

              {patientType === 'family' && (
                <Select
                  label="Select Family Member"
                  error={errors.family_member_id?.message}
                  required
                  {...register('family_member_id' as const)}
                >
                  <option value="">Choose member...</option>
                  {familyMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.relationship})</option>
                  ))}
                </Select>
              )}
            </div>

            <Select
              label="Visit Type"
              error={errors.visit_type?.message}
              required
              {...register('visit_type' as const)}
            >
              <option value="first_visit">First Visit</option>
              <option value="follow_up">Follow Up</option>
              <option value="emergency">Emergency</option>
            </Select>

            <Textarea
              label="Symptoms / Reason for visit"
              placeholder="Describe your symptoms or reason for the appointment..."
              error={errors.symptoms?.message}
              rows={4}
              required
              {...register('symptoms' as const)}
            />

            <Textarea
              label="Additional Notes (optional)"
              placeholder="Any allergies, medications, or special requests..."
              rows={2}
              {...register('notes' as const)}
            />

            <Button type="submit" isLoading={isLoading} size="lg" className="w-full">
              <CheckCircle className="w-4 h-4" />
              Confirm Appointment
            </Button>
          </form>
        )}
      </div>
    </DashboardLayout>
  )
}
