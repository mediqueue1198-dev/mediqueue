import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { completeProfileSchema } from '@/utils/validators'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { User, Stethoscope, Building2, MapPin, Sparkles, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import toast from 'react-hot-toast'
import { cn } from '@/utils/helpers'

const SPECIALITIES = [
  { label: 'General Medicine', value: 'General Medicine' },
  { label: 'Cardiology', value: 'Cardiology' },
  { label: 'Dermatology', value: 'Dermatology' },
  { label: 'Pediatrics', value: 'Pediatrics' },
  { label: 'Orthopedics', value: 'Orthopedics' },
  { label: 'Neurology', value: 'Neurology' },
  { label: 'Ophthalmology', value: 'Ophthalmology' },
  { label: 'Psychiatry', value: 'Psychiatry' },
  { label: 'Oncology', value: 'Oncology' },
  { label: 'ENT', value: 'ENT' },
]

const DEPARTMENTS = [
  { label: 'OPD (Out-Patient)', value: 'OPD' },
  { label: 'Emergency', value: 'Emergency' },
  { label: 'In-patient Ward', value: 'In-patient' },
  { label: 'Surgery', value: 'Surgery' },
  { label: 'Radiology', value: 'Radiology' },
  { label: 'Laboratory', value: 'Laboratory' },
]

export default function CompleteProfile() {
  const { profile, updateProfile, user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      email: profile?.email || '',
      full_name: profile?.name || profile?.full_name || '',
      role: profile?.role || 'doctor',
      specialization: '',
      department: '',
      location_city: '',
      location_country: 'India',
      phone: profile?.phone || '', // Keep hidden but in schema
    }
  })

  // Watch fields for progress calculation
  const watchedFields = watch(['full_name', 'location_city', 'specialization', 'department'])
  const filledFields = watchedFields.filter(Boolean).length
  const progress = (filledFields / 4) * 100

  useEffect(() => {
    if (profile?.full_name) setValue('full_name', profile.full_name)
    if (profile?.role) setValue('role', profile.role)
  }, [profile, setValue])

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      
      // Update core user profile
      await updateProfile({
        full_name: data.full_name
      })

      if (profile?.role === 'doctor') {
        const { error: doctorError } = await supabase.from('doctors').upsert({ 
          user_id: user?.id,
          specialization: data.specialization,
          department: data.department,
          location_city: data.location_city,
          location_country: data.location_country,
          name: data.full_name,
          is_onboarded: true
        }, { onConflict: 'user_id' })
        
        if (doctorError) throw doctorError
      } else if (profile?.role === 'patient') {
        const { error: patientError } = await supabase.from('patients').upsert({ 
          user_id: user?.id,
          name: data.full_name,
          patient_name: data.full_name
        }, { onConflict: 'user_id' })
        
        if (patientError) throw patientError
      }

      await refreshProfile()
      toast.success('Professional profile activated! 🎊')
      navigate('/')
    } catch (err: any) {
      console.error('Onboarding error:', err)
      toast.error(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-medical-50 px-4 py-8">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary-200/20 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-medical-200/20 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-xl relative">
        <div className="bg-white rounded-[3rem] shadow-premium-xl border border-surface-100 overflow-hidden">
          {/* Top Progress Bar */}
          <div className="h-2 w-full bg-surface-100 flex">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-medical-500 transition-all duration-700 ease-out" 
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-10 md:p-14">
            <header className="mb-10 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-50 rounded-[2.5rem] mb-6 animate-pulse-subtle">
                {profile?.role === 'doctor' ? (
                  <Stethoscope className="w-10 h-10 text-primary-600" />
                ) : (
                  <User className="w-10 h-10 text-primary-600" />
                )}
              </div>
              <h1 className="text-3xl font-black text-surface-900 font-display tracking-tight mb-2">
                {profile?.role === 'doctor' ? 'Medical Orientation' : 'Account Verification'}
              </h1>
              <p className="text-surface-500 font-medium max-w-xs mx-auto">
                {profile?.role === 'doctor' 
                  ? 'Just 4 clinical details to activate your professional practice.' 
                  : 'Complete your profile details to get started.'}
              </p>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Display Name"
                  icon={User}
                  placeholder="e.g. Samuel Gourav"
                  error={errors.full_name?.message as string}
                  {...register('full_name')}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                />
                
                <Input
                  label="City"
                  icon={MapPin}
                  placeholder="e.g. New York"
                  error={errors.location_city?.message as string}
                  {...register('location_city')}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75"
                />
              </div>

              {profile?.role === 'doctor' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Select
                    label="Expert Specialty"
                    icon={Sparkles}
                    options={SPECIALITIES}
                    value={watch('specialization')}
                    onChange={(val) => setValue('specialization', val)}
                    error={errors.specialization?.message as string}
                    placeholder="Choose specialty..."
                    className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150"
                  />

                  <Select
                    label="Primary Department"
                    icon={Building2}
                    options={DEPARTMENTS}
                    value={watch('department')}
                    onChange={(val) => setValue('department', val)}
                    error={errors.department?.message as string}
                    placeholder="Choose department..."
                    className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200"
                  />
                </div>
              )}

              <footer className="pt-6">
                <Button 
                  type="submit" 
                  isLoading={loading} 
                  size="lg" 
                  className={cn(
                    "w-full h-16 rounded-2xl shadow-xl transition-all duration-500 font-bold text-lg group",
                    progress === 100 ? "bg-primary-600 shadow-primary-200" : "bg-surface-800 opacity-90 shadow-surface-100"
                  )}
                >
                  <span className="flex items-center justify-center gap-2">
                    {progress === 100 ? 'Finalize Registration' : 'Complete All Fields'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
                
                <p className="text-center text-[10px] font-black text-surface-300 uppercase tracking-[0.2em] mt-8">
                  Security Level: Medical Grade Protocol
                </p>
              </footer>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
