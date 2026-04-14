import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Heart, Mail, Lock, Eye, EyeOff, User, Phone, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

import GoogleLogo from '@/components/ui/GoogleLogo'
import { useAuth } from '@/hooks/useAuth'
import { loginSchema, registerSchema } from '@/utils/validators'
import { getRoleRedirect } from '@/utils/helpers'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const roleFromUrl = searchParams.get('role') || 'patient'
  const modeFromUrl = searchParams.get('mode') === 'register' ? 'register' : 'login'
  
  const [mode, setMode] = useState(modeFromUrl)
  const [showPassword, setShowPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  
  const { login, register: registerUser, signInWithGoogle, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Keep internal state synched if URL changes
    setMode(searchParams.get('mode') === 'register' ? 'register' : 'login')
  }, [searchParams])

  // Split forms for Login vs Register to use distinct schemas correctly
  const { 
    register: loginFormRegister, 
    handleSubmit: handleLoginSubmit, 
    formState: { errors: loginErrors } 
  } = useForm({
    resolver: zodResolver(loginSchema),
  })

  const { 
    register: registerFormRegister, 
    handleSubmit: handleRegisterSubmit, 
    formState: { errors: registerErrors } 
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: roleFromUrl } // Pre-fill the role
  })

  const onLogin = async (data) => {
    try {
      const { profile } = await login(data.email, data.password)
      const role = profile?.role || 'patient'
      toast.success(`Welcome back, ${profile?.full_name?.split(' ')[0] || 'User'}! 👋`)
      navigate(getRoleRedirect(role))
    } catch (err) {
      toast.error(err.message || 'Login failed')
    }
  }

  const onRegister = async (data) => {
    try {
      // Force role from URL over anything else to be safe
      const regData = { ...data, role: roleFromUrl }
      await registerUser(regData)
      toast.success('Account created! Logging you in...')
      // Auto login after register
      try {
        await login(data.email, data.password)
        navigate(getRoleRedirect(roleFromUrl))
      } catch (loginErr) {
        setMode('login') // fallback to login if auto-login fails
      }
    } catch (err) {
      toast.error(err.message || 'Registration failed')
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      // Store selected role in sessionStorage for callback
      sessionStorage.setItem('pending_role', roleFromUrl)
      await signInWithGoogle(roleFromUrl)
      // User will be redirected to Google and then back to callback
    } catch (err) {
      toast.error('Google sign-in failed: ' + err.message)
      setGoogleLoading(false)
    }
  }

  const toggleMode = (newMode) => {
    setMode(newMode)
    // Update URL without reload to persist state correctly if reloaded
    const newParams = new URLSearchParams(searchParams)
    newParams.set('mode', newMode)
    navigate(`/auth?${newParams.toString()}`, { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 to-surface-100 py-12 px-4 sm:px-6 lg:px-8 relative">
      <Link to="/role-select" className="absolute top-8 left-8 flex items-center text-surface-500 hover:text-surface-900 transition-colors bg-white rounded-full px-4 py-2 shadow-sm border border-surface-200">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Link>

      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-surface-200/60 transition-all duration-300">
          
          {/* Header */}
          <div className="p-8 text-center bg-gradient-to-b from-primary-50/50 to-transparent">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-medical-500 shadow-lg shadow-primary-500/30 mb-6">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold font-display text-surface-900 capitalize leading-tight">
              {roleFromUrl} Access
            </h2>
            <p className="mt-2 text-surface-500 text-sm">
              {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create an account to get started.'}
            </p>
          </div>

          <div className="px-8 pb-8">
            {/* Tabs */}
            <div className="flex p-1 bg-surface-100 rounded-xl mb-8">
              <button
                onClick={() => toggleMode('login')}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  mode === 'login' 
                    ? 'bg-white text-surface-900 shadow-sm' 
                    : 'text-surface-500 hover:text-surface-700'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => toggleMode('register')}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  mode === 'register' 
                    ? 'bg-white text-surface-900 shadow-sm' 
                    : 'text-surface-500 hover:text-surface-700'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Google SignIn */}
            <Button
              variant="outline"
              size="lg"
              className="w-full mb-6 border-surface-200 hover:bg-surface-50 text-surface-700"
              icon={GoogleLogo}
              onClick={handleGoogleSignIn}
              isLoading={googleLoading}
            >
              Continue with Google
            </Button>

            <div className="relative flex items-center py-4 mb-2">
              <div className="flex-grow border-t border-surface-200"></div>
              <span className="flex-shrink-0 mx-4 text-surface-400 text-xs font-semibold uppercase tracking-wider">Or continue with email</span>
              <div className="flex-grow border-t border-surface-200"></div>
            </div>

            {/* Forms */}
            <div className="relative">
              {mode === 'login' ? (
                /* LOGIN FORM */
                <form key="login-form" onSubmit={handleLoginSubmit(onLogin)} className="space-y-4 animate-in slide-in-from-left-4 fade-in duration-300">
                  <Input
                    label="Email Address"
                    type="email"
                    icon={Mail}
                    placeholder="you@example.com"
                    error={loginErrors.email?.message}
                    {...loginFormRegister('email')}
                  />
                  
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    icon={Lock}
                    placeholder="••••••••"
                    error={loginErrors.password?.message}
                    iconRight={
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-surface-400 hover:text-primary-600 transition-colors">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    }
                    {...loginFormRegister('password')}
                  />

                  <div className="flex justify-end mt-1">
                    <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                      Forgot password?
                    </Link>
                  </div>

                  <Button type="submit" size="lg" className="w-full mt-6 shadow-md shadow-primary-500/20" isLoading={isLoading && mode === 'login'}>
                    Sign In to Dashboard
                  </Button>
                </form>

              ) : (

                /* REGISTER FORM */
                <form key="register-form" onSubmit={handleRegisterSubmit(onRegister)} className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                  <Input
                    label="Full Name"
                    icon={User}
                    placeholder="John Doe"
                    error={registerErrors.full_name?.message}
                    {...registerFormRegister('full_name')}
                  />

                  <Input
                    label="Email Address"
                    type="email"
                    icon={Mail}
                    placeholder="you@example.com"
                    error={registerErrors.email?.message}
                    {...registerFormRegister('email')}
                  />

                  <Input
                    label="Phone Number"
                    type="tel"
                    icon={Phone}
                    placeholder="+1 (555) 000-0000"
                    error={registerErrors.phone?.message}
                    {...registerFormRegister('phone')}
                  />
                  
                  {/* Hidden input to ensure role is passed if requested by schema, though we override it in onRegister anyway */}
                  <input type="hidden" {...registerFormRegister('role')} value={roleFromUrl} />

                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    icon={Lock}
                    placeholder="Min 8 characters"
                    error={registerErrors.password?.message}
                    iconRight={
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-surface-400 hover:text-primary-600 transition-colors">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    }
                    {...registerFormRegister('password')}
                  />
                  
                  <Input
                    label="Confirm Password"
                    type="password"
                    icon={Lock}
                    placeholder="Repeat password"
                    error={registerErrors.confirm_password?.message}
                    {...registerFormRegister('confirm_password')}
                  />

                  <Button type="submit" size="lg" className="w-full mt-6 shadow-md shadow-primary-500/20" isLoading={isLoading && mode === 'register'}>
                    Create Account
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
