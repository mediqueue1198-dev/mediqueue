import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { User, Phone, Stethoscope, Clock, Save, FileText, Award, Star, MapPin, GraduationCap, Calendar, Users, ChevronDown, ChevronUp, DollarSign, Plus, Trash2, Key, Mail, CheckCircle, XCircle, AlertCircle, Search, UserPlus } from 'lucide-react'
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
import supabase from '@/lib/supabase'

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DEFAULT_SCHEDULE = {
  monday: { active: true, start: '09:00', end: '22:00', break_start: '', break_end: '' },
  tuesday: { active: true, start: '09:00', end: '22:00', break_start: '', break_end: '' },
  wednesday: { active: true, start: '09:00', end: '22:00', break_start: '', break_end: '' },
  thursday: { active: true, start: '09:00', end: '22:00', break_start: '', break_end: '' },
  friday: { active: true, start: '09:00', end: '22:00', break_start: '', break_end: '' },
  saturday: { active: true, start: '10:00', end: '14:00', break_start: '', break_end: '' },
  sunday: { active: true, start: '10:00', end: '14:00', break_start: '', break_end: '' },
}

export default function DoctorProfile() {
  const { user, profile, updateProfile } = useAuth()
  const [doctor, setDoctor] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Staff Management State
  const [mediators, setMediators] = useState([])
  const [isStaffLoading, setIsStaffLoading] = useState(false)
  const [showAddMediator, setShowAddMediator] = useState(false)
  const [newMediator, setNewMediator] = useState({ full_name: '', email: '', password: '' })
  const [isCreatingStaff, setIsCreatingStaff] = useState(false)
  const [pendingRequests, setPendingRequests] = useState([])

  const handleAssignment = async (assignmentId, status) => {
    try {
      const { error } = await supabase
        .from('mediator_assignments')
        .update({ status })
        .eq('id', assignmentId)
      
      if (error) throw error
      toast.success(status === 'approved' ? 'Staff access approved' : 'Request rejected')
      loadManagedStaff(doctor)
    } catch (err) {
      toast.error('Action failed')
    }
  }

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const [locations, setLocations] = useState([])
  const [showSchedule, setShowSchedule] = useState(true)
  const [showFeeSection, setShowFeeSection] = useState(true)
  const [feeType, setFeeType] = useState('by_visit_type')
  const [firstVisitFee, setFirstVisitFee] = useState('')
  const [followUpFee, setFollowUpFee] = useState('')
  const [emergencyFee, setEmergencyFee] = useState('')
  const [fixedFee, setFixedFee] = useState('')

  useEffect(() => {
    if (!user?.id) return
    setIsLoading(true)
    doctorsService.getByUserId(user.id)
      .then(async (data) => {
        setDoctor(data)
        loadManagedStaff(data)
        
        if (data?.availability_schedule) {
          if (Array.isArray(data.availability_schedule) && data.availability_schedule.length > 0) {
            setLocations(data.availability_schedule)
          } else if (Object.keys(data.availability_schedule).length > 0) {
            const parsed = { ...DEFAULT_SCHEDULE }
            for (const day in parsed) {
              if (data.availability_schedule[day]) {
                parsed[day] = { active: true, break_start: '', break_end: '', ...data.availability_schedule[day] }
              } else {
                parsed[day].active = false
              }
            }
            setLocations([{ id: 'loc-default', name: data.hospital_name || 'Primary Clinic', address: data.location || '', schedule: parsed }])
          } else {
            setLocations([{ id: 'loc-default', name: data.hospital_name || 'Primary Clinic', address: data.location || '', schedule: { ...DEFAULT_SCHEDULE } }])
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
          } catch (err) { console.error('Error loading fee configuration:', err) }
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

  const loadManagedStaff = async (doctorData) => {
    const doctorTableId = doctorData?.id
    if (!doctorTableId) return
    
    setIsStaffLoading(true)
    try {
      const { data: assignments, error: assignError } = await supabase
        .from('mediator_assignments')
        .select(`
          id,
          status,
          created_at,
          mediator:mediators (
            id,
            user_id,
            user:users!mediators_user_id_fkey (full_name, email, avatar_url)
          )
        `)
        .eq('doctor_id', doctorTableId)
      
      if (assignError) throw assignError
      
      const allStaff = assignments.filter(a => a.status !== 'rejected').map(a => ({
        ...a.mediator,
        assignment_id: a.id,
        assignment_status: a.status,
        created_at: a.created_at
      }))
      
      const pending = allStaff.filter(s => s.assignment_status === 'pending')
      const approved = allStaff.filter(s => s.assignment_status === 'approved' || s.assignment_status === 'suspended')
      
      setMediators(approved)
      setPendingRequests(pending)
    } catch (err) {
      console.error('Failed to load staff:', err)
    } finally {
      setIsStaffLoading(false)
    }
  }

  const handleCreateMediator = async (e) => {
    e.preventDefault()
    if (!newMediator.email || !newMediator.password || !newMediator.full_name) {
      return toast.error('Please fill all fields')
    }

    setIsCreatingStaff(true)
    try {
      const { data, error } = await supabase.rpc('admin_create_mediator', {
        p_email: newMediator.email,
        p_password_hash: newMediator.password,
        p_full_name: newMediator.full_name,
        p_hospital_id: doctor?.hospital_id,
        p_doctor_id: user.id
      })

      if (error) throw error
      
      toast.success('Mediator account created successfully!')
      setNewMediator({ full_name: '', email: '', password: '' })
      setShowAddMediator(false)
      loadManagedStaff(doctor)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to create mediator account')
    } finally {
      setIsCreatingStaff(false)
    }
  }

  const toggleMediatorApproval = async (mediatorId, assignmentId, currentApproved) => {
    console.log('[StaffAction] Toggling status:', { mediatorId, assignmentId, currentApproved })
    try {
      const newStatus = currentApproved ? 'suspended' : 'approved'
      const { error } = await supabase
        .from('mediator_assignments')
        .update({ status: newStatus })
        .eq('id', assignmentId)
      
      if (error) throw error
      toast.success(`Staff access ${currentApproved ? 'suspended' : 'approved'}`)
      loadManagedStaff(doctor)
    } catch (err) {
      console.error('[StaffAction] Toggle error:', err)
      toast.error('Failed to update status')
    }
  }

  const handleDeleteMediator = async (mediatorId, userId) => {
    if (!confirm('Are you sure you want to remove this staff member? This will delete their account access.')) return
    try {
      await supabase.from('mediators').delete().eq('id', mediatorId)
      setMediators(prev => prev.filter(m => m.id !== mediatorId))
      toast.success('Staff member removed')
    } catch (err) {
      toast.error('Failed to remove staff')
    }
  }

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
    <DashboardLayout title="Doctor Profile" subtitle="Manage your preferences and clinical staff">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Profile header */}
        <Card className="border-none shadow-premium bg-gradient-to-br from-white to-primary-50/20">
          <CardBody className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="relative group">
                <Avatar name={profile?.full_name || 'User'} size="2xl" className="w-28 h-28 ring-4 ring-white shadow-lg" />
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                   <Plus className="text-white w-6 h-6" />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-bold font-display text-surface-900 mb-1">{profile?.full_name || 'User'}</h2>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-surface-500 text-sm mb-4">
                  <span className="flex items-center gap-1"><Mail className="w-4 h-4" /> {profile?.email}</span>
                  <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {profile?.phone || 'No phone added'}</span>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                  <Badge variant="primary">Verified Provider</Badge>
                  {doctor?.specialization && <Badge variant="success">{doctor.specialization}</Badge>}
                  {doctor?.rating && (
                    <Badge variant="warning" className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-warning-500 fill-warning-500" /> {doctor.rating} Rating
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex md:flex-col gap-3">
                 <div className="text-center md:text-right px-4">
                    <p className="text-2xl font-bold text-primary-600">{doctor?.experience_years || 0}</p>
                    <p className="text-[10px] uppercase font-bold text-surface-400 tracking-wider">Years Exp.</p>
                 </div>
                 <div className="text-center md:text-right px-4 md:border-t md:border-surface-100 md:pt-2">
                    <p className="text-2xl font-bold text-medical-600">{doctor?.consultation_avg_time || 15}</p>
                    <p className="text-[10px] uppercase font-bold text-surface-400 tracking-wider">Min / Visit</p>
                 </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Staff Management Section */}
        <Card className="border-none shadow-premium overflow-hidden">
          <CardHeader className="bg-white border-b border-surface-100 p-6">
             <div className="flex items-center justify-between">
                <div>
                   <CardTitle className="text-surface-900 text-xl flex items-center gap-2">
                      <Users className="w-6 h-6 text-primary-600" /> Manage Clinical Staff
                   </CardTitle>
                   <p className="text-surface-500 text-xs mt-1 font-medium">Add and approve staff members for your clinical operations</p>
                </div>
                <Button 
                  size="sm" 
                  variant="primary"
                  icon={UserPlus}
                  onClick={() => setShowAddMediator(!showAddMediator)}
                  className="rounded-xl shadow-lg shadow-primary-500/10"
                >
                   {showAddMediator ? 'Close' : 'Add Mediator'}
                </Button>
             </div>
          </CardHeader>

          {pendingRequests.length > 0 && (
            <div className="bg-primary-50/50 p-6 border-b border-primary-100">
               <p className="text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Clock className="w-3.5 h-3.5" /> Incoming Staff Requests
               </p>
               <div className="grid gap-3">
                  {pendingRequests.map(req => (
                    <div key={req.assignment_id} className="bg-white rounded-2xl p-4 flex items-center justify-between border border-primary-100 shadow-sm animate-in zoom-in-95 duration-300">
                       <div className="flex items-center gap-4">
                          <Avatar name={req.user?.full_name} size="md" className="ring-2 ring-primary-50 transition-all" />
                          <div>
                             <p className="text-sm font-bold text-surface-900">{req.user?.full_name}</p>
                             <p className="text-xs text-primary-600/70 font-medium">{req.user?.email}</p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="primary" 
                            className="h-9 px-5 rounded-xl text-xs font-bold"
                            onClick={() => handleAssignment(req.assignment_id, 'approved')}
                          >
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-9 px-5 rounded-xl text-xs font-bold text-surface-400 hover:text-danger-600 hover:bg-danger-50"
                            onClick={() => handleAssignment(req.assignment_id, 'rejected')}
                          >
                            Reject
                          </Button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
          
          {showAddMediator && (
            <div className="p-8 bg-surface-50 border-b border-surface-100 animate-in slide-in-from-top-4 duration-300">
               <form onSubmit={handleCreateMediator} className="max-w-3xl mx-auto space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Full Name</label>
                        <input 
                           className="w-full bg-white border border-surface-200 text-surface-900 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/50 outline-none transition-all placeholder:text-surface-300 shadow-sm"
                           placeholder="John Doe"
                           value={newMediator.full_name}
                           onChange={e => setNewMediator({...newMediator, full_name: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Email Address</label>
                        <input 
                           type="email"
                           className="w-full bg-white border border-surface-200 text-surface-900 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500/50 outline-none transition-all placeholder:text-surface-300 shadow-sm"
                           placeholder="staff@example.com"
                           value={newMediator.email}
                           onChange={e => setNewMediator({...newMediator, email: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-surface-400 uppercase tracking-widest ml-1">Temp Password</label>
                        <div className="relative">
                           <input 
                              type="text"
                              className="w-full bg-white border border-surface-200 text-surface-900 rounded-2xl pl-4 pr-10 py-3 text-sm focus:ring-2 focus:ring-primary-500/50 outline-none transition-all placeholder:text-surface-300 shadow-sm"
                              placeholder="Set initial password"
                              value={newMediator.password}
                              onChange={e => setNewMediator({...newMediator, password: e.target.value})}
                           />
                           <Key className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-300" />
                        </div>
                     </div>
                  </div>
                  <div className="flex justify-end gap-3">
                     <Button 
                       variant="ghost" 
                       className="text-surface-500 hover:text-surface-900 rounded-xl px-6" 
                       onClick={() => setShowAddMediator(false)}
                     >
                       Cancel
                     </Button>
                     <Button 
                       variant="primary" 
                       isLoading={isCreatingStaff} 
                       type="submit" 
                       icon={UserPlus}
                       className="rounded-xl px-8"
                     >
                        Register Clinical Staff
                     </Button>
                  </div>
               </form>
            </div>
          )}

          <CardBody className="p-0">
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-surface-50 border-b border-surface-100">
                      <tr>
                         <th className="px-6 py-4 text-[10px] font-bold text-surface-400 uppercase tracking-widest">Mediator Profile</th>
                         <th className="px-6 py-4 text-[10px] font-bold text-surface-400 uppercase tracking-widest text-center">Added Date</th>
                         <th className="px-6 py-4 text-[10px] font-bold text-surface-400 uppercase tracking-widest text-center">Status</th>
                         <th className="px-6 py-4 text-[10px] font-bold text-surface-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-surface-50">
                      {isStaffLoading ? (
                        <tr><td colSpan={4} className="p-12 text-center text-surface-400 italic">Synchronizing staff data...</td></tr>
                      ) : mediators.length === 0 ? (
                        <tr><td colSpan={4} className="p-12 text-center text-surface-400">No managed staff members yet. Use the "Add Mediator" button to invite team members.</td></tr>
                      ) : (
                        mediators.map((mediator) => (
                           <tr key={mediator.id} className="hover:bg-surface-50 transition-colors">
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-3">
                                    <Avatar name={mediator.user?.full_name} size="sm" />
                                    <div>
                                       <p className="text-sm font-bold text-surface-800">{mediator.user?.full_name}</p>
                                       <p className="text-[10px] text-surface-500">{mediator.user?.email}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                 <span className="text-xs text-surface-500 font-medium">
                                    {new Date(mediator.created_at).toLocaleDateString()}
                                 </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                 {mediator.assignment_status === 'approved' ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                                       <CheckCircle className="w-3 h-3" /> ACTIVE
                                    </span>
                                 ) : mediator.assignment_status === 'suspended' ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
                                       <AlertCircle className="w-3 h-3" /> SUSPENDED
                                    </span>
                                 ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                                       <Clock className="w-3 h-3" /> PENDING
                                    </span>
                                 )}
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex items-center justify-end gap-2">
                                    <Button 
                                       size="sm" 
                                       variant={mediator.assignment_status === 'approved' ? 'ghost' : 'primary'} 
                                       className={mediator.assignment_status === 'approved' ? 'text-danger-600 hover:bg-danger-50' : ''}
                                       onClick={() => toggleMediatorApproval(mediator.id, mediator.assignment_id, mediator.assignment_status === 'approved')}
                                    >
                                       {mediator.assignment_status === 'approved' ? 'Suspend' : 'Approve Access'}
                                    </Button>
                                    <button 
                                       onClick={() => handleDeleteMediator(mediator.id, mediator.user_id)}
                                       className="p-2 text-surface-400 hover:text-danger-600 hover:bg-danger-50 rounded-xl transition-all"
                                    >
                                       <Trash2 className="w-4 h-4" />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))
                      )}
                   </tbody>
                </table>
             </div>
          </CardBody>
        </Card>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Main Professional Profile */}
          <Card className="border-none shadow-premium mb-6 overflow-hidden">
             <CardHeader className="bg-white border-b border-surface-100 p-6">
                <CardTitle className="text-lg flex items-center gap-2">
                   <User className="w-5 h-5 text-primary-500" /> Personal & Professional Details
                </CardTitle>
             </CardHeader>
             <CardBody className="p-6 space-y-6">
                 <div className="grid md:grid-cols-2 gap-6">
                    <Input label="Full Name" icon={User} {...register('full_name')} />
                    <Input label="Direct Phone" icon={Phone} {...register('phone')} />
                 </div>
                 <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-surface-50">
                    <Input label="Clinical Specialization" icon={Award} {...register('specialization')} placeholder="e.g. Cardiologist" />
                    <Input label="Primary Department" icon={Stethoscope} {...register('department')} placeholder="e.g. Cardiology" />
                 </div>
                 <div className="grid md:grid-cols-2 gap-6">
                    <Input label="Experience (Years)" type="number" icon={Calendar} {...register('experience_years')} />
                    <Input label="Avg. Consultation Time (Mins)" type="number" icon={Clock} {...register('consultation_avg_time')} />
                 </div>
                 <Textarea
                    label="Clinical Summary / Bio"
                    placeholder="Brief overview of your professional background..."
                    rows={4}
                    {...register('bio')}
                 />
             </CardBody>
          </Card>

          {/* Education & Fees Sections */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
             <Card className="border-none shadow-premium h-full">
                <CardHeader className="p-6 pb-0"><CardTitle className="text-base flex items-center gap-2 font-bold"><GraduationCap className="w-5 h-5 text-primary-500" /> Education</CardTitle></CardHeader>
                <CardBody className="p-6 space-y-4">
                    <Input label="Degree / Qualification" {...register('education')} />
                    <Input label="Medical School" {...register('education_institution')} />
                </CardBody>
             </Card>

             <Card className="border-none shadow-premium h-full">
                <CardHeader className="p-6 pb-0"><CardTitle className="text-base flex items-center gap-2 font-bold"><DollarSign className="w-5 h-5 text-green-500" /> Fee Structure</CardTitle></CardHeader>
                <CardBody className="p-6 space-y-4">
                   <Select label="Pricing Model" value={feeType} onChange={(e) => setFeeType(e.target.value)}>
                      <option value="by_visit_type">Tiered Base (First/Follow-up)</option>
                      <option value="fixed">Flat Consultation Fee</option>
                      <option value="any">Patient Consent Based</option>
                   </Select>
                   {feeType === 'by_visit_type' && (
                     <div className="grid grid-cols-2 gap-3 pt-2">
                        <Input label="First Visit" type="number" value={firstVisitFee} onChange={e => setFirstVisitFee(e.target.value)} icon={DollarSign} />
                        <Input label="Follow Up" type="number" value={followUpFee} onChange={e => setFollowUpFee(e.target.value)} icon={DollarSign} />
                     </div>
                   )}
                   {feeType === 'fixed' && <Input label="Consultation Amount" type="number" value={fixedFee} onChange={e => setFixedFee(e.target.value)} icon={DollarSign} />}
                </CardBody>
             </Card>
          </div>

          {/* Locations Section */}
          <Card className="border-none shadow-premium mb-6">
            <CardHeader className="p-6 bg-surface-50 border-b border-surface-100 flex items-center justify-between">
               <CardTitle className="text-base flex items-center gap-2"><MapPin className="w-5 h-5 text-primary-500" /> Clinic Locations & Schedules</CardTitle>
               <Button size="sm" variant="ghost" icon={Plus} onClick={addLocation}>Add Clinic</Button>
            </CardHeader>
            <CardBody className="p-6 space-y-6">
               {locations.map((loc, idx) => (
                 <div key={loc.id} className="p-4 bg-surface-50 rounded-2xl border border-surface-100">
                    <div className="flex justify-between items-start mb-4">
                       <p className="font-display font-bold text-surface-400 text-xs tracking-widest uppercase mt-1">#0{idx+1} SITE CONFIG</p>
                       {locations.length > 1 && <button onClick={() => removeLocation(loc.id)}><XCircle className="w-5 h-5 text-danger-300" /></button>}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                       <Input label="Clinic Name" value={loc.name} onChange={e => handleLocationChange(loc.id, 'name', e.target.value)} />
                       <Input label="Full Address" value={loc.address} onChange={e => handleLocationChange(loc.id, 'address', e.target.value)} />
                    </div>
                    {/* Collapsible/Simplified Schedule View */}
                    <div className="mt-6 border-t border-surface-100 pt-6">
                       <button 
                         type="button"
                         onClick={() => setShowSchedule(!showSchedule)}
                         className="flex items-center justify-between w-full py-2 group"
                       >
                          <p className="text-sm font-bold text-surface-800 flex items-center gap-2">
                             <Clock className="w-4 h-4 text-primary-500" /> Clinical Hours & Availability
                          </p>
                          {showSchedule ? <ChevronUp className="w-4 h-4 text-surface-400 group-hover:text-surface-600" /> : <ChevronDown className="w-4 h-4 text-surface-400 group-hover:text-surface-600" />}
                       </button>

                       {showSchedule && (
                         <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            {DAYS_ORDER.map((day) => {
                               const config = loc.schedule[day] || { active: false, start: '09:00', end: '17:00' };
                               return (
                               <div key={day} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border ${config.active ? 'bg-white border-primary-100 shadow-sm' : 'bg-surface-50 border-surface-100 opacity-60'}`}>
                                  <div className="flex items-center gap-3 min-w-[120px]">
                                     <input 
                                        type="checkbox" 
                                        checked={config.active}
                                        onChange={(e) => handleScheduleChange(loc.id, day, 'active', e.target.checked)}
                                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-surface-300 cursor-pointer"
                                     />
                                     <span className="text-sm font-bold capitalize text-surface-700">{day}</span>
                                  </div>
                                  
                                  {config.active && (
                                     <div className="flex-1 grid grid-cols-2 sm:flex sm:items-center gap-4">
                                        <div className="flex items-center gap-2">
                                           <span className="text-[10px] font-bold text-surface-400 uppercase">Start</span>
                                           <input 
                                              type="time" 
                                              value={config.start} 
                                              onChange={e => handleScheduleChange(loc.id, day, 'start', e.target.value)}
                                              className="bg-surface-50 border-none rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-primary-500/50 outline-none"
                                           />
                                        </div>
                                        <div className="flex items-center gap-2">
                                           <span className="text-[10px] font-bold text-surface-400 uppercase">End</span>
                                           <input 
                                              type="time" 
                                              value={config.end} 
                                              onChange={e => handleScheduleChange(loc.id, day, 'end', e.target.value)}
                                              className="bg-surface-50 border-none rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-primary-500/50 outline-none"
                                           />
                                        </div>
                                     </div>
                                  )}
                               </div>
                               );
                            })}
                         </div>
                       )}
                     </div>
                  </div>
                ))}
            </CardBody>
           </Card>

          <div className="sticky bottom-6 flex justify-end">
            <Button type="submit" isLoading={isSaving} size="lg" className="shadow-premium shadow-primary-500/20">
              <Save className="w-5 h-5 mr-2" /> Sync Clinical Profile
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}