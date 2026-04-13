import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Mail, ArrowLeft, Loader } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'
import supabase from '@/lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!email) {
      toast.error('Please enter your email address')
      return
    }

    setIsLoading(true)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) throw error
      
      setIsSubmitted(true)
      toast.success('Password reset link sent! Check your email.')
    } catch (err) {
      toast.error(err.message || 'Failed to send reset link')
    } finally {
      setIsLoading(false)
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
            <p className="text-xs text-surface-500">Reset your password</p>
          </div>
        </div>

        {isSubmitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-success-600" />
            </div>
            <h2 className="text-xl font-bold text-surface-800 font-display mb-2">Check your email</h2>
            <p className="text-sm text-surface-500 mb-6">
              We've sent a password reset link to <span className="font-medium text-surface-700">{email}</span>
            </p>
            <p className="text-xs text-surface-400 mb-6">
              Didn't receive the email? Check your spam folder or try again.
            </p>
            <Link 
              to="/login" 
              className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-surface-800 font-display mb-1">Forgot password?</h2>
            <p className="text-sm text-surface-500 mb-6">
              Enter your email and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                icon={Mail}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Button 
                type="submit" 
                isLoading={isLoading} 
                size="lg" 
                className="w-full"
                disabled={!email}
              >
                Send Reset Link
              </Button>
            </form>

            <p className="text-center text-sm text-surface-500 mt-6">
              Remember your password?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}