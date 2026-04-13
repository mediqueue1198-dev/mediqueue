import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { User, Phone, Calendar, Heart, AlertCircle, Save, Users, ChevronRight } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { patientsService } from '@/services/patients.service'
import { formatAge } from '@/utils/helpers'
import toast from 'react-hot-toast'

export default function PatientProfile() {
  const { user, profile, updateProfile } = useAuth()
  const [patient, setPatient] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm()

  useEffect(() => {
    setIsLoading(true)
    patientsService.getByUserId(user?.id)
      .then(data => {
        setPatient(data)
        reset({
          full_name: profile?.full_name || '',
          phone: profile?.phone || '',
          date_of_birth: data?.date_of_birth || '',
          blood_type: data?.blood_type || '',
          allergies: data?.allergies?.join(', ') || '',
          emergency_contact_name: data?.emergency_contact?.name || '',
          emergency_contact_phone: data?.emergency_contact?.phone || '',
          emergency_contact_relation: data?.emergency_contact?.relation || '',
        })
      })
      .finally(() => setIsLoading(false))
  }, [user?.id])

  const onSubmit = async (data) => {
    setIsSaving(true)
    try {
      updateProfile({ full_name: data.full_name, phone: data.phone })
      toast.success('Profile updated successfully!')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DashboardLayout title="My Profile" subtitle="Manage your personal information">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile header */}
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-5">
              <Avatar name={profile?.full_name} size="2xl" />
              <div>
                <h2 className="text-xl font-bold font-display text-surface-800">{profile?.full_name}</h2>
                <p className="text-surface-500 text-sm">{profile?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="primary">Patient</Badge>
                  {patient?.blood_type && <Badge variant="danger">🩸 {patient.blood_type}</Badge>}
                  {patient?.date_of_birth && (
                    <Badge variant="neutral">Age {formatAge(patient.date_of_birth)}</Badge>
                  )}
                </div>
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
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Date of Birth" type="date" icon={Calendar} {...register('date_of_birth')} />
                <Select label="Blood Type" {...register('blood_type')}>
                  <option value="">Select blood type</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </Select>
              </div>
              <Input
                label="Allergies (comma separated)"
                placeholder="Penicillin, Shellfish, Latex..."
                icon={AlertCircle}
                {...register('allergies')}
              />
            </CardBody>
          </Card>

          {/* Emergency Contact */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-danger-600" /> Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Contact Name" icon={User} {...register('emergency_contact_name')} />
                <Input label="Relationship" placeholder="Spouse, Parent, Sibling..." {...register('emergency_contact_relation')} />
              </div>
              <Input label="Contact Phone" type="tel" icon={Phone} {...register('emergency_contact_phone')} />
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" isLoading={isSaving} disabled={!isDirty && !isSaving}>
              <Save className="w-4 h-4" /> Save Changes
            </Button>
          </div>
        </form>

        {/* Family Members Quick Access */}
        <Card className="border-2 border-primary-100">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-semibold text-surface-800 text-sm">Family Members</p>
                  <p className="text-xs text-surface-500">Book appointments for your family</p>
                </div>
              </div>
              <Link to="/patient/family">
                <Button variant="ghost" size="sm" className="text-primary-600">
                  Manage <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  )
}
