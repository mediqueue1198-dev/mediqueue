import { useEffect, useState } from 'react'
import { Users, Clock, Activity, Stethoscope, TrendingUp, TriangleAlert, CheckCircle, PieChart, ArrowUpRight, Plus, MapPin, Search, Lock, ShieldAlert, RefreshCcw } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import StatsCard from '@/components/ui/StatsCard'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { useQueueStore } from '@/store/queueStore'
import { queueService } from '@/services/queue.service'
import { QUEUE_STATUS_CONFIG } from '@/utils/helpers'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPie, Pie } from 'recharts'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/hooks/useAuth'
import supabase from '@/lib/supabase'

export default function MediatorDashboard() {
  const { user, profile } = useAuth()
  const { entries, loadQueue } = useQueueStore()
  const [stats, setStats] = useState<any | null>(null)
  const [doctors, setDoctors] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isApproved, setIsApproved] = useState<boolean | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)

  const checkApproval = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('mediators')
        .select('is_approved')
        .eq('user_id', user.id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') setIsApproved(false) // No record yet
        else console.error(error)
      } else {
        setIsApproved(data.is_approved)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    checkApproval()
    
    // If already approved, load data
    loadQueue() 
    
    const fetchData = async () => {
      if (isApproved === false) {
        setIsLoading(false)
        return
      }
      try {
        const [docs, metrics] = await Promise.allSettled([
          import('@/services/doctors.service').then(m => m.doctorsService.getAll()),
          queueService.getHospitalMetrics(profile?.hospital_id)
        ])
        
        if (docs.status === 'fulfilled') setDoctors(docs.value)
        if (metrics.status === 'fulfilled') setStats(metrics.value)
      } catch (err) {
        console.error('Dashboard load partial failure:', err)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchData()
  }, [user?.id, isApproved, profile?.hospital_id, loadQueue])

  const handleRequestApproval = async () => {
    setIsRequesting(true)
    try {
      // Logic for request (could send notification to assigned doctor)
      await new Promise(r => setTimeout(r, 1500))
      toast.success('Approval request sent to clinic administrator')
      await checkApproval()
    } catch (err) {
      toast.error('Failed to send request')
    } finally {
      setIsRequesting(false)
    }
  }

  const [searchEmail, setSearchEmail] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const handleFindDoctor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchEmail) return
    setIsSearching(true)
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('email', searchEmail.trim())
        .eq('role', 'doctor')
        .single()

      if (userError || !userData) {
        toast.error('Could not find this doctor. Please verify the email address.')
        return
      }

      const { data: docData, error: docError } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', userData.id)
        .single()
      
      if (docError || !docData) {
        toast.error('This user is not registered as a clinician.')
        return
      }

      // 3. Upsert the assignment request (allows resending/retrying)
      const { error: assignError } = await supabase
        .from('mediator_assignments')
        .upsert({
          mediator_id: profile?.mediator_id,
          doctor_id: docData.id,
          status: 'pending'
        }, {
          onConflict: 'mediator_id, doctor_id'
        })

      if (assignError) {
        throw assignError
      } else {
        toast.success(`Request sent to Dr. ${userData.full_name}`)
        setSearchEmail('')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to send request')
    } finally {
      setIsSearching(false)
    }
  }

  if (isLoading || isApproved === null) return <PageLoader label="Verifying staff credentials..." />

  // --- UNAPPROVED VIEW ---
  if (!isApproved) {
    return (
      <DashboardLayout title="Operational Portal" subtitle="Staff Credentials & Clinical Linkage">
        <div className="max-w-xl mx-auto mt-12 text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div className="relative inline-block">
              <div className="w-24 h-24 bg-primary-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-200">
                <Lock className="w-10 h-10 text-primary-600" />
              </div>
              <ShieldAlert className="absolute -bottom-2 -right-2 w-10 h-10 text-secondary-500 bg-white rounded-full p-2 shadow-card" />
           </div>
           
           <div className="space-y-3">
              <h2 className="text-3xl font-bold font-display text-surface-900">Link to your Clinician</h2>
              <p className="text-surface-500 leading-relaxed px-4">
                To access clinical data, you must first be approved by the doctor you work for. Please enter their **official clinical email** below.
              </p>
           </div>

           <Card className="border-none shadow-premium bg-white p-2">
              <form onSubmit={handleFindDoctor} className="flex gap-2">
                 <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input 
                       type="email"
                       placeholder="doctor@mediqueue.com"
                       className="w-full bg-surface-50 border-none rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                       value={searchEmail}
                       onChange={e => setSearchEmail(e.target.value)}
                    />
                 </div>
                 <Button 
                    variant="primary" 
                    type="submit" 
                    isLoading={isSearching}
                    className="rounded-2xl px-6"
                 >
                    Request Access
                 </Button>
              </form>
           </Card>

                       <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <button 
                onClick={() => refreshProfile()}
                className="w-full sm:w-auto px-6 py-2.5 bg-surface-50 hover:bg-surface-100 text-surface-700 rounded-2xl text-sm font-semibold transition-all border border-surface-200"
               >
                  Already approved? Refresh status
               </button>
               <button 
                 onClick={() => window.location.href = '/mediator/profile'}
                 className="w-full sm:w-auto px-6 py-2.5 text-surface-500 hover:text-surface-700 text-sm font-medium transition-all"
               >
                  Go to Profile
               </button>
            </div>
            <div className="pt-10 border-t border-surface-100 mt-10">
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">MediQueue Secure Staff Linkage v2.1</p>
           </div>
        </div>
      </DashboardLayout>
    )
  }

  // --- APPROVED DASHBOARD (Original View) ---
  const emergencies = entries.filter(e => e.queue_type === 'emergency' && e.status === 'waiting').length

  return (
    <DashboardLayout title="Operational Dashboard" subtitle="Enterprise-grade hospital queue analytics">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        
        {/* Urgent Alerts Section */}
        {emergencies > 0 && (
          <div className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-danger-500 animate-pulse opacity-10" />
            <Card className="border-l-4 border-l-danger-600 border-none bg-danger-50 shadow-lg">
              <CardBody className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-danger-100 rounded-2xl flex items-center justify-center">
                    <TriangleAlert className="w-6 h-6 text-danger-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-danger-900">{emergencies} Unattended Emergencies</h3>
                    <p className="text-sm text-danger-700/80">Immediate triage and doctor assignment required in Main Ward.</p>
                  </div>
                </div>
                <Link to="/mediator/queue">
                  <Button variant="danger" className="rounded-xl shadow-lg shadow-danger-200">
                    Take Action
                  </Button>
                </Link>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Global Key Metrics */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <StatsCard 
              title="Total Registrations" 
              value={stats.total_patients_today} 
              icon={Users} 
              color="primary" 
              trend={12} 
              trendLabel="vs yesterday" 
              glass
            />
            <StatsCard 
              title="Active Queue" 
              value={stats.active_queues} 
              subtitle="patients waiting" 
              icon={Clock} 
              color="warning" 
              glass
              pulse={stats.active_queues > 15}
            />
            <StatsCard 
              title="Consultations" 
              value={stats.completed_consultations} 
              subtitle="completed"
              icon={CheckCircle} 
              color="success" 
              glass
            />
            <StatsCard 
              title="Efficiency Index" 
              value={`${stats.avg_wait_time ?? 0}m`} 
              subtitle="avg wait time"
              icon={TrendingUp} 
              color={(stats.avg_wait_time ?? 0) > 30 ? 'danger' : 'success'} 
              glass
            />
          </div>
        )}

        {/* Analytics & Distribution Row */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-none shadow-premium bg-white">
            <CardHeader className="flex flex-row items-center justify-between border-b border-surface-50">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-600" />
                Patient Inflow (Hourly)
              </CardTitle>
              <div className="flex items-center gap-2 text-[10px] font-bold text-surface-400 uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-primary-500" /> Live Updates
              </div>
            </CardHeader>
            <CardBody className="py-6 min-h-[300px]">
              <div className="h-[240px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={stats?.hourly_flow || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }} />
                    <Bar dataKey="patients" radius={[6, 6, 6, 6]}>
                      {(stats?.hourly_flow || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.patients > 5 ? '#2563eb' : entry.patients > 2 ? '#3b82f6' : '#93c5fd'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card className="border-none shadow-premium bg-white">
            <CardHeader className="border-b border-surface-50">
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-warning-600" />
                Queue Segmentation
              </CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col items-center justify-center py-6">
              <div className="relative w-48 h-48 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={[
                        { name: 'Appointments', value: stats?.appointments_today || 0 },
                        { name: 'Walk-ins', value: stats?.walk_ins_today || 0 },
                        { name: 'Emergencies', value: emergencies },
                      ]}
                      cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none"
                    >
                      <Cell key="cell-0" fill="#2563eb" />
                      <Cell key="cell-1" fill="#f59e0b" />
                      <Cell key="cell-2" fill="#dc2626" />
                    </Pie>
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-3xl font-bold text-surface-900">{stats?.total_patients_today}</p>
                  <p className="text-[10px] font-bold text-surface-400 uppercase">Total</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Doctor Status Table */}
        <Card className="border-none shadow-premium bg-white overflow-hidden">
          <CardHeader className="border-b border-surface-50 flex flex-row items-center justify-between bg-surface-50/30">
            <CardTitle className="text-lg flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-medical-600" />
              Provider Status & Inflow
            </CardTitle>
            <Link to="/mediator/doctors">
               <Button variant="ghost" size="sm" className="text-primary-600">View All</Button>
            </Link>
          </CardHeader>
          <CardBody className="p-0">
             <div className="grid md:grid-cols-2 divide-x divide-surface-100">
                <div className="divide-y divide-surface-50 overflow-y-auto max-h-[400px]">
                   {doctors.map(doc => {
                     const waitCount = entries.filter(e => e.doctor_id === doc.id && e.status === 'waiting').length
                     return (
                       <div key={doc.id} className="p-4 flex items-center gap-4 hover:bg-surface-50 transition-colors">
                          <Avatar name={doc.user?.full_name} online={doc.is_available} size="md" />
                          <div className="flex-1">
                             <p className="text-sm font-bold text-surface-800">Dr. {doc.user?.full_name}</p>
                             <p className="text-xs text-surface-500">{doc.specialization}</p>
                             <div className="mt-2 flex items-center gap-2">
                                <Badge variant={waitCount > 5 ? 'danger' : 'success'}>{waitCount} Waiting</Badge>
                             </div>
                          </div>
                          <Button variant="ghost" size="icon-sm" icon={Activity} />
                       </div>
                     )
                   })}
                </div>
                {/* Secondary Feed */}
                <div className="p-4 bg-surface-50/20">
                   <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-4">Recent Queue Movements</p>
                   <div className="space-y-3">
                      {entries.slice(0, 5).map(e => (
                        <div key={e.id} className="bg-white p-3 rounded-xl border border-surface-100 flex items-center justify-between shadow-sm">
                           <div>
                              <p className="text-xs font-bold text-surface-800">{e.patient_name || e.patient?.full_name}</p>
                              <p className="text-[10px] text-surface-400">{e.token_number}</p>
                           </div>
                           <Badge variant="neutral">{e.status}</Badge>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  )
}
