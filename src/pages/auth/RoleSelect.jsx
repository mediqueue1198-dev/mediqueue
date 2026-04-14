import { Link, useNavigate } from 'react-router-dom'
import { Heart, User, Sparkles, Building2, Stethoscope } from 'lucide-react'

export default function RoleSelect() {
  const navigate = useNavigate()

  const handleRoleSelect = (role) => {
    navigate(`/auth?role=${role}`)
  }

  const roles = [
    {
      id: 'patient',
      title: 'Patient',
      description: 'Book appointments and view your medical records.',
      icon: User,
      color: 'bg-primary-500',
      shadow: 'shadow-primary-500/20'
    },
    {
      id: 'doctor',
      title: 'Doctor',
      description: 'Manage your queue, consult patients, and view earnings.',
      icon: Stethoscope,
      color: 'bg-medical-500',
      shadow: 'shadow-medical-500/20'
    },
    {
      id: 'mediator',
      title: 'Hospital Staff',
      description: 'Manage hospital queues, walk-ins, and doctor schedules.',
      icon: Building2,
      color: 'bg-warning-500',
      shadow: 'shadow-warning-500/20'
    }
  ]

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-1/2 h-1/2 bg-primary-200/40 rounded-full blur-3xl mix-blend-multiply" />
        <div className="absolute bottom-[-10%] right-[-10%] w-1/2 h-1/2 bg-medical-200/40 rounded-full blur-3xl mix-blend-multiply" />
      </div>

      <div className="relative z-10 max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center shadow-glow">
              <Heart className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-surface-900 font-display mb-3">Choose Your Role</h1>
          <p className="text-lg text-surface-500">Select how you want to use MediQueue</p>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => handleRoleSelect(role.id)}
              className={`group relative text-left bg-white p-8 rounded-3xl border border-surface-200 hover:border-transparent hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 focus:outline-none focus:ring-4 focus:ring-primary-500/20`}
            >
              <div className={`w-14 h-14 ${role.color} text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg ${role.shadow} group-hover:scale-110 transition-transform duration-300`}>
                <role.icon className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-surface-900 mb-3 font-display">{role.title}</h3>
              <p className="text-surface-500 leading-relaxed group-hover:text-surface-600 transition-colors">
                {role.description}
              </p>
              
              <div className="mt-8 flex items-center text-sm font-semibold text-surface-900 group-hover:text-primary-600 transition-colors">
                Continue as {role.title}
                <Sparkles className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Hover gradient border effect */}
              <div className="absolute inset-0 border-2 border-transparent rounded-3xl group-hover:border-primary-500/10 transition-colors pointer-events-none" />
            </button>
          ))}
        </div>
        
        <div className="mt-12 text-center animate-in fade-in duration-1000 delay-300">
          <Link to="/auth?mode=login" className="text-surface-500 hover:text-primary-600 font-medium text-sm transition-colors">
            Already have an account? Sign in directly
          </Link>
        </div>
      </div>
    </div>
  )
}
