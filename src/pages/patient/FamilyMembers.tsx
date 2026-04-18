import { useState, useEffect } from 'react'
import { Plus, Trash2, Users, Edit2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import Modal, { ModalBody, ModalFooter } from '@/components/ui/Modal'
import { familyMemberSchema } from '@/utils/validators'
import { patientsService } from '@/services/patients.service'
import { useAuth } from '@/hooks/useAuth'
import { formatAge, formatDate } from '@/utils/helpers'
import { FamilyMember } from '@/types/patients'
import toast from 'react-hot-toast'

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Other']
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function FamilyMembers() {
  const { user } = useAuth()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(familyMemberSchema),
  })

  useEffect(() => {
    if (!user?.id) return
    patientsService.getFamilyMembers(user.id)
      .then(setMembers)
      .finally(() => setIsLoading(false))
  }, [user?.id])

  const openAddModal = () => {
    setEditingMember(null)
    reset({ name: '', relationship: '', date_of_birth: '', blood_type: '', notes: '' })
    setShowModal(true)
  }

  const openEditModal = (member: FamilyMember) => {
    setEditingMember(member)
    reset({
      name: member.name || '',
      relationship: member.relationship || '',
      date_of_birth: member.date_of_birth || '',
      blood_type: member.blood_type || '',
      notes: member.notes || '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingMember(null)
    reset()
  }

  const onSubmit = async (data: any) => {
    setIsSaving(true)
    try {
      if (editingMember) {
        const updated = await patientsService.updateFamilyMember(editingMember.id, data)
        setMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...updated } : m))
        toast.success('Family member updated!')
      } else {
        const newMember = await patientsService.addFamilyMember({ ...data, patient_id: user?.id })
        setMembers(prev => [...prev, newMember])
        toast.success('Family member added!')
      }
      closeModal()
    } catch {
      toast.error(editingMember ? 'Failed to update family member' : 'Failed to add family member')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this family member?')) return
    setDeletingId(id)
    try {
      await patientsService.deleteFamilyMember(id)
      setMembers(prev => prev.filter(m => m.id !== id))
      toast.success('Family member removed')
    } catch {
      toast.error('Failed to remove family member')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <DashboardLayout title="Family Members" subtitle="Manage appointments for your family">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex justify-end">
          <Button onClick={openAddModal}>
            <Plus className="w-4 h-4 mr-1" /> Add Member
          </Button>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-surface-400 text-sm">
            <LoadingSpinner label="Loading family members..." />
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No family members added"
            description="Add family members to book appointments on their behalf."
            action={openAddModal}
            actionLabel="Add Family Member"
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {members.map(member => (
              <Card key={member.id}>
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={member.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-surface-800">{member.name}</p>
                          <p className="text-xs text-surface-500 capitalize">{member.relationship}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {member.blood_type && (
                            <Badge variant="danger">🩸 {member.blood_type}</Badge>
                          )}
                        </div>
                      </div>
                      {member.date_of_birth && (
                        <p className="text-xs text-surface-400 mt-1">
                          Age {formatAge(member.date_of_birth)} • Born {formatDate(member.date_of_birth)}
                        </p>
                      )}
                      {member.notes && (
                        <p className="text-xs text-surface-500 mt-2 bg-surface-50 rounded-lg p-2">{member.notes}</p>
                      )}

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(member)}
                          className="flex-1 rounded-xl"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(member.id)}
                          isLoading={deletingId === member.id}
                          className="flex-1 rounded-xl text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <Modal
          isOpen={showModal}
          onClose={closeModal}
          title={editingMember ? `Edit — ${editingMember.name}` : 'Add Family Member'}
          size="md"
        >
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalBody className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Member's full name"
                error={errors.name?.message as string}
                required
                {...register('name')}
              />
              <Select
                label="Relationship"
                error={errors.relationship?.message as string}
                required
                {...register('relationship')}
              >
                <option value="">Select relationship</option>
                {RELATIONSHIPS.map(r => (
                  <option key={r} value={r.toLowerCase()}>{r}</option>
                ))}
              </Select>
              <Input
                label="Date of Birth"
                type="date"
                error={errors.date_of_birth?.message as string}
                required
                {...register('date_of_birth')}
              />
              <Select label="Blood Type" {...register('blood_type')}>
                <option value="">Select blood type</option>
                {BLOOD_TYPES.map(bt => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </Select>
              <Input
                label="Notes"
                placeholder="Medical notes, allergies..."
                {...register('notes')}
              />
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={closeModal} className="rounded-xl">Cancel</Button>
              <Button type="submit" isLoading={isSaving} className="rounded-xl px-8">
                {editingMember ? 'Save Changes' : 'Add Member'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
