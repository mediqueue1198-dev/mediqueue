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

-- Fix RLS policies for patients to access their own data
DROP POLICY IF EXISTS "patients_select_own" ON public.patients;
CREATE POLICY "patients_select_own" ON public.patients FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "family_members_select_own" ON public.family_members;
CREATE POLICY "family_members_select_own" ON public.family_members FOR SELECT USING (
  patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "family_members_insert_own" ON public.family_members;
CREATE POLICY "family_members_insert_own" ON public.family_members FOR INSERT WITH CHECK (
  patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "family_members_update_own" ON public.family_members;
CREATE POLICY "family_members_update_own" ON public.family_members FOR UPDATE USING (
  patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "family_members_delete_own" ON public.family_members;
CREATE POLICY "family_members_delete_own" ON public.family_members FOR DELETE USING (
  patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "appointments_select_own" ON public.appointments;
CREATE POLICY "appointments_select_own" ON public.appointments FOR SELECT USING (
  patient_id = auth.uid() OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "appointments_insert_own" ON public.appointments;
CREATE POLICY "appointments_insert_own" ON public.appointments FOR INSERT WITH CHECK (
  patient_id = auth.uid()
);

DROP POLICY IF EXISTS "queue_entries_select_own" ON public.queue_entries;
CREATE POLICY "queue_entries_select_own" ON public.queue_entries FOR SELECT USING (
  patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "medical_records_select_own" ON public.medical_records;
CREATE POLICY "medical_records_select_own" ON public.medical_records FOR SELECT USING (
  patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctors_update_own" ON public.doctors;
CREATE POLICY "doctors_update_own" ON public.doctors FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "doctors_insert_own" ON public.doctors;
CREATE POLICY "doctors_insert_own" ON public.doctors FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (id = auth.uid());