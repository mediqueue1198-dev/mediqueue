import { useEffect, useState } from 'react'
import { Heart, Wifi, Clock } from 'lucide-react'
import { useQueueStore } from '@/store/queueStore'
import { formatTime } from '@/utils/helpers'

function DoctorBoard({ doctor, queue }) {
  const current = queue.find(e => e.status === 'in_consultation')
  const waiting = queue.filter(e => e.status === 'waiting').slice(0, 4)

  return (
    <div className="bg-surface-800 rounded-3xl overflow-hidden flex flex-col">
      {/* Doctor header */}
      <div className="gradient-primary p-5">
        <p className="text-white/70 text-sm font-medium">{doctor.specialization}</p>
        <p className="text-white font-bold text-xl font-display">{doctor.user?.full_name}</p>
        <p className="text-white/60 text-xs mt-1">{doctor.department}</p>
      </div>

      {/* Now serving */}
      <div className="p-5 border-b border-surface-700">
        <p className="text-surface-400 text-xs font-semibold uppercase tracking-widest mb-3">Now Serving</p>
        {current ? (
          <div className="flex items-center gap-4">
            <div className="tv-token text-white flex-shrink-0" style={{ fontSize: '3.5rem' }}>
              {current.token_number}
            </div>
            <div>
              <div className="w-3 h-3 bg-medical-500 rounded-full animate-pulse mb-1" />
              <p className="text-surface-300 text-sm">In Consultation</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="text-surface-500 font-display font-bold" style={{ fontSize: '3rem' }}>—</div>
            <p className="text-surface-500 text-sm">Queue Empty</p>
          </div>
        )}
      </div>

      {/* Next tokens */}
      <div className="p-5 flex-1">
        <p className="text-surface-400 text-xs font-semibold uppercase tracking-widest mb-3">Next In Queue</p>
        <div className="space-y-2">
          {waiting.length === 0 ? (
            <p className="text-surface-500 text-sm">No patients waiting</p>
          ) : (
            waiting.map((e, idx) => (
              <div key={e.id} className="flex items-center gap-3">
                <span className={`font-mono font-bold text-base ${
                  idx === 0 ? 'text-warning-400' : 'text-surface-300'
                }`}>
                  {e.token_number}
                </span>
                {e.queue_type === 'emergency' && (
                  <span className="text-xs bg-danger-600 text-white px-2 py-0.5 rounded-full font-semibold animate-pulse">
                    EMERGENCY
                  </span>
                )}
                <span className="text-surface-500 text-xs ml-auto">~{e.predicted_consultation_time}m</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default function QueueDisplayBoard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const { entries, loadQueue } = useQueueStore()
  const [doctors, setDoctors] = useState([])

  useEffect(() => {
    loadQueue()
    import('@/services/doctors.service').then(({ doctorsService }) => doctorsService.getAll().then(setDoctors))
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const getQueueForDoctor = (doctorId) =>
    entries.filter(e => e.doctor_id === doctorId)

  const activeDoctors = doctors.filter(d => d.is_available)

  return (
    <div className="min-h-screen tv-mode p-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center shadow-glow">
            <Heart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-2xl font-display">MediQueue</h1>
            <p className="text-surface-400 text-sm">Real-time Queue Display</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-medical-400">
            <Wifi className="w-4 h-4" />
            <span className="text-sm font-medium">Live</span>
          </div>
          <div className="text-right">
            <p className="text-white text-3xl font-bold font-display tabular-nums">
              {currentTime.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-surface-400 text-sm">
              {currentTime.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Doctor boards */}
      <div className={`grid gap-5 ${activeDoctors.length <= 2 ? 'grid-cols-2' : activeDoctors.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
        {activeDoctors.map(doc => (
          <DoctorBoard
            key={doc.id}
            doctor={doc}
            queue={getQueueForDoctor(doc.id)}
          />
        ))}
      </div>

      {/* Footer ticker */}
      <div className="mt-8 flex items-center justify-between text-surface-500 text-sm border-t border-surface-700 pt-5">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>Please wait for your token number to be called</span>
        </div>
        <div className="flex items-center gap-6">
          <span>🟢 In Consultation</span>
          <span>🟡 Waiting</span>
          <span>🔴 Emergency</span>
        </div>
        <div>
          Hospital Reception: <span className="text-white font-medium">+1 (555) 100-0000</span>
        </div>
      </div>
    </div>
  )
}
