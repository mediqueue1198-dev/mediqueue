import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { User, Phone, Stethoscope, Clock, Save, FileText, Award, Star, MapPin, GraduationCap, Calendar, Users, ChevronDown, ChevronUp, DollarSign, Plus, Trash2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { useAuth } from '@/hooks/useAuth'
import { doctorsService } from '@/services/doctors.service'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

export default function DoctorProfile() {
  const { user, profile, updateProfile } = useAuth()
  const [doctor, setDoctor] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm()

  const DEFAULT_SCHEDULE = {
    monday: { active: true, start: '09:00', end: '17:00', break_start: '', break_end: '' },
    tuesday: { active: true, start: '09:00', end: '17:00', break_start: '', break_end: '' },
    wednesday: { active: true, start: '09:00', end: '17:00', break_start: '', break_end: '' },
    thursday: { active: true, start: '09:00', end: '17:00', break_start: '', break_end: '' },
    friday: { active: true, start: '09:00', end: '17:00', break_start: '', break_end: '' },
    saturday: { active: false, start: '10:00', end: '14:00', break_start: '', break_end: '' },
    sunday: { active: false, start: '10:00', end: '14:00', break_start: '', break_end: '' },
  }

  const [locations, setLocations] = useState([])
  const [showSchedule, setShowSchedule] = useState(true)
  const [showFeeSection, setShowFeeSection] = useState(true)
  const [feeType, setFeeType] = useState('by_visit_type')
  const [firstVisitFee, setFirstVisitFee] = useState('')
  const [followUpFee, setFollowUpFee] = useState('')
  const [emergencyFee, setEmergencyFee] = useState('')
  const [fixedFee, setFixedFee] = useState('')

  useEffect(() => {
    setIsLoading(true)
    doctorsService.getByUserId(user?.id)
      .then(async (data) => {
        setDoctor(data)
        
        if (data?.availability_schedule) {
          if (Array.isArray(data.availability_schedule) && data.availability_schedule.length > 0) {
            setLocations(data.availability_schedule)
          } else if (Object.keys(data.availability_schedule).length > 0) {
            // Convert Legacy Flat Model
            const parsed = { ...DEFAULT_SCHEDULE }
            for (const day in parsed) {
              if (data.availability_schedule[day]) {
                parsed[day] = { active: true, break_start: '', break_end: '', ...data.availability_schedule[day] }
              } else {
                parsed[day].active = false
              }
            }
            setLocations([{
              id: 'loc-default',
              name: data.hospital_name || 'Primary Clinic',
              address: data.location || '',
              schedule: parsed
            }])
          } else {
            // First time initialization
            setLocations([{
              id: 'loc-default',
              name: data.hospital_name || 'Primary Clinic',
              address: data.location || '',
              schedule: { ...DEFAULT_SCHEDULE }
            }])
          }
        }

        if (data?.id) {
          try {
            const feeConfig = await doctorsService.getFeeConfiguration(data.id)
            if (feeConfig) {
              setFeeType(feeConfig.fee_type || 'by_visit_type')
              setFirstVisitFee(feeConfig.first_visit_fee?.toString() || '')
              setFollowUpFee(feeConfig.follow_up_fee?.toString() || '')
              setEmergencyFee(feeConfig.emergency_fee?.toString() || '')
              setFixedFee(feeConfig.fixed_fee?.toString() || '')
            }
          } catch (err) {
            console.error('Error loading fee configuration:', err)
          }
        }

        reset({
          full_name: profile?.full_name || '',
          phone: profile?.phone || '',
          specialization: data?.specialization || '',
          department: data?.department || '',
          experience_years: data?.experience_years || 0,
          consultation_avg_time: data?.consultation_avg_time || 15,
          bio: data?.bio || '',
          education: data?.education || '',
          education_institution: data?.education_institution || '',
        })
      })
      .catch(err => console.error("Error fetching doctor profile", err))
      .finally(() => setIsLoading(false))
  }, [user?.id, profile?.full_name, profile?.phone, reset])

  const onSubmit = async (data) => {
    setIsSaving(true)
    try {
      await updateProfile({ full_name: data.full_name, phone: data.phone })
      
      if (doctor?.id) {
        await doctorsService.update(doctor.id, {
          specialization: data.specialization,
          department: data.department,
          experience_years: parseInt(data.experience_years) || 0,
          consultation_avg_time: parseInt(data.consultation_avg_time) || 15,
          bio: data.bio,
          education: data.education,
          education_institution: data.education_institution,
          availability_schedule: locations
        })

        await doctorsService.updateFeeConfiguration(doctor.id, {
          fee_type: feeType,
          first_visit_fee: parseFloat(firstVisitFee) || 0,
          follow_up_fee: parseFloat(followUpFee) || 0,
          emergency_fee: parseFloat(emergencyFee) || 0,
          fixed_fee: parseFloat(fixedFee) || 0,
        })
      }
      
      toast.success('Profile and fees updated successfully!')
    } catch (err) {
      toast.error('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLocationChange = (locId, field, value) => {
    setLocations(prev => prev.map(loc => loc.id === locId ? { ...loc, [field]: value } : loc))
  }

  const handleScheduleChange = (locId, day, field, value) => {
    setLocations(prev => prev.map(loc => {
      if (loc.id === locId) {
        return {
          ...loc,
          schedule: {
            ...loc.schedule,
            [day]: { ...loc.schedule[day], [field]: value }
          }
        }
      }
      return loc
    }))
  }

  const addLocation = () => setLocations(prev => [...prev, { id: Date.now().toString(), name: '', address: '', schedule: { ...DEFAULT_SCHEDULE } }])
  const removeLocation = (locId) => setLocations(prev => prev.filter(l => l.id !== locId))

  if (isLoading) return <PageLoader />

  return (
    <DashboardLayout title="My Profile" subtitle="Manage your professional information">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile header with stats */}
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-5">
              <Avatar name={profile?.full_name || 'User'} size="2xl" className="w-20 h-20" />
              <div className="flex-1">
                <h2 className="text-xl font-bold font-display text-surface-800">{profile?.full_name || 'User'}</h2>
                <p className="text-surface-500 text-sm">{profile?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="primary">Doctor</Badge>
                  {doctor?.specialization && <Badge variant="success">{doctor.specialization}</Badge>}
                  {doctor?.rating && (
                    <Badge variant="warning" className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-warning-500 fill-warning-500" /> {doctor.rating}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-surface-100">
              <div className="text-center">
                <div className="flex items-center justify-center w-10 h-10 bg-primary-100 rounded-full mx-auto mb-2">
                  <Calendar className="w-5 h-5 text-primary-600" />
                </div>
                <p className="text-2xl font-bold text-surface-800">{doctor?.experience_years || 0}</p>
                <p className="text-xs text-surface-500">Years Exp.</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-10 h-10 bg-medical-100 rounded-full mx-auto mb-2">
                  <Clock className="w-5 h-5 text-medical-600" />
                </div>
                <p className="text-2xl font-bold text-surface-800">{doctor?.consultation_avg_time || 15}</p>
                <p className="text-xs text-surface-500">Min/Consult</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-10 h-10 bg-warning-100 rounded-full mx-auto mb-2">
                  <Users className="w-5 h-5 text-warning-600" />
                </div>
                <p className="text-2xl font-bold text-surface-800">{doctor?.patients_today || 0}</p>
                <p className="text-xs text-surface-500">Patients Today</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Personal Info */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary-600" /> Personal Information
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Full Name" icon={User} {...register('full_name')} error={errors.full_name?.message} />
                <Input label="Phone" type="tel" icon={Phone} {...register('phone')} error={errors.phone?.message} />
              </div>
            </CardBody>
          </Card>

          {/* Professional Details */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-medical-600" /> Professional Details
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Specialization" icon={Award} {...register('specialization')} placeholder="e.g. Cardiologist" />
                <Input label="Department" icon={Stethoscope} {...register('department')} placeholder="e.g. Cardiology" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Experience (Years)" type="number" icon={Award} {...register('experience_years')} />
                <Input label="Avg. Consultation Time (mins)" type="number" icon={Clock} {...register('consultation_avg_time')} />
              </div>
              <Textarea
                label="Professional Biography"
                placeholder="A short biography about your education, experience, and approach to care..."
                rows={4}
                {...register('bio')}
              />
            </CardBody>
          </Card>

          {/* Education & Qualifications */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary-600" /> Education & Qualifications
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input 
                  label="Medical Degree / Qualification" 
                  icon={GraduationCap} 
                  {...register('education')} 
                  placeholder="e.g. MD in Cardiology" 
                />
                <Input 
                  label="Institution / University" 
                  icon={Award} 
                  {...register('education_institution')} 
                  placeholder="e.g. Harvard Medical School" 
                />
              </div>
            </CardBody>
          </Card>

  {/* Omitted Flat Location Details */}

          {/* Consultation Fees */}
          <Card className="mb-4">
            <CardHeader className="cursor-pointer" onClick={() => setShowFeeSection(!showFeeSection)}>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" /> Consultation Fees
              </CardTitle>
              <button type="button" className="ml-auto p-1 hover:bg-surface-100 rounded-lg transition-colors">
                {showFeeSection ? <ChevronUp className="w-5 h-5 text-surface-500" /> : <ChevronDown className="w-5 h-5 text-surface-500" />}
              </button>
            </CardHeader>
            {showFeeSection && (
              <CardBody className="space-y-4">
                <Select
                  label="Fee Type"
                  value={feeType}
                  onChange={(e) => setFeeType(e.target.value)}
                >
                  <option value="by_visit_type">By Visit Type (First Visit, Follow Up, Emergency)</option>
                  <option value="fixed">Fixed Amount (Same for all)</option>
                  <option value="any">No Fixed Amount (Flexible/Any)</option>
                </Select>

                {feeType === 'by_visit_type' && (
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Input
                      label="First Visit Fee (₹)"
                      type="number"
                      min="0"
                      step="1"
                      value={firstVisitFee}
                      onChange={(e) => setFirstVisitFee(e.target.value)}
                      placeholder="0"
                    />
                    <Input
                      label="Follow Up Fee (₹)"
                      type="number"
                      min="0"
                      step="1"
                      value={followUpFee}
                      onChange={(e) => setFollowUpFee(e.target.value)}
                      placeholder="0"
                    />
                    <Input
                      label="Emergency Fee (₹)"
                      type="number"
                      min="0"
                      step="1"
                      value={emergencyFee}
                      onChange={(e) => setEmergencyFee(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                )}

                {feeType === 'fixed' && (
                  <Input
                    label="Fixed Consultation Fee (₹)"
                    type="number"
                    min="0"
                    step="1"
                    value={fixedFee}
                    onChange={(e) => setFixedFee(e.target.value)}
                    placeholder="0"
                  />
                )}

                {feeType === 'any' && (
                  <div className="p-4 bg-surface-50 rounded-xl">
                    <p className="text-sm text-surface-600">
                      <strong>Flexible Pricing:</strong> Patients will be able to pay any amount they choose at the time of consultation.
                    </p>
                  </div>
                )}
              </CardBody>
            )}
          </Card>

          {/* Locations & Working Hours */}
          <Card className="mb-4 overflow-hidden border-2 border-primary-100">
            <CardHeader className="bg-primary-50/50 cursor-pointer" onClick={() => setShowSchedule(!showSchedule)}>
              <CardTitle className="flex items-center gap-2 text-primary-800">
                <MapPin className="w-5 h-5" /> Locations & Working Hours
              </CardTitle>
              <button type="button" className="ml-auto p-1 hover:bg-surface-200 rounded-lg transition-colors">
                {showSchedule ? <ChevronUp className="w-5 h-5 text-surface-600" /> : <ChevronDown className="w-5 h-5 text-surface-600" />}
              </button>
            </CardHeader>
            
            {showSchedule && (
              <CardBody className="space-y-8 !pt-6">
                {locations.map((loc, index) => (
                  <div key={loc.id} className="p-5 bg-white border border-surface-200 rounded-2xl shadow-sm space-y-5">
                    
                    {/* Location Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold font-display">{index + 1}</span>
                          <h4 className="font-semibold text-lg text-surface-800">Clinic / Hospital Location</h4>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <Input 
                            label="Location Name" 
                            placeholder="e.g. Apollo Diagnostics" 
                            value={loc.name}
                            onChange={(e) => handleLocationChange(loc.id, 'name', e.target.value)}
                            required
                          />
                          <Input 
                            label="Full Address" 
                            placeholder="e.g. 123 Health Ave, Mumbai" 
                            value={loc.address}
                            onChange={(e) => handleLocationChange(loc.id, 'address', e.target.value)}
                          />
                        </div>
                      </div>
                      
                      {locations.length > 1 && (
                        <Button 
                          type="button"
                          variant="danger" 
                          size="sm" 
                          outline 
                          onClick={() => removeLocation(loc.id)}
                          className="mt-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Schedule Grid */}
                    <div className="pt-4 border-t border-surface-100">
                      <h5 className="text-sm font-semibold text-surface-700 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-surface-400" /> Weekly Schedule
                      </h5>
                      <div className="space-y-2">
                        {Object.entries(loc.schedule).map(([day, data]) => (
                          <div key={day} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl transition-colors ${data.active ? 'bg-surface-50 border border-surface-100' : 'bg-surface-50/50'}`}>
                            
                            <div className="w-32 flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 text-primary-600 rounded border-surface-300 transition-all focus:ring-primary-500"
                                checked={data.active}
                                onChange={(e) => handleScheduleChange(loc.id, day, 'active', e.target.checked)}
                              />
                              <span className={`text-sm font-medium capitalize ${data.active ? 'text-surface-800' : 'text-surface-400'}`}>{day}</span>
                            </div>
                            
                            {data.active ? (
                              <div className="flex-1 flex items-center gap-3">
                                <span className="text-xs text-surface-500 font-medium hidden sm:block">Hours</span>
                                <input 
                                  type="time" 
                                  value={data.start} 
                                  onChange={(e) => handleScheduleChange(loc.id, day, 'start', e.target.value)}
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-surface-200 bg-white text-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                                <span className="text-surface-400 text-xs">to</span>
                                <input 
                                  type="time" 
                                  value={data.end} 
                                  onChange={(e) => handleScheduleChange(loc.id, day, 'end', e.target.value)}
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-surface-200 bg-white text-surface-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                              </div>
                            ) : (
                              <div className="flex-1 text-sm text-surface-400 italic">Off Duty</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                ))}

                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={addLocation}
                  className="w-full border-dashed border-2 py-4 text-surface-600 hover:text-primary-700 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" /> Add Another Location
                </Button>
              </CardBody>
            )}
          </Card>

          <div className="flex justify-end mt-6">
            <Button type="submit" isLoading={isSaving}>
              <Save className="w-4 h-4 mr-2" /> Save Professional Profile
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}