import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Calendar, CreditCard, Clock, Users, Activity } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import StatsCard from '@/components/ui/StatsCard'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { useDoctorProfile } from '@/hooks/useDoctorProfile'
import { earningsService } from '@/services/earnings.service'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'

export default function DoctorEarnings() {
  const { profile, user } = useAuth()
  const { doctor, isLoading: isDoctorLoading } = useDoctorProfile(user?.id)
  
  const [todayEarnings, setTodayEarnings] = useState({ total: 0, consultationFee: 0, additionalCharges: 0, patientCount: 0 })
  const [weeklyEarnings, setWeeklyEarnings] = useState({})
  const [monthlyEarnings, setMonthlyEarnings] = useState({ total: 0, consultationFee: 0, additionalCharges: 0, patientCount: 0, dailyEarnings: {} })
  const [byVisitType, setByVisitType] = useState({})
  const [paymentBreakdown, setPaymentBreakdown] = useState({})
  const [todayAppointments, setTodayAppointments] = useState([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    if (!doctor?.id) return
    
    const loadData = async () => {
      setIsLoadingData(true)
      try {
        const today = await earningsService.getTodayEarnings(doctor.id)
        setTodayEarnings(today)
        
        const weekly = await earningsService.getWeeklyEarnings(doctor.id)
        setWeeklyEarnings(weekly)
        
        const monthly = await earningsService.getMonthlyEarnings(doctor.id)
        setMonthlyEarnings(monthly)
        
        const thirtyDaysAgo = subDays(new Date(), 30)
        const byType = await earningsService.getEarningsByVisitType(doctor.id, thirtyDaysAgo.toISOString(), new Date().toISOString())
        setByVisitType(byType)
        
        const breakdown = await earningsService.getPaymentStatusBreakdown(doctor.id, thirtyDaysAgo.toISOString(), new Date().toISOString())
        setPaymentBreakdown(breakdown)
        
        const appointments = await earningsService.getTodayAppointmentsWithPayments(doctor.id)
        setTodayAppointments(appointments || [])
      } catch (err) {
        console.error('Error loading earnings data:', err)
      } finally {
        setIsLoadingData(false)
      }
    }
    
    loadData()
  }, [doctor?.id])

  if (isDoctorLoading || isLoadingData) {
    return <PageLoader />
  }

  const getWeeklyChartData = () => {
    const today = new Date()
    const weekStart = subDays(today, 6)
    const days = eachDayOfInterval({ start: weekStart, end: today })
    
    return days.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd')
      return {
        day: format(day, 'EEE'),
        amount: weeklyEarnings[dateKey]?.total || 0,
        count: weeklyEarnings[dateKey]?.count || 0
      }
    })
  }

  const weeklyChartData = getWeeklyChartData()
  const maxAmount = Math.max(...weeklyChartData.map(d => d.amount), 1)

  return (
    <DashboardLayout title="Earnings" subtitle="Track your revenue and payments">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Today's Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-surface-500">Today's Earnings</p>
                  <p className="text-2xl font-bold text-green-700">₹{todayEarnings.total}</p>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <StatsCard 
            title="Consultation Fees" 
            value={`₹${todayEarnings.consultationFee}`} 
            subtitle="from fees" 
            icon={CreditCard} 
            color="primary" 
          />
          <StatsCard 
            title="Additional Charges" 
            value={`₹${todayEarnings.additionalCharges}`} 
            subtitle="extras" 
            icon={Activity} 
            color="warning" 
          />
          <StatsCard 
            title="Patients Served" 
            value={todayEarnings.patientCount} 
            subtitle="today" 
            icon={Users} 
            color="neutral" 
          />
        </div>

        {/* Weekly Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Weekly Earnings</span>
              <span className="text-sm font-normal text-surface-500">Last 7 days</span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex items-end justify-between gap-2 h-48">
              {weeklyChartData.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-primary-500 rounded-t-lg transition-all hover:bg-primary-600"
                    style={{ height: `${(day.amount / maxAmount) * 100}%`, minHeight: day.amount > 0 ? '8px' : '0' }}
                  />
                  <p className="text-xs text-surface-500 mt-2">{day.day}</p>
                  <p className="text-xs font-medium text-surface-700">₹{day.amount}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Monthly Summary & Breakdown */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Monthly Earnings */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Summary</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-surface-50 rounded-xl">
                <div>
                  <p className="text-sm text-surface-600">Total Earnings</p>
                  <p className="text-xl font-bold text-surface-800">₹{monthlyEarnings.total}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-surface-500">This month</p>
                  <p className="text-sm text-surface-600">{monthlyEarnings.patientCount} patients</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-primary-50 rounded-xl">
                  <p className="text-xs text-primary-600">Consultation Fees</p>
                  <p className="text-lg font-bold text-primary-700">₹{monthlyEarnings.consultationFee}</p>
                </div>
                <div className="p-3 bg-warning-50 rounded-xl">
                  <p className="text-xs text-warning-600">Additional Charges</p>
                  <p className="text-lg font-bold text-warning-700">₹{monthlyEarnings.additionalCharges}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Earnings by Visit Type */}
          <Card>
            <CardHeader>
              <CardTitle>Earnings by Visit Type</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {Object.entries(byVisitType).map(([type, data]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      type === 'first_visit' ? 'bg-primary-100 text-primary-600' :
                      type === 'follow_up' ? 'bg-blue-100 text-blue-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-800 capitalize">{type.replace('_', ' ')}</p>
                      <p className="text-xs text-surface-500">{data.count} patients</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-surface-800">₹{data.total}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* Payment Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Status (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 rounded-xl text-center">
                <p className="text-2xl font-bold text-green-700">₹{paymentBreakdown.paid?.total || 0}</p>
                <p className="text-sm text-green-600">Paid</p>
                <p className="text-xs text-green-500">{paymentBreakdown.paid?.count || 0} appointments</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-xl text-center">
                <p className="text-2xl font-bold text-yellow-700">₹{paymentBreakdown.pending?.total || 0}</p>
                <p className="text-sm text-yellow-600">Pending</p>
                <p className="text-xs text-yellow-500">{paymentBreakdown.pending?.count || 0} appointments</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl text-center">
                <p className="text-2xl font-bold text-blue-700">₹{paymentBreakdown.partial?.total || 0}</p>
                <p className="text-sm text-blue-600">Partial</p>
                <p className="text-xs text-blue-500">{paymentBreakdown.partial?.count || 0} appointments</p>
              </div>
              <div className="p-4 bg-surface-100 rounded-xl text-center">
                <p className="text-2xl font-bold text-surface-600">₹{paymentBreakdown.waived?.total || 0}</p>
                <p className="text-sm text-surface-600">Waived</p>
                <p className="text-xs text-surface-500">{paymentBreakdown.waived?.count || 0} appointments</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Today's Appointments with Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Appointments & Payments</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {todayAppointments.length === 0 ? (
              <div className="p-8 text-center text-surface-500">No appointments today</div>
            ) : (
              <div className="divide-y divide-surface-100">
                {todayAppointments.map((appt) => (
                  <div key={appt.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-50">
                    <div className="flex items-center gap-3">
                      <Avatar name={appt.patient?.full_name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-surface-800">{appt.patient?.full_name}</p>
                        <p className="text-xs text-surface-500 capitalize">{appt.visit_type?.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-surface-800">₹{appt.total_amount || appt.consultation_fee || 0}</p>
                      <Badge 
                        variant={
                          appt.payment_status === 'paid' ? 'success' :
                          appt.payment_status === 'partial' ? 'warning' :
                          appt.payment_status === 'waived' ? 'neutral' : 'danger'
                        }
                      >
                        {appt.payment_status || 'pending'}
                      </Badge>
                    </div>
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