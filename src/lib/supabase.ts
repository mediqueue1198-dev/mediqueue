import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'CRITICAL: Supabase credentials NOT found. ' +
    'The application requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to function.'
  )
}

/**
 * The singleton Supabase client instance.
 * All database and auth interactions should go through this client.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)

export const isMockMode: boolean = false

export default supabase
