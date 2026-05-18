import { Calendar, Clock, CheckCircle, XCircle, MoreVertical, Bell, Plus, CreditCard, DollarSign, MapPin } from 'lucide-react'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { formatDateTime, APPOINTMENT_STATUS_CONFIG, VISIT_TYPE_CONFIG } from '@/utils/helpers'
import { useAuth } from '@/hooks/useAuth'
import { useDoctorProfile } from '@/hooks/useDoctorProfile'
import { useAppointments } from '@/hooks/useAppointments'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import Tabs from '@/components/ui/Tabs'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { appointmentsService } from '@/services/appointments.service'
import { Input, Select, Textarea } from '@/components/ui/Input'
import Modal, { ModalBody, ModalFooter } from '@/components/ui/Modal'

const TABS = [
  { id: 'pending', label: 'Requests', icon: Clock },
  { id: 'today', label: 'Today', icon: Clock },
  { id: 'upcoming', label: 'Upcoming', icon: Calendar },
  { id: 'past', label: 'Past', icon: Calendar },
]

export default function DoctorAppointments() {
  const [activeTab, setActiveTab] = useState('pending')
  const [sendingReminder, setSendingReminder] = useState(null)
  const [showChargesModal, setShowChargesModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [chargeType, setChargeType] = useState('medicine')
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeDescription, setChargeDescription] = useState('')
  const [updatingPayment, setUpdatingPayment] = useState(false)
  const [rejectionAppointment, setRejectionAppointment] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rescheduleAppointment, setRescheduleAppointment] = useState(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const { user } = useAuth()
  const { doctor } = useDoctorProfile(user?.id)
  const { appointments, today, upcoming, past, isLoading, approveAppointment, rejectAppointment, updateAppointment } = useAppointments({ doctor_id: doctor?.id })
  
  const pending = appointments.filter(a => a.status === 'pending')
  const dataMap = { pending, today, upcoming, past }
  const currentData = dataMap[activeTab] || []

  const handleApprove = async (id) => {
    try {
      await approveAppointment(id)
      toast.success('Appointment approved!')
    } catch (err) {
      toast.error('Failed to approve appointment')
    }
  }

  const handleReject = (appt) => {
    setRejectionAppointment(appt)
    setRejectionReason('')
  }

  const confirmReject = async () => {
    if (!rejectionAppointment) return
    try {
      await rejectAppointment(rejectionAppointment.id, rejectionReason)
      toast.error('Appointment rejected')
      setRejectionAppointment(null)
    } catch (err) {
      toast.error('Failed to reject appointment')
    }
  }

  const handleSendReminder = async (apptId) => {
    setSendingReminder(apptId)
    try {
      await appointmentsService.sendReminder(apptId)
      toast.success('Reminder sent to patient')
    } catch (err) {
      toast.error('Failed to send reminder')
    } finally {
      setSendingReminder(null)
    }
  }

  const handleReschedule = async () => {
    if (!rescheduleAppointment || !rescheduleDate || !rescheduleTime) return
    try {
      const newDateTime = new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString()
      await updateAppointment(rescheduleAppointment.id, { scheduled_time: newDateTime })
      toast.success('Appointment rescheduled!')
      setRescheduleAppointment(null)
    } catch (err) {
      toast.error('Failed to reschedule appointment')
    }
  }

  const openAddCharges = (appt) => {
    setSelectedAppointment(appt)
    setChargeAmount('')
    setChargeDescription('')
    setShowChargesModal(true)
  }

  const handleAddCharges = async () => {
    if (!chargeAmount || parseFloat(chargeAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    try {
      await appointmentsService.addAdditionalCharges(selectedAppointment.id, {
        type: chargeType,
        amount: parseFloat(chargeAmount),
        description: chargeDescription || chargeType
      })
      toast.success('Additional charges added')
      setShowChargesModal(false)
    } catch (err) {
      toast.error('Failed to add charges')
    }
  }

  const openPaymentModal = (appt) => {
    setSelectedAppointment(appt)
    setShowPaymentModal(true)
  }

  const handleUpdatePayment = async (status) => {
    setUpdatingPayment(true)
    try {
      await appointmentsService.updatePayment(selectedAppointment.id, {
        payment_status: status,
        payment_method: 'cash',
        paid_amount: status === 'paid' ? (selectedAppointment.total_amount || selectedAppointment.consultation_fee || 0) : 0
      })
      toast.success(`Payment marked as ${status}`)
      setShowPaymentModal(false)
    } catch (err) {
      toast.error('Failed to update payment')
    } finally {
      setUpdatingPayment(false)
    }
  }

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'paid': return { variant: 'success', label: 'Payment Confirmed' }
      case 'partial': return { variant: 'warning', label: 'Partial Payment' }
      case 'waived': return { variant: 'neutral', label: 'Waived' }
      default: return { variant: 'danger', label: 'Pending' }
    }
  }

  const getPaymentLabel = (status) => {
    switch (status) {
      case 'paid': return 'Payment Confirmed'
      case 'partial': return 'Partial Payment'
      case 'waived': return 'Waived'
      case 'pending': return 'Pending'
      default: return 'Pending'
    }
  }

  return (
    <DashboardLayout title="Appointments" subtitle="Your scheduled patient appointments">
      <div className="max-w-4xl mx-auto space-y-5">
        <Tabs
          tabs={TABS.map(t => ({ ...t, count: dataMap[t.id]?.length }))}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="max-w-sm"
        />
        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : currentData.length === 0 ? (
          <EmptyState icon={Calendar} title={`No ${activeTab} appointments`} />
        ) : (
          <div className="space-y-3">
            {currentData.map(appt => (
              <Card key={appt.id}>
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 text-center bg-primary-50 rounded-xl p-3 min-w-[56px]">
                      <p className="text-xs text-primary-500">{new Date(appt.scheduled_time).toLocaleDateString('en', { month: 'short' })}</p>
                      <p className="text-2xl font-bold text-primary-700 font-display leading-none">{new Date(appt.scheduled_time).getDate()}</p>
                      <p className="text-xs text-primary-500">{new Date(appt.scheduled_time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <Avatar name={appt.family_member?.name || appt.patient?.user?.full_name || appt.patient_name || appt.patient?.patient_name || 'Patient'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-surface-800">
                        {appt.family_member?.name || appt.patient?.user?.full_name || appt.patient_name || appt.patient?.patient_name || 'Patient'}
                        {appt.family_member && <span className="text-xs font-normal text-surface-500 ml-2">({appt.family_member.relationship})</span>}
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5 truncate">{appt.symptoms}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant={VISIT_TYPE_CONFIG[appt.visit_type]?.color || 'neutral'}>
                          {VISIT_TYPE_CONFIG[appt.visit_type]?.label}
                        </Badge>
                      </div>

                      {/* Display Location parsed from notes */}
                      {(() => {
                        const notesStr = appt.notes || ''
                        const locMatch = notesStr.match(/\[Location:\s*(.*?)\s*\]/)
                        if (locMatch) {
                          return (
                            <div className="mt-2 flex items-start gap-1.5 text-surface-600 bg-surface-50 p-2 rounded-lg border border-surface-100 max-w-sm">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 text-danger-500 flex-shrink-0" />
                              <p className="text-xs font-medium">{locMatch[1]}</p>
                            </div>
                          )
                        }
                        return null
                      })()}

                    </div>
                    <Badge variant={APPOINTMENT_STATUS_CONFIG[appt.status]?.color || 'neutral'} dot>
                      {APPOINTMENT_STATUS_CONFIG[appt.status]?.label}
                    </Badge>
                  </div>
                  
                  {(appt.status === 'confirmed' || appt.status === 'completed') && (
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-surface-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-surface-500">Payment:</span>
                        <Badge variant={getPaymentStatusBadge(appt.payment_status).variant}>
                          {getPaymentLabel(appt.payment_status)}
                        </Badge>
                        <span className="text-sm font-semibold text-surface-800">₹{appt.total_amount || appt.consultation_fee || 0}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openAddCharges(appt)}>
                          <Plus className="w-3.5 h-3.5" /> Add Charges
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => openPaymentModal(appt)}>
                          <CreditCard className="w-3.5 h-3.5" /> Payment
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {appt.status === 'pending' && (
                    <div className="flex gap-2 justify-end pt-3 border-t border-surface-100">
                      <Button 
                        variant="danger" 
                        size="sm" 
                        onClick={() => handleReject(appt)}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                      <Button 
                        variant="success" 
                        size="sm"
                        onClick={() => handleApprove(appt.id)}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Accept
                      </Button>
                    </div>
                  )}
                  
                  {appt.status === 'confirmed' && (
                    <div className="flex gap-2 justify-end pt-3 border-t border-surface-100">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          const dt = new Date(appt.scheduled_time)
                          setRescheduleDate(dt.toISOString().split('T')[0])
                          setRescheduleTime(dt.toTimeString().slice(0, 5))
                          setRescheduleAppointment(appt)
                        }}
                      >
                        <Clock className="w-3.5 h-3.5" /> Reschedule
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSendReminder(appt.id)}
                        isLoading={sendingReminder === appt.id}
                      >
                        <Bell className="w-3.5 h-3.5" /> Send Reminder
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Charges Modal */}
      <Modal isOpen={showChargesModal} onClose={() => setShowChargesModal(false)} title="Add Additional Charges">
        <ModalBody className="space-y-4">
          <Select label="Charge Type" value={chargeType} onChange={(e) => setChargeType(e.target.value)}>
            <option value="medicine">Medicine</option>
            <option value="test">Lab Test</option>
            <option value="procedure">Procedure</option>
            <option value="other">Other</option>
          </Select>
          <Input
            label="Amount (₹)"
            type="number"
            min="0"
            step="0.01"
            value={chargeAmount}
            onChange={(e) => setChargeAmount(e.target.value)}
            placeholder="0.00"
          />
          <Textarea
            label="Description (optional)"
            value={chargeDescription}
            onChange={(e) => setChargeDescription(e.target.value)}
            placeholder="Enter details..."
            rows={2}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" className="flex-1" onClick={() => setShowChargesModal(false)}>Cancel</Button>
          <Button className="flex-1" onClick={handleAddCharges}>Add Charges</Button>
        </ModalFooter>
      </Modal>

      {/* Reject Appointment Modal */}
      <Modal isOpen={!!rejectionAppointment} onClose={() => setRejectionAppointment(null)} title="Reject Appointment">
        <ModalBody className="space-y-4">
          <p className="text-sm text-surface-600">
            You are rejecting the appointment for <strong>{rejectionAppointment?.patient?.user?.full_name || rejectionAppointment?.patient_name || 'Patient'}</strong>. 
            Please provide a reason so the patient knows why.
          </p>
          <Textarea
            label="Rejection Reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Schedule conflict, out of town..."
            rows={3}
            required
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" className="flex-1" onClick={() => setRejectionAppointment(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={confirmReject}>Confirm Rejection</Button>
        </ModalFooter>
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Update Payment">
        <ModalBody className="space-y-4">
          <div className="p-4 bg-surface-50 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-surface-600">Patient</span>
              <span className="font-medium text-surface-800">{selectedAppointment?.patient?.user?.full_name || selectedAppointment?.patient_name || 'Patient'}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-surface-600">Consultation Fee</span>
              <span className="font-medium text-surface-800">₹{selectedAppointment?.consultation_fee || 0}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-surface-600">Additional Charges</span>
              <span className="font-medium text-surface-800">₹{selectedAppointment?.additional_charges || 0}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-surface-200">
              <span className="text-sm font-medium text-surface-700">Total</span>
              <span className="text-lg font-bold text-surface-800">₹{selectedAppointment?.total_amount || selectedAppointment?.consultation_fee || 0}</span>
            </div>
          </div>
          <p className="text-sm text-surface-600">Select payment status:</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="success" size="sm" onClick={() => handleUpdatePayment('paid')} isLoading={updatingPayment}>
              <DollarSign className="w-3.5 h-3.5" /> Mark Paid
            </Button>
            <Button variant="warning" size="sm" onClick={() => handleUpdatePayment('partial')} isLoading={updatingPayment}>
              Mark Partial
            </Button>
            <Button variant="neutral" size="sm" onClick={() => handleUpdatePayment('waived')} isLoading={updatingPayment}>
              Waive Payment
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Reschedule Appointment Modal */}
      <Modal isOpen={!!rescheduleAppointment} onClose={() => setRescheduleAppointment(null)} title="Reschedule Appointment">
        <ModalBody className="space-y-4">
          <p className="text-sm text-surface-600">
            Reschedule appointment for <strong>{rescheduleAppointment?.patient?.user?.full_name || rescheduleAppointment?.patient_name || 'Patient'}</strong>
          </p>
          <Input
            label="New Date"
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          <Input
            label="New Time"
            type="time"
            value={rescheduleTime}
            onChange={(e) => setRescheduleTime(e.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" className="flex-1" onClick={() => setRescheduleAppointment(null)}>Cancel</Button>
          <Button className="flex-1" onClick={handleReschedule}>Reschedule</Button>
        </ModalFooter>
      </Modal>
    </DashboardLayout>
  )
}
