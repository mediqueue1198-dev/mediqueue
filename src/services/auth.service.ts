import supabase from '@/lib/supabase'
import { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'patient' | 'doctor' | 'mediator';
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export const authService = {
  async getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  async getUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  async getUserProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
      
    if (error) throw error
    return data
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async resetPassword(email: string): Promise<{ message: string }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
    return { message: 'Password reset email sent' }
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback as any)
  },
}

export default authService
