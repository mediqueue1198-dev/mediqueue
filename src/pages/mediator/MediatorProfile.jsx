import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { User, Phone, Save, Shield } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

export default function MediatorProfile() {
  const { user, profile, updateProfile } = useAuth()
  const [isSaving, setIsSaving] = useState(false)

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm({
    defaultValues: {
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
    }
  })

  const onSubmit = async (data) => {
    setIsSaving(true)
    try {
      await updateProfile({ full_name: data.full_name, phone: data.phone })
      toast.success('Mediator profile updated!')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DashboardLayout title="Hospital Administrator" subtitle="Manage your staff profile">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile header */}
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-5">
              <Avatar name={profile?.full_name || 'Admin'} size="2xl" />
              <div>
                <h2 className="text-xl font-bold font-display text-surface-800">{profile?.full_name || 'Admin'}</h2>
                <p className="text-surface-500 text-sm">{profile?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="primary" className="flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Mediator
                  </Badge>
                  <Badge variant="neutral">Staff Member</Badge>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Profile Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary-600" /> Account Security & Info
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Full Name" icon={User} {...register('full_name')} error={errors.full_name?.message} />
                <Input label="Direct Phone" type="tel" icon={Phone} {...register('phone')} error={errors.phone?.message} />
              </div>
              <Input label="Email Address" value={profile?.email || user?.email || ''} disabled />
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" isLoading={isSaving} disabled={!isDirty && !isSaving}>
              <Save className="w-4 h-4 mr-2" /> Save Profile Setting
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
