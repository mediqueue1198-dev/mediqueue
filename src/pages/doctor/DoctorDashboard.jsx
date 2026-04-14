import { useEffect, useState } from 'react'
import { Users, Clock, CheckCircle, Activity, Star, TrendingUp, Calendar, DollarSign } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import StatsCard from '@/components/ui/StatsCard'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { useQueue } from '@/hooks/useQueue'
import { useAppointments } from '@/hooks/useAppointments'
import { formatTime, APPOINTMENT_STATUS_CONFIG } from '@/utils/helpers'
import { useDoctorProfile } from '@/hooks/useDoctorProfile'
import { Link } from 'react-router-dom'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { earningsService } from '@/services/earnings.service'

export default function DoctorDashboard() {
  const { profile, user } = useAuth()
  const { doctor, isLoading: isDoctorLoading } = useDoctorProfile(user?.id)
  const { entries, waitingCount, currentPatient, nextPatients, isLoading } = useQueue(doctor?.id)
  const { today } = useAppointments({ doctor_id: doctor?.id })
  const [todayEarnings, setTodayEarnings] = useState({ total: 0, patientCount: 0 })
  const [weeklyEarnings, setWeeklyEarnings] = useState({})

  useEffect(() => {
    if (doctor?.id) {
      earningsService.getTodayEarnings(doctor.id).then(setTodayEarnings).catch(console.error)
      earningsService.getWeeklyEarnings(doctor.id).then(setWeeklyEarnings).catch(console.error)
    }
  }, [doctor?.id])

  if (isDoctorLoading) return <PageLoader />

  const completedToday = entries.filter(e => e.status === 'completed').length
  const avgWait = Math.round(
    entries.filter(e => e.predicted_consultation_time).reduce((s, e) => s + e.predicted_consultation_time, 0) /
    Math.max(1, entries.length)
  )

  return (
    <DashboardLayout title="Doctor Dashboard" subtitle={`Welcome, ${profile?.full_name?.split(' ')[0]}!`}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Banner */}
        <div className="gradient-medical rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
          <div className="relative">
            <h2 className="text-xl font-bold font-display">Good day, Dr. {profile?.full_name?.split(' ').pop()}!</h2>
            <p className="text-white/80 text-sm mt-1 mb-4">You have {waitingCount} patient{waitingCount !== 1 ? 's' : ''} waiting today.</p>
            <Link to="/doctor/queue">
              <Button variant="ghost" size="sm" className="!bg-white/20 !text-white hover:!bg-white/30 border border-white/30">
                <Activity className="w-4 h-4" /> Manage Queue
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard title="Waiting" value={waitingCount} subtitle="in queue" icon={Clock} color="warning" glass to="/doctor/queue" />
          <StatsCard title="Completed" value={completedToday} subtitle="today" icon={CheckCircle} color="success" glass to="/doctor/queue" />
          <StatsCard title="Appointments" value={today.length} icon={Calendar} color="primary" glass to="/doctor/appointments" />
          <StatsCard 
            title="Today's Earnings" 
            value={`₹${todayEarnings.total || 0}`} 
            subtitle={`${todayEarnings.patientCount || 0} patients`} 
            icon={DollarSign} 
            color="success" 
            glass
            to="/doctor/earnings"
          />
          <StatsCard title="Avg. Consult" value={`${doctor?.consultation_avg_time || 0}m`} icon={TrendingUp} color="neutral" glass />
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Current Patient */}
          <div className="lg:col-span-2 space-y-4">
            <Card glass className="border-primary-100/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Current Patient</CardTitle>
                  <Badge variant={currentPatient ? 'primary' : 'neutral'} dot pulse={!!currentPatient}>
                    {currentPatient ? 'In Consultation' : 'Available'}
                  </Badge>
                </div>
              </CardHeader>
              <CardBody>
                {currentPatient ? (
                  <div className="text-center py-2 animate-in fade-in zoom-in duration-500">
                    <Avatar name={currentPatient.patient?.full_name} size="xl" className="mx-auto mb-3 ring-4 ring-primary-50 ring-offset-2" />
                    <p className="font-bold text-lg font-display text-surface-800">{currentPatient.patient?.full_name}</p>
                    <p className="text-sm text-surface-500 mb-2">{currentPatient.token_number}</p>
                    <p className="text-xs text-surface-400">{currentPatient.patient?.phone}</p>
                    <div className="mt-4">
                      <Link to="/doctor/consultation">
                        <Button className="w-full shadow-lg shadow-primary-200">Open Consultation</Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-surface-500">
                    <Users className="w-10 h-10 mx-auto mb-2 text-surface-300" />
                    <p className="text-sm">No patient in consultation</p>
                    <Link to="/doctor/queue">
                      <Button size="sm" className="mt-3">Call Next Patient</Button>
                    </Link>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Next patients */}
            <Card glass>
              <CardHeader><CardTitle>Up Next</CardTitle></CardHeader>
              <CardBody className="p-0">
                {nextPatients.length === 0 ? (
                  <div className="p-4 text-center text-sm text-surface-500">Queue is empty</div>
                ) : (
                  nextPatients.map((p, idx) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-surface-50 hover:bg-white/40 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
                        {idx + 1}
                      </div>
                      <Avatar name={p.patient?.full_name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-800 truncate">{p.patient?.full_name}</p>
                        <p className="text-xs text-surface-500">{p.token_number} • ~{p.predicted_consultation_time}min</p>
                      </div>
                      <Badge variant="warning" dot={p.queue_type === 'emergency'}>
                        {p.token_number}
                      </Badge>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </div>

          {/* Today's appointments */}
          <Card glass className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Today's Schedule</CardTitle>
                <Link to="/doctor/appointments">
                  <Button variant="ghost" size="sm" className="text-primary-600">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {today.length === 0 ? (
                <div className="p-8 text-center text-surface-500 text-sm">No appointments today</div>
              ) : (
                today.map((appt) => (
                  <div key={appt.id} className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0 border-surface-100 hover:bg-white/40 transition-colors">
                    <div className="text-center min-w-[48px]">
                      <p className="text-xs text-surface-500">{formatTime(appt.scheduled_time)}</p>
                    </div>
                    <Avatar name={appt.patient?.full_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-surface-800 text-sm">{appt.patient?.full_name}</p>
                      <p className="text-xs text-surface-500 truncate">{appt.symptoms}</p>
                    </div>
                    <Badge variant={APPOINTMENT_STATUS_CONFIG[appt.status]?.color || 'neutral'} dot>
                      {APPOINTMENT_STATUS_CONFIG[appt.status]?.label}
                    </Badge>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
