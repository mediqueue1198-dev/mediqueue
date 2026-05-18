import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import StatsCard from '@/components/ui/StatsCard'
import { queueService } from '@/services/queue.service'
import { useAuthStore } from '@/store/authStore'
import { TrendingUp, Clock, Users, Star } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function ReportsAnalytics() {
  const { profile } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [doctors, setDoctors] = useState([])

  useEffect(() => { 
    const filters = {}
    if (profile?.role === 'mediator' && profile?.approvedDoctorIds) {
      filters.ids = profile.approvedDoctorIds
    }

    queueService.getHospitalMetrics(profile?.hospital_id, filters.ids).then(setStats)
    import('@/services/doctors.service').then(({ doctorsService }) => {
      doctorsService.getAll(filters).then(setDoctors)
    })
  }, [profile?.hospital_id, profile?.approvedDoctorIds, profile?.role])

  if (!stats) return null

  const pieData = [
    { name: 'Appointments', value: stats.appointments_today, color: '#2563eb' },
    { name: 'Walk-ins', value: stats.walk_ins_today, color: '#f59e0b' },
    { name: 'Active', value: stats.active_queue, color: '#10b981' },
  ]

  return (
    <DashboardLayout title="Reports & Analytics" subtitle="Hospital performance metrics and insights">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Avg Wait Time" value={`${stats.avg_wait_time ?? 0}m`} icon={Clock} color="warning" />
          <StatsCard title="Daily Patients" value={stats.total_today} icon={Users} color="primary" />
          <StatsCard title="Consultations" value={stats.completed_today} icon={TrendingUp} color="success" />
          <StatsCard title="Active Doctors" value={stats.active_doctors} icon={Star} color="success" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Weekly patients chart */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Weekly Patient Volume</CardTitle></CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.hourly_distribution} barSize={28}>
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* Patient type split */}
          <Card>
            <CardHeader><CardTitle>Patient Type Split</CardTitle></CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>

        {/* Wait time trend */}
        <Card>
          <CardHeader><CardTitle>Average Wait Time Trend (minutes)</CardTitle></CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={stats.hourly_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Doctor performance table */}
        <Card>
          <CardHeader><CardTitle>Doctor Performance</CardTitle></CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-100">
                    {['Doctor', 'Specialization', 'Patients Today', 'Avg Consult Time', 'Rating', 'Utilization'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-surface-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {doctors.map(doc => (
                    <tr key={doc.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-surface-800">{doc.user?.full_name}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-surface-600">{doc.specialization}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-surface-800">{doc.patients_today}</td>
                      <td className="px-4 py-3 text-sm text-surface-600">{doc.consultation_avg_time} min</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-sm text-warning-600 font-medium">
                          <Star className="w-3.5 h-3.5 fill-warning-400" /> {doc.rating}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden max-w-[80px]">
                            <div
                              className="h-full bg-primary-500 rounded-full"
                              style={{ width: `${Math.min(100, (doc.patients_today / 24) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-surface-500">{Math.round((doc.patients_today / 24) * 100)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  )
}
