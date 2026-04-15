import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { completeProfileSchema } from '@/utils/validators'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, User, Mail, Phone, Lock, Tag } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import RoleButtons from '@/components/ui/RoleButtons'
import toast from 'react-hot-toast'

export default function CompleteProfile() {
  const { profile, updateProfile, user } = useAuth()
  const navigate = useNavigate()
  
  const [selectedRole, setSelectedRole] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

   const { register, handleSubmit, formState: { errors } } = useForm({
     resolver: zodResolver(completeProfileSchema),
   })

   const onSubmit = async (data) => {
     setLoading(true)
     try {
       // Prepare updates
       const updates = {
         full_name: data.full_name,
         phone: data.phone,
         role: data.role,
       }
       
       // Only add password if provided
       if (data.password && data.password.trim() !== '') {
         updates.password = data.password
       }
       
       await updateProfile(updates)
       
       // Create role-specific record if needed
       const { supabase } = await import('@/lib/supabase')
       if (data.role === 'patient') {
         await supabase.from('patients').insert({ user_id: user.id })
       } else if (data.role === 'doctor') {
         await supabase.from('doctors').insert({ user_id: user.id })
       }
       // For mediator, no additional table is needed (only users table)
       
       toast.success('Profile completed successfully!')
       navigate('/')
     } catch (err) {
       toast.error('Failed to complete profile: ' + err.message)
       setLoading(false)
     }
   }

   return (
     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-medical-50 px-4 py-12">
       <div className="w-full max-w-md bg-white rounded-3xl shadow-soft border border-surface-100 p-8">
         {/* Logo */}
         <div className="flex items-center gap-3 mb-6">
           <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
             <User className="w-5 h-5 text-white" />
           </div>
           <div>
             <p className="font-bold text-xl font-display text-surface-800 leading-none">MediQueue</p>
             <p className="text-xs text-surface-500">Complete your profile</p>
           </div>
         </div>

         <h2 className="text-xl font-bold text-surface-800 font-display mb-1">Welcome!</h2>
         <p className="text-sm text-surface-500 mb-6">
           You signed in with Google. Please complete your profile to access the system.
         </p>

         <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
           <Input
             label="Full Name"
             icon={User}
             placeholder="John Doe"
             error={errors.full_name?.message}
             required
             {...register('full_name')}
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

           <Input
             label="Email"
             type="email"
             icon={Mail}
             placeholder="you@example.com"
             error={errors.email?.message}
             required
             defaultValue={profile?.email || ''}
             disabled
             {...register('email')}
           />

           <Input
             label="Password"
             type={showPassword ? 'text' : 'password'}
             icon={Lock}
             placeholder="Create a password (optional)"
             error={errors.password?.message}
             {...register('password')}
             description="Leave blank if you want to use Google sign-in only"
           >
             <button 
               type="button" 
               onClick={() => setShowPassword(!showPassword)} 
               className="text-surface-400 hover:text-surface-600"
             >
               {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
             </button>
           </Input>

           <Input
             label="Confirm Password"
             type="password"
             icon={Lock}
             placeholder="Confirm password"
             error={errors.confirm_password?.message}
             {...register('confirm_password')}
             description="Leave blank if password is also blank"
           />

           <RoleButtons
             label="I am a..."
             name="role"
             value={selectedRole}
             onChange={setSelectedRole}
             required
           />

           <Button 
             type="submit" 
             isLoading={loading} 
             size="lg" 
             className="w-full mt-2"
           >
             Complete Profile
           </Button>
         </form>

         <p className="text-center text-sm text-surface-500 mt-6">
           Already have an account?{' '}
           <a href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
             Sign in
           </a>
         </p>
       </div>
     </div>
   )
}