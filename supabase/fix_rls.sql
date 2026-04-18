-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediator_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;

-- 1. Users Policies
DROP POLICY IF EXISTS "Allow public read access to user profiles" ON public.users;
CREATE POLICY "Allow public read access to user profiles" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 2. Patients Policies
DROP POLICY IF EXISTS "Patients can view their own records" ON public.patients;
CREATE POLICY "Patients can view their own records" ON public.patients FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service providers can view patient records" ON public.patients;
CREATE POLICY "Service providers can view patient records" ON public.patients FOR SELECT USING (true);

-- 3. Appointments Policies
DROP POLICY IF EXISTS "Patients can manage their own appointments" ON public.appointments;
CREATE POLICY "Patients can manage their own appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "Doctors and staff can manage appointments" ON public.appointments;
CREATE POLICY "Doctors and staff can manage appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    doctor_id IN (SELECT doctor_id FROM public.mediator_assignments WHERE status = 'approved' AND mediator_id IN (SELECT id FROM public.mediators WHERE user_id = auth.uid()))
  );

-- 4. Queue Access
DROP POLICY IF EXISTS "Secure queue access" ON public.queue_entries;
CREATE POLICY "Secure queue access" ON public.queue_entries
  FOR ALL TO authenticated
  USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    doctor_id IN (SELECT doctor_id FROM public.mediator_assignments WHERE status = 'approved' AND mediator_id IN (SELECT id FROM public.mediators WHERE user_id = auth.uid())) OR
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- 5. Notifications
DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;
CREATE POLICY "Users can manage their own notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- 6. Family Members
DROP POLICY IF EXISTS "Patients can manage their family members" ON public.family_members;
CREATE POLICY "Patients can manage their family members" ON public.family_members
  FOR ALL TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

-- 7. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries;
