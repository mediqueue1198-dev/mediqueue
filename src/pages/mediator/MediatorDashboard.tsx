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
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/hooks/useAuth'
import supabase from '@/lib/supabase'

export default function MediatorDashboard() {
  const { user, profile, refreshProfile } = useAuth()
  const { entries, loadQueue } = useQueueStore()
  const [stats, setStats] = useState<any | null>(null)
  const [doctors, setDoctors] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isApproved, setIsApproved] = useState<boolean | null>(null)
  const [internalMediatorId, setInternalMediatorId] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const checkApproval = async () => {
    if (!user?.id) return false
    try {
      // 1. Check global approval
      const { data: mediatorData, error: mError } = await supabase
        .from('mediators')
        .select('id, is_approved')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (mError) throw mError
      if (!mediatorData) {
        setIsApproved(false)
        return false
      }

      setInternalMediatorId(mediatorData.id)

      if (mediatorData.is_approved) {
        setIsApproved(true)
        return true
      }

      // 2. Check if any doctor has approved this mediator
      const { data: assignments, error: aError } = await supabase
        .from('mediator_assignments')
        .select('id, status, doctor_id')
        .eq('mediator_id', mediatorData.id)
      
      if (aError) throw aError
      
      const approvedCount = assignments?.filter(a => a.status === 'approved').length || 0
      const isIndeedApproved = approvedCount > 0
      
      console.log('[MediatorAccess] Verification result:', { approvedCount, assignments })
      
      setIsApproved(isIndeedApproved)
      return isIndeedApproved
    } catch (err) {
      console.error('[MediatorAccess] Critical verification error:', err)
      setIsApproved(false)
      return false
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
        const filters = {}
        if (profile?.role === 'mediator' && profile?.approvedDoctorIds) {
          filters.ids = profile.approvedDoctorIds
        }

        const [docs, metrics] = await Promise.allSettled([
          import('@/services/doctors.service').then(m => m.doctorsService.getAll(filters)),
          queueService.getHospitalMetrics(profile?.hospital_id, filters.ids)
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
  }, [user?.id, isApproved, profile?.hospital_id])

  const handleFindDoctor = async (e: React.FormEvent) => {
    e.preventDefault()
    const searchEmail = (e.target as any).email.value
    if (!searchEmail) return
    setIsSearching(true)
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('email', searchEmail.trim())
        .eq('role', 'doctor')
        .maybeSingle()

      if (userError || !userData) {
        toast.error('Could not find this doctor')
        return
      }

      const { data: docData, error: docError } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', userData.id)
        .maybeSingle()
      
      if (docError || !docData) {
        toast.error('Clinical record not found')
        return
      }

      const mediatorId = internalMediatorId || profile?.mediator_id
      if (!mediatorId) {
        toast.error('Staff record not found. Please refresh.')
        return
      }

      const { error: assignError } = await supabase
        .from('mediator_assignments')
        .upsert({
          mediator_id: mediatorId,
          doctor_id: docData.id,
          status: 'pending'
        }, {
          onConflict: 'mediator_id, doctor_id'
        })

      if (assignError) throw assignError
      toast.success(`Request sent to Dr. ${userData.full_name}`)
      ;(e.target as any).reset()
    } catch (err) {
      console.error(err)
      toast.error('Failed to send request')
    } finally {
      setIsSearching(false)
    }
  }

  if (isLoading || isApproved === null) return <PageLoader label="Verifying staff credentials..." />

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
               <h2 className="text-3xl font-bold font-display text-surface-900">
                  {internalMediatorId ? 'Access Pending or Revoked' : 'Link to your Clinician'}
               </h2>
               <p className="text-surface-500 leading-relaxed px-4">
                  {internalMediatorId 
                    ? 'Your access to clinical data was suspended or is still pending. You can request access from another provider below.' 
                    : 'To access clinical data, you must first be approved by the doctor you work for. Please enter their official clinical email below.'}
               </p>
            </div>

            <Card className="border-none shadow-premium bg-white p-2">
               <form onSubmit={handleFindDoctor} className="flex gap-2">
                  <div className="relative flex-1">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                     <input 
                        name="email"
                        type="email"
                        placeholder="doctor@mediqueue.com"
                        className="w-full bg-surface-50 border-none rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
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
                onClick={async () => {
                  toast.loading('Verifying approval status...', { id: 'verify' })
                  await refreshProfile()
                  const isNowApproved = await checkApproval()
                  toast.dismiss('verify')
                  if (isNowApproved) {
                    toast.success('Access unlocked!')
                  } else {
                    toast.error('Approval still pending or not found.')
                  }
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-surface-50 text-primary-600 rounded-2xl text-sm font-bold transition-all border border-primary-100 shadow-sm"
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
               <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">MediQueue Secure Staff Linkage v2.2</p>
            </div>
        </div>
      </DashboardLayout>
    )
  }

  const emergencies = entries.filter(e => e.queue_type === 'emergency' && e.status === 'waiting').length

  return (
    <DashboardLayout title="Operational Dashboard" subtitle="Enterprise-grade hospital queue analytics">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        
        {emergencies > 0 && (
          <div className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-danger-600 to-danger-400 animate-pulse" />
            <div className="relative px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <TriangleAlert className="w-6 h-6 animate-bounce" />
                <div>
                  <p className="font-bold text-lg">URGENT: {emergencies} Emergency Case{emergencies > 1 ? 's' : ''}</p>
                  <p className="text-white/80 text-sm">Priority intervention required in current queue</p>
                </div>
              </div>
              <Link to="/mediator/queue" className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-xl backdrop-blur-md transition-all font-bold text-sm">
                Take Action
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="TOTAL REGISTRATIONS"
            value={stats?.total_today || 0}
            icon={Users}
            trend={{ value: 12, isPositive: true }}
            subtitle="vs yesterday"
            color="primary"
          />
          <StatsCard
            title="ACTIVE QUEUE"
            value={stats?.active_queue || 0}
            icon={Clock}
            subtitle="patients waiting"
            color="warning"
          />
          <StatsCard
            title="CONSULTATIONS"
            value={stats?.completed_today || 0}
            icon={CheckCircle}
            subtitle="completed"
            color="success"
          />
          <StatsCard
            title="EFFICIENCY INDEX"
            value={`${stats?.avg_wait_time || 0}m`}
            icon={TrendingUp}
            subtitle="avg wait time"
            color="medical"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-none shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between border-b border-surface-100">
               <div>
                  <CardTitle className="text-lg">Patient Inflow (Hourly)</CardTitle>
                  <p className="text-surface-400 text-xs">Real-time arrival volume tracking</p>
               </div>
               <Badge variant="primary" dot pulse>LIVE UPDATES</Badge>
            </CardHeader>
            <CardBody className="h-[400px]">
              {stats && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.hourly_distribution || []}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary-500)" stopOpacity={1} />
                        <stop offset="100%" stopColor="var(--primary-700)" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--surface-400)'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--surface-400)'}} />
                    <Tooltip 
                      cursor={{fill: 'var(--surface-50)'}}
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={24} fill="url(#barGradient)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardBody>
          </Card>

          <Card className="border-none shadow-premium">
            <CardHeader className="border-b border-surface-100">
               <CardTitle className="text-lg flex items-center gap-2"><PieChart className="w-5 h-5 text-warning-500" /> Queue Segmentation</CardTitle>
            </CardHeader>
            <CardBody className="h-[400px] flex flex-col items-center justify-center">
              {stats && (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsPie>
                      <Pie
                        data={stats?.visit_type_dist || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={8}
                        dataKey="count"
                      >
                        {(stats?.visit_type_dist || []).map((entry: any, index: number) => (
                          <Cell key={index} fill={['#6366f1', '#f59e0b', '#ef4444'][index % 3]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="flex gap-6 mt-6">
                    { (stats?.visit_type_dist || []).map((entry: any, idx: number) => (
                      <div key={idx} className="text-center">
                        <p className="text-lg font-bold text-surface-800">{entry.count}</p>
                        <p className="text-[10px] uppercase font-bold text-surface-400 tracking-wider font-display">{entry.name}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>

        <Card className="border-none shadow-premium overflow-hidden">
          <CardHeader className="bg-white border-b border-surface-100 flex flex-row items-center justify-between p-6">
            <CardTitle className="text-lg flex items-center gap-2">
               <Stethoscope className="w-5 h-5 text-medical-600" /> Provider Status & Inflow
            </CardTitle>
            <Link to="/mediator/doctors" className="text-xs font-bold text-primary-600 hover:text-primary-700 tracking-wide uppercase">View All</Link>
          </CardHeader>
          <CardBody className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-y md:divide-y-0 divide-surface-100">
               <div className="p-6">
                  <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-6">Active Clinicians</p>
                  <div className="space-y-4">
                     {doctors.slice(0, 4).map(doc => (
                       <div key={doc.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-surface-50 transition-all border border-transparent hover:border-surface-100">
                          <div className="flex items-center gap-3">
                             <Avatar name={doc.user?.full_name} size="sm" />
                             <div>
                                <p className="text-sm font-bold text-surface-900">{doc.user?.full_name}</p>
                                <p className="text-[10px] text-surface-500 font-medium">{doc.specialization}</p>
                             </div>
                          </div>
                          <Badge variant={doc.status === 'active' ? 'success' : 'neutral'} dot>
                             {doc.status || 'Active'}
                          </Badge>
                       </div>
                     ))}
                  </div>
               </div>
                <div className="p-6 bg-surface-50/30">
                  <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-6">Recent Queue Movements</p>
                  <div className="space-y-6">
                     {entries
                        .filter(e => doctors.some(d => d.id === e.doctor_id))
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 4)
                        .map((entry, i) => {
                          const doc = doctors.find(d => d.id === entry.doctor_id)
                          return (
                            <div key={entry.id} className="flex items-start gap-4 animate-in slide-in-from-right duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                               <div className={`w-2 h-2 rounded-full mt-1.5 ${i === 0 ? 'bg-primary-500 animate-pulse' : 'bg-surface-300'}`} />
                               <div>
                                  <p className="text-xs text-surface-700 font-medium">
                                    Token <span className="font-bold">#{entry.token_number}</span> checked in for Dr. {doc?.user?.full_name || 'Clinician'}
                                  </p>
                                  <p className="text-[10px] text-surface-400 mt-1">{formatDistanceToNow(new Date(entry.created_at))} ago</p>
                               </div>
                            </div>
                          )
                        })}
                     {entries.filter(e => doctors.some(d => d.id === e.doctor_id)).length === 0 && (
                       <p className="text-xs text-surface-400 text-center py-8">No recent movements</p>
                     )}
                  </div>
                </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  )
}
