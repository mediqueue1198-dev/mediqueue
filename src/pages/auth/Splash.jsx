import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'

export default function Splash() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Animate progress bar
    const duration = 2000 // 2 seconds total splash time
    const intervalTime = 20
    const steps = duration / intervalTime
    
    let currentStep = 0
    const timer = setInterval(() => {
      currentStep++
      setProgress(Math.min((currentStep / steps) * 100, 100))
      
      if (currentStep >= steps) {
        clearInterval(timer)
        // Transition to role selection
        setTimeout(() => navigate('/role-select'), 200)
      }
    }, intervalTime)

    return () => clearInterval(timer)
  }, [navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-medical-900 overflow-hidden relative">
      {/* Background Ornaments */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white blur-3xl animate-pulse"
            style={{
              width: `${(i + 1) * 150}px`,
              height: `${(i + 1) * 150}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              transform: 'translate(-50%, -50%)',
              animationDuration: `${3 + i}s`,
              animationDelay: `${i * 0.5}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-1000">
        <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-glow mb-6 overflow-hidden">
          <Heart className="w-12 h-12 text-white animate-bounce" style={{ animationDuration: '2s' }} />
        </div>
        
        <h1 className="text-5xl font-bold text-white font-display tracking-tight mb-2">
          MediQueue
        </h1>
        <p className="text-primary-100 text-lg mb-12">
          Smart Hospital Management
        </p>

        {/* Loading Bar */}
        <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
