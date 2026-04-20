import { useState, useEffect } from 'react'
import { Star, Clock, Users, Stethoscope, ToggleLeft, ToggleRight } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { useQueueStore } from '@/store/queueStore'
import { useAuthStore } from '@/store/authStore'
import { getSpecialtyIcon } from '@/utils/helpers'
import toast from 'react-hot-toast'

export default function DoctorManagement() {
  const [doctors, setDoctors] = useState([])
  const { profile } = useAuthStore()
  const { entries, loadQueue } = useQueueStore()

  useEffect(() => {
    import('@/services/doctors.service').then(({ doctorsService }) => {
      // If mediator, only fetch assigned doctors
      const filters = {}
      if (profile?.role === 'mediator' && profile?.approvedDoctorIds) {
        filters.ids = profile.approvedDoctorIds
      }
      
      doctorsService.getAll(filters).then(setDoctors)
    })
    loadQueue()
  }, [profile?.approvedDoctorIds, profile?.role])

  const toggleAvailability = (doctorId) => {
    setDoctors(prev =>
      prev.map(d => d.id === doctorId ? { ...d, is_available: !d.is_available } : d)
    )
    const doc = doctors.find(d => d.id === doctorId)
    toast.success(`${doc?.user?.full_name} marked as ${doc?.is_available ? 'unavailable' : 'available'}`)
  }

  const getDoctorQueueCount = (doctorId) =>
    entries.filter(e => e.doctor_id === doctorId && e.status === 'waiting').length

  const getTodayPatients = (doctorId) => {
    const today = new Date().toDateString()
    return entries.filter(e => 
      e.doctor_id === doctorId && 
      new Date(e.created_at).toDateString() === today &&
      (e.status === 'completed' || e.status === 'in_consultation' || e.status === 'waiting')
    ).length
  }

  return (
    <DashboardLayout title="Doctor Management" subtitle="Monitor and manage doctor availability">
      <div className="max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {doctors.map(doc => {
            const queueCount = getDoctorQueueCount(doc.id)
            const todayPatients = getTodayPatients(doc.id)
            const maxPatients = 20
            const utilization = todayPatients > 0 ? Math.round((todayPatients / maxPatients) * 100) : 0

            return (
              <Card key={doc.id} className={!doc.is_available ? 'opacity-75' : ''}>
                <CardBody className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl">
                        {getSpecialtyIcon(doc.specialization)}
                      </div>
                      <div>
                        <p className="font-bold text-surface-800">{doc.user?.full_name || doc.name}</p>
                        <p className="text-xs text-surface-500">{doc.specialization}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleAvailability(doc.id)}
                      className="flex-shrink-0"
                      title={doc.is_available ? 'Mark unavailable' : 'Mark available'}
                    >
                      {doc.is_available ? (
                        <ToggleRight className="w-7 h-7 text-medical-500" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-surface-400" />
                      )}
                    </button>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center bg-surface-50 rounded-xl p-2">
                      <p className="text-lg font-bold font-display text-surface-800">{todayPatients}</p>
                      <p className="text-xs text-surface-500">Today</p>
                    </div>
                    <div className="text-center bg-surface-50 rounded-xl p-2">
                      <p className="text-lg font-bold font-display text-warning-700">{queueCount}</p>
                      <p className="text-xs text-surface-500">Waiting</p>
                    </div>
                    <div className="text-center bg-surface-50 rounded-xl p-2">
                      <p className="text-lg font-bold font-display text-primary-700">{doc.consultation_avg_time || 15}m</p>
                      <p className="text-xs text-surface-500">Avg Time</p>
                    </div>
                  </div>

                  {/* Utilization bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-surface-500">Utilization</span>
                      <span className="text-xs font-medium text-surface-700">{utilization}%</span>
                    </div>
                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          utilization > 80 ? 'bg-danger-500' :
                          utilization > 60 ? 'bg-warning-500' :
                          'bg-medical-500'
                        }`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={doc.is_available ? 'success' : 'neutral'} dot>
                      {doc.is_available ? 'Available' : 'Unavailable'}
                    </Badge>
                    <Badge variant="neutral">
                      <Star className="w-3 h-3 fill-warning-400 text-warning-400" />
                      {doc.rating || 5.0}
                    </Badge>
                    <Badge variant="neutral">{doc.experience_years || 0}y exp</Badge>
                    <p className="text-xs text-surface-400 ml-auto">{doc.department || doc.specialization}</p>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
