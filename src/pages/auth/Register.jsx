import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import RoleButtons from '@/components/ui/RoleButtons'
import { registerSchema } from '@/utils/validators'
import { useAuth } from '@/hooks/useAuth'
import { getRoleRedirect } from '@/utils/helpers'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'
import { Heart, User, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react'

export default function Register() {
  const { register: registerUser, isLoading } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data) => {
    try {
      await registerUser(data)
      toast.success('Account created! Please sign in.')
      navigate('/login')
    } catch (err) {
      toast.error(err.message || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-medical-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-soft border border-surface-100 p-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-xl font-display text-surface-800 leading-none">MediQueue</p>
            <p className="text-xs text-surface-500">Create your account</p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-surface-800 font-display mb-1">Get started</h2>
        <p className="text-sm text-surface-500 mb-6">Create your account to access the platform</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Full Name"
            icon={User}
            placeholder="Sarah Johnson"
            error={errors.full_name?.message}
            required
            {...register('full_name')}
          />
          <Input
            label="Email"
            type="email"
            icon={Mail}
            placeholder="you@email.com"
            error={errors.email?.message}
            required
            {...register('email')}
          />
          <Input
            label="Phone"
            type="tel"
            icon={Phone}
            placeholder="+1 (555) 000-0000"
            error={errors.phone?.message}
            required
            {...register('phone')}
          />
          
          <RoleButtons
            label="I am a..."
            name="role"
            value={register('role').value}
            onChange={(role) => register('role').onChange(role)}
            required
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            icon={Lock}
            placeholder="Min 8 characters"
            error={errors.password?.message}
            required
            iconRight={
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-surface-400 hover:text-surface-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            {...register('password')}
          />
          <Input
            label="Confirm Password"
            type="password"
            icon={Lock}
            placeholder="Repeat password"
            error={errors.confirm_password?.message}
            required
            {...register('confirm_password')}
          />

          <Button type="submit" isLoading={isLoading} size="lg" className="w-full mt-2">
            Create Account
          </Button>
        </form>

        <p className="text-center text-sm text-surface-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
