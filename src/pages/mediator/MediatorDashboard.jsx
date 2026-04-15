import { useEffect, useState } from 'react'
import { Users, Clock, Activity, Stethoscope, TrendingUp, TriangleAlert, CheckCircle, PieChart, ChartBar } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import StatsCard from '@/components/ui/StatsCard'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { useQueueStore } from '@/store/queueStore'
import { queueService } from '@/services/queue.service'
import { formatRelativeTime, QUEUE_STATUS_CONFIG } from '@/utils/helpers'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPie, Pie, Legend, LineChart, Line } from 'recharts'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'


export default function MediatorDashboard() {
  const { entries, loadQueue } = useQueueStore()
  const [stats, setStats] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { 
    loadQueue() 
    const fetchData = async () => {
      try {
        const [docs, metrics] = await Promise.all([
          import('@/services/doctors.service').then(m => m.doctorsService.getAll()),
          queueService.getHospitalMetrics()
        ])
        setDoctors(docs)
        setStats(metrics)
      } catch (err) {
        toast.error('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const totalWaiting = entries.filter(e => e.status === 'waiting').length
  const emergencies = entries.filter(e => e.queue_type === 'emergency').length

  return (
    <DashboardLayout title="Hospital Operations" subtitle="Real-time hospital management overview">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Emergency Alert */}
        {emergencies > 0 && (
          <div className="bg-danger-50 border-2 border-danger-300 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-danger-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <TriangleAlert className="w-5 h-5 text-danger-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-danger-800">{emergencies} Emergency Patient{emergencies > 1 ? 's' : ''} in Queue</p>
              <p className="text-sm text-danger-600">Immediate attention required</p>
            </div>
            <Link to="/mediator/queue">
              <Button variant="danger" size="sm">View Queue</Button>
            </Link>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="Total Patients Today" value={stats.total_patients_today} icon={Users} color="primary" trend={8} trendLabel="vs yesterday" to="/mediator/reports" />
            <StatsCard title="Active Queue" value={stats.active_queues} subtitle="waiting patients" icon={Clock} color="warning" to="/mediator/queue" />
            <StatsCard title="Completed Today" value={stats.completed_consultations} icon={CheckCircle} color="success" to="/mediator/reports" />
            <StatsCard title="Avg Wait Time" value={`${stats.avg_wait_time ?? 0}m`} icon={TrendingUp} color={(stats.avg_wait_time ?? 0) > 30 ? 'danger' : 'neutral'} to="/mediator/reports" />
          </div>
        )}

        {/* Analytics Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Queue Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Queue Distribution
              </CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={140} height={140}>
                  <RechartsPie>
                    <Pie
                      data={[
                        { name: 'Appointments', value: stats?.appointments_today || 0, color: '#2563eb' },
                        { name: 'Walk-ins', value: stats?.walk_ins_today || 0, color: '#f59e0b' },
                        { name: 'Emergencies', value: emergencies, color: '#dc2626' },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {(stats?.appointments_today || stats?.walk_ins_today || emergencies) > 0 && [
                        <Cell key="cell-0" fill="#2563eb" />,
                        <Cell key="cell-1" fill="#f59e0b" />,
                        <Cell key="cell-2" fill="#dc2626" />,
                      ]}
                    </Pie>
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {[
                    { label: 'Appointments', value: stats?.appointments_today || 0, color: 'bg-primary-500' },
                    { label: 'Walk-ins', value: stats?.walk_ins_today || 0, color: 'bg-warning-500' },
                    { label: 'Emergencies', value: emergencies, color: 'bg-danger-500' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span className="text-sm text-surface-600">{item.label}</span>
                      </div>
                      <span className="text-sm font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Doctor Utilization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4" />
                Doctor Utilization
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {doctors.slice(0, 4).map((doc) => {
                const utilization = doc.patients_today ? Math.min(100, (doc.patients_today / 15) * 100) : 0
                return (
                  <div key={doc.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-surface-700">{doc.user?.full_name}</span>
                      <span className="text-xs text-surface-500">{doc.patients_today || 0} patients</span>
                    </div>
                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          utilization > 80 ? 'bg-success-500' : utilization > 50 ? 'bg-warning-500' : 'bg-primary-500'
                        }`}
                        style={{ width: `${utilization}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardBody>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Patient flow chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Patient Flow Today</CardTitle>
            </CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats?.hourly_flow || []} barSize={24}>
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="patients" radius={[6, 6, 0, 0]}>
                    {(stats?.hourly_flow || []).map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.patients > 0 ? '#2563eb' : '#bfdbfe'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* Quick Stats */}
          <div className="space-y-4">
            <Card>
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-surface-700">Active Doctors</p>
                  <Badge variant="success" dot>{stats?.active_doctors || 0} online</Badge>
                </div>
                <div className="space-y-2">
                  {doctors.slice(0, 3).map(doc => (
                    <div key={doc.id} className="flex items-center gap-2">
                      <Avatar name={doc.user?.full_name} size="xs" online={doc.is_available} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-surface-700 truncate">{doc.user?.full_name}</p>
                        <p className="text-xs text-surface-400">{doc.patients_today} patients</p>
                      </div>
                      <span className="text-xs text-surface-500">{doc.consultation_avg_time}m avg</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {stats && (
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardBody className="p-3 text-center">
                    <p className="text-2xl font-bold font-display text-primary-700">{stats.appointments_today}</p>
                    <p className="text-xs text-surface-500 mt-0.5">Appointments</p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="p-3 text-center">
                    <p className="text-2xl font-bold font-display text-warning-700">{stats.walk_ins_today}</p>
                    <p className="text-xs text-surface-500 mt-0.5">Walk-ins</p>
                  </CardBody>
                </Card>
              </div>
            )}

            <div className="flex gap-2">
              <Link to="/mediator/walkin" className="flex-1">
                <Button className="w-full" size="sm"><Users className="w-4 h-4" /> Add Walk-in</Button>
              </Link>
              <Link to="/mediator/queue" className="flex-1">
                <Button variant="outline" className="w-full" size="sm"><Activity className="w-4 h-4" /> Queue</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Live Queue Snapshot */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Live Queue Snapshot</CardTitle>
              <Link to="/mediator/queue">
                <Button variant="ghost" size="sm" className="text-primary-600">Full Control →</Button>
              </Link>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-surface-100">
              {entries.slice(0, 5).map(entry => (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-50">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    entry.status === 'in_consultation' ? 'bg-primary-500 animate-pulse' :
                    entry.queue_type === 'emergency' ? 'bg-danger-500 animate-pulse' :
                    'bg-warning-400'
                  }`} />
                  <span className="text-sm font-mono font-semibold text-surface-700 w-16">{entry.token_number}</span>
                  <span className="text-sm text-surface-700 flex-1">{entry.patient?.full_name}</span>
                  <span className="text-xs text-surface-500">{entry.doctor?.user?.full_name}</span>
                  <Badge variant={QUEUE_STATUS_CONFIG[entry.status]?.color || 'neutral'} dot>
                    {QUEUE_STATUS_CONFIG[entry.status]?.label}
                  </Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  )
}
