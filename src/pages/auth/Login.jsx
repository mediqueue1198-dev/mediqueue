import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import GoogleLogo from '@/components/ui/GoogleLogo'
import { useAuth } from '@/hooks/useAuth'
import { loginSchema } from '@/utils/validators'
import { getRoleRedirect } from '@/utils/helpers'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import RoleButtons from '@/components/ui/RoleButtons'
import { ArrowLeft, Eye, Heart, Lock, Mail } from 'lucide-react'
import toast from 'react-hot-toast'


export default function Login() {
  const { login, isLoading, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState(null)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data) => {
    try {
      const { profile } = await login(data.email, data.password)
      const role = profile?.role || 'patient'
      toast.success(`Welcome back, ${profile?.full_name?.split(' ')[0] || 'User'}! 👋`)
      navigate(getRoleRedirect(role))
    } catch (err) {
      toast.error(err.message || 'Login failed')
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      if (!selectedRole) {
        toast.error('Please select your role first')
        setGoogleLoading(false)
        return
      }
      // Store selected role in sessionStorage for callback
      sessionStorage.setItem('pending_role', selectedRole)
      await signInWithGoogle(selectedRole)
      // User will be redirected to Google and then back to callback
    } catch (err) {
      toast.error('Google sign-in failed: ' + err.message)
      setGoogleLoading(false)
    }
  }



  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-12 xl:px-20">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glow">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-xl text-surface-800 font-display leading-none">MediQueue</p>
              <p className="text-xs text-surface-500 mt-0.5">Smart Hospital Management</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-surface-800 font-display mb-1">Welcome back</h2>
          <p className="text-sm text-surface-500 mb-8">Sign in to your account to continue</p>



          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Input
              label="Email address"
              type="email"
              icon={Mail}
              placeholder="you@example.com"
              error={errors.email?.message}
              required
              {...register('email')}
            />
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              icon={Lock}
              placeholder="••••••••"
              error={errors.password?.message}
              required
              iconRight={
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-surface-400 hover:text-surface-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              {...register('password')}
            />

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" isLoading={isLoading} size="lg" className="w-full">
              Sign In
            </Button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-surface-200"></div>
              <span className="flex-shrink-0 mx-4 text-surface-400 text-xs">Or continue with</span>
              <div className="flex-grow border-t border-surface-200"></div>
            </div>

            <RoleButtons
              label="I am a..."
              value={selectedRole}
              onChange={setSelectedRole}
            />

            <div className="mt-2">
<Button
  variant="outline"
  icon={GoogleLogo}
  onClick={handleGoogleSignIn}
  isLoading={googleLoading}
>
  Sign in with Google
</Button>
            </div>
          </form>

          <p className="text-center text-sm text-surface-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Create account
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Visual */}
      <div className="hidden lg:flex flex-1 gradient-primary items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: `${80 + i * 60}px`,
                height: `${80 + i * 60}px`,
                top: `${-20 + i * 15}%`,
                right: `${-10 + i * 5}%`,
                opacity: 0.3 - i * 0.04,
              }}
            />
          ))}
        </div>
        <div className="relative text-center text-white px-12 max-w-md">
          <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-glow">
            <Heart className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold font-display mb-4">Intelligent Queue Management</h2>
          <p className="text-white/80 text-base leading-relaxed">
            Minimize patient wait times with our smart algorithm. Real-time updates, seamless appointments, and intelligent scheduling.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-10">
            {[
              { label: 'Avg Wait ↓', value: '42%' },
              { label: 'Patients / Day', value: '200+' },
              { label: 'Satisfaction', value: '4.8★' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 rounded-2xl p-4">
                <p className="text-2xl font-bold font-display">{stat.value}</p>
                <p className="text-xs text-white/70 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
