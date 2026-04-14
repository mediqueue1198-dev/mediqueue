import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, FileText, MessageSquare, Plus, ArrowRight, Bell, Activity } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import StatsCard from '@/components/ui/StatsCard'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { useAppointments } from '@/hooks/useAppointments'
import { useQueue } from '@/hooks/useQueue'
import { useNotificationStore } from '@/store/notificationStore'
import { formatDateTime, formatRelativeTime, APPOINTMENT_STATUS_CONFIG, QUEUE_STATUS_CONFIG } from '@/utils/helpers'

export default function PatientDashboard() {
  const { profile, user } = useAuth()
  const { upcoming, today, isLoading: apptLoading } = useAppointments()
  const { myEntry, myPosition, myEstimatedWaitFormatted } = useQueue()
  const { notifications, unreadCount, loadNotifications } = useNotificationStore()

  useEffect(() => {
    if (user?.id) loadNotifications(user.id)
  }, [user?.id])

  const firstName = profile?.full_name?.split(' ')[0] || 'Patient'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <DashboardLayout title="Dashboard" subtitle={`${greeting}, ${firstName}!`}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Welcome Banner */}
        <div className="gradient-primary rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
          <div className="absolute bottom-0 right-20 w-24 h-24 bg-white/5 rounded-full translate-y-10" />
          <div className="relative">
            <h2 className="text-xl font-bold font-display mb-1">{greeting}, {firstName}! 👋</h2>
            <p className="text-white/80 text-sm mb-4">Here's an overview of your health appointments today.</p>
            <Link to="/patient/book">
              <Button variant="ghost" size="sm" className="!bg-white/20 !text-white hover:!bg-white/30 border border-white/30">
                <Plus className="w-4 h-4" />
                Book Appointment
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Upcoming"
            value={upcoming.length}
            subtitle="appointments"
            icon={Calendar}
            color="primary"
            glass
            to="/patient/appointments"
          />
          <StatsCard
            title="Today"
            value={today.length}
            subtitle="appointments"
            icon={Clock}
            color="success"
            glass
            to="/patient/appointments"
          />
          <StatsCard
            title="Queue Position"
            value={myEntry ? `#${myPosition || 'In'}` : '—'}
            subtitle={myEntry ? myEstimatedWaitFormatted : 'Not in queue'}
            icon={Activity}
            color={myEntry ? 'warning' : 'neutral'}
            glass
            to="/patient/queue"
          />
          <StatsCard
            title="Notifications"
            value={unreadCount}
            subtitle="unread"
            icon={Bell}
            color={unreadCount > 0 ? 'danger' : 'neutral'}
            glass
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Queue Status Card */}
          {myEntry && (
            <Card glass className="lg:col-span-1 border-warning-100/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Queue Status</CardTitle>
                  <Badge variant="warning" dot pulse>Live</Badge>
                </div>
              </CardHeader>
              <CardBody className="text-center py-6 animate-in slide-in-from-left duration-500">
                <div className="w-24 h-24 mx-auto mb-6 bg-warning-100/80 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center shadow-lg shadow-warning-100 ring-4 ring-warning-50">
                  <span className="text-xs font-bold text-warning-600 uppercase tracking-tighter mb-1">Token</span>
                  <span className="text-4xl font-black font-display text-warning-700">{myEntry.token_number}</span>
                </div>
                <p className="text-2xl font-bold font-display text-surface-800 mb-1">
                  {myPosition === 0 ? 'Your turn!' : `#${myPosition} in queue`}
                </p>
                <p className="text-sm text-surface-500 mb-6 font-medium">
                  Estimated wait: <span className="font-bold text-primary-600">{myEstimatedWaitFormatted}</span>
                </p>
                <div className="flex justify-center mb-6">
                  <Badge variant={QUEUE_STATUS_CONFIG[myEntry.status]?.color || 'neutral'} dot size="lg">
                    {QUEUE_STATUS_CONFIG[myEntry.status]?.label || myEntry.status}
                  </Badge>
                </div>
                <Link to="/patient/queue">
                  <Button variant="primary" className="w-full shadow-lg shadow-primary-200">
                    Track Realtime <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardBody>
            </Card>
          )}

          {/* Upcoming Appointments */}
          <Card glass className={myEntry ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Upcoming Appointments</CardTitle>
                <Link to="/patient/appointments">
                  <Button variant="ghost" size="sm" className="text-primary-600 hover:bg-primary-50">
                    View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {upcoming.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-surface-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-surface-300" />
                  </div>
                  <p className="text-sm text-surface-500 mb-4">No upcoming appointments found</p>
                  <Link to="/patient/book">
                    <Button variant="outline" size="sm">Schedule Now</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-surface-100/50">
                  {upcoming.slice(0, 4).map((appt) => (
                    <div key={appt.id} className="flex items-center gap-4 px-6 py-5 hover:bg-white/40 transition-all duration-200">
                      <Avatar name={appt.doctor?.user?.full_name || 'Dr'} size="md" className="ring-2 ring-white shadow-sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-surface-800 text-sm">
                          {appt.doctor?.user?.full_name}
                        </p>
                        <p className="text-xs text-surface-500 mb-1">{appt.doctor?.specialization}</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-primary-500" />
                          <p className="text-xs text-primary-600 font-bold uppercase tracking-wide">
                            {formatDateTime(appt.scheduled_time)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={APPOINTMENT_STATUS_CONFIG[appt.status]?.color || 'neutral'}
                        dot
                      >
                        {APPOINTMENT_STATUS_CONFIG[appt.status]?.label}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Recent Notifications */}
        <Card glass>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Notifications</CardTitle>
              {unreadCount > 0 && <Badge variant="danger" dot animate>{unreadCount} new</Badge>}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-surface-500">No notifications yet</div>
            ) : (
              <div className="divide-y divide-surface-100/50">
                {notifications.slice(0, 4).map(n => (
                  <div key={n.id} className={`flex gap-4 px-6 py-4 hover:bg-white/40 transition-colors ${!n.read ? 'bg-primary-50/30' : ''}`}>
                    <div className="w-10 h-10 rounded-full bg-surface-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">
                        {n.type === 'appointment' ? '📅' : n.type === 'queue' ? '🔔' : '📋'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-bold text-surface-900">{n.title}</p>
                        <p className="text-[10px] text-surface-400 font-medium">{formatRelativeTime(n.created_at)}</p>
                      </div>
                      <p className="text-xs text-surface-500 line-clamp-1">{n.message}</p>
                    </div>
                    {!n.read && <div className="w-2.5 h-2.5 bg-primary-500 rounded-full mt-2 ring-4 ring-primary-50 flex-shrink-0 animate-pulse" />}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  )
}
