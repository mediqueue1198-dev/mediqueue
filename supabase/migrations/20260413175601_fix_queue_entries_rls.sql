-- Fix queue_entries RLS policies for patient check-in
-- Issue: After doctor accepts appointment, patient couldn't check-in due to missing SELECT and incorrect INSERT policies

-- Add SELECT policy for queue_entries so patients can see their own queue entries
DROP POLICY IF EXISTS "queue_entries_select_own" ON public.queue_entries;
CREATE POLICY "queue_entries_select_own" ON public.queue_entries FOR SELECT USING (
  patient_id = auth.uid() 
  OR public.get_user_role() = 'mediator' 
  OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);

-- Fix INSERT policy - patients can insert with their own user_id
DROP POLICY IF EXISTS "queue_entries_insert_patient" ON public.queue_entries;
CREATE POLICY "queue_entries_insert_patient" ON public.queue_entries FOR INSERT WITH CHECK (
  patient_id = auth.uid() 
  OR public.get_user_role() = 'mediator' 
  OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);

-- Add UPDATE policy for queue entries (for check-in status updates, etc.)
DROP POLICY IF EXISTS "queue_entries_update_own" ON public.queue_entries;
CREATE POLICY "queue_entries_update_own" ON public.queue_entries FOR UPDATE USING (
  patient_id = auth.uid() 
  OR public.get_user_role() = 'mediator' 
  OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);
