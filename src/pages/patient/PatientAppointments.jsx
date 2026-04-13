import { useState } from 'react'
import { Clock, Calendar, CheckCircle, XCircle, AlertCircle, MoreVertical, MapPin } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Tabs from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useAppointments } from '@/hooks/useAppointments'
import { useQueueStore } from '@/store/queueStore'
import { formatDateTime, APPOINTMENT_STATUS_CONFIG, VISIT_TYPE_CONFIG } from '@/utils/helpers'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

const TAB_ITEMS = [
  { id: 'upcoming', label: 'Upcoming', icon: Clock },
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'past', label: 'Past', icon: CheckCircle },
]

export default function PatientAppointments() {
  const [activeTab, setActiveTab] = useState('upcoming')
  const navigate = useNavigate()
  const { upcoming, today, past, appointments, isLoading, cancelAppointment } = useAppointments()
  const addFromAppointment = useQueueStore(state => state.addFromAppointment)
  const [checkingIn, setCheckingIn] = useState(null)

  const dataMap = { upcoming, today, past }
  const currentData = dataMap[activeTab] || []

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this appointment?')) return
    try {
      await cancelAppointment(id)
      toast.success('Appointment cancelled')
    } catch {
      toast.error('Failed to cancel appointment')
    }
  }

  const handleCheckIn = async (appt) => {
    setCheckingIn(appt.id)
    try {
      await addFromAppointment(appt, appt.doctor)
      toast.success('Checked in! Check Queue Status for your position.')
      navigate('/patient/queue')
    } catch {
      toast.error('Failed to check in')
    } finally {
      setCheckingIn(null)
    }
  }

  const isAppointmentsToday = (appt) => {
    const apptDate = new Date(appt.scheduled_time)
    const today = new Date()
    return apptDate.toDateString() === today.toDateString()
  }

  return (
    <DashboardLayout title="My Appointments" subtitle="View and manage your appointments">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Tabs
            tabs={TAB_ITEMS.map(t => ({
              ...t,
              count: dataMap[t.id]?.length,
            }))}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="flex-1 max-w-sm"
          />
          <Link to="/patient/book">
            <Button size="sm"><Calendar className="w-4 h-4" /> Book New</Button>
          </Link>
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-12" label="Loading appointments..." />
        ) : currentData.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={`No ${activeTab} appointments`}
            description="Book an appointment with a doctor to get started."
          />
        ) : (
          <div className="space-y-3">
            {currentData.map((appt) => (
              <Card key={appt.id} className="hover:shadow-md transition-shadow">
                <CardBody className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Date block */}
                    <div className="flex-shrink-0 text-center bg-primary-50 rounded-xl p-3 min-w-[56px]">
                      <p className="text-xs text-primary-500 font-medium">
                        {new Date(appt.scheduled_time).toLocaleDateString('en', { month: 'short' })}
                      </p>
                      <p className="text-2xl font-bold text-primary-700 font-display leading-none">
                        {new Date(appt.scheduled_time).getDate()}
                      </p>
                      <p className="text-xs text-primary-500">
                        {new Date(appt.scheduled_time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-surface-800">
                            {appt.doctor?.user?.full_name || 'Doctor'}
                          </p>
                          <p className="text-xs text-surface-500">{appt.doctor?.specialization} • {appt.doctor?.department}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={APPOINTMENT_STATUS_CONFIG[appt.status]?.color || 'neutral'} dot>
                            {APPOINTMENT_STATUS_CONFIG[appt.status]?.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Display dynamically parsed location if it exists */}
                      {(() => {
                        const notesStr = appt.notes || ''
                        const locMatch = notesStr.match(/\[Location:\s*(.*?)\s*\]/)
                        if (locMatch) {
                          return (
                            <div className="mt-2 flex items-start gap-1.5 text-surface-600 bg-surface-50 p-2 rounded-lg border border-surface-100">
                              <MapPin className="w-4 h-4 mt-0.5 text-danger-500 flex-shrink-0" />
                              <p className="text-xs font-medium">{locMatch[1]}</p>
                            </div>
                          )
                        }
                        return null
                      })()}

                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <Badge variant={VISIT_TYPE_CONFIG[appt.visit_type]?.color || 'neutral'}>
                          {VISIT_TYPE_CONFIG[appt.visit_type]?.label}
                        </Badge>
                        {appt.symptoms && (
                          <p className="text-xs text-surface-500 truncate max-w-[200px]">
                            {appt.symptoms}
                          </p>
                        )}
                      </div>

                      {/* Fee & payment status */}
                      {(appt.consultation_fee > 0 || appt.total_amount > 0) && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span className="font-semibold text-surface-700">
                            ₹{appt.total_amount || appt.consultation_fee}
                          </span>
                          <Badge variant={
                            appt.payment_status === 'paid' ? 'success' :
                            appt.payment_status === 'partial' ? 'warning' : 'neutral'
                          }>
                            {appt.payment_status === 'paid' ? 'Paid' :
                             appt.payment_status === 'partial' ? 'Partial' : 'Pay at clinic'}
                          </Badge>
                        </div>
                      )}

                      {/* Actions */}
                      {(appt.status === 'confirmed' || appt.status === 'pending') && (
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            {appt.status === 'confirmed' && isAppointmentsToday(appt) && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleCheckIn(appt)}
                                isLoading={checkingIn === appt.id}
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                Check In (Join Queue)
                              </Button>
                            )}
                            {new Date(appt.scheduled_time) > new Date() && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleCancel(appt.id)}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Cancel
                              </Button>
                            )}
                          </div>
                      )}

                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
