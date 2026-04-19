-- ============================================================
-- MediQueue - Complete Production Schema (MASTER SCHEMA - v3.0)
-- Consolidated Source of Truth for New Developers
-- ============================================================

-- 0. EXTENSIONS & SEARCH PATH
SET search_path TO public, extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. UTILITY FUNCTIONS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. INFRASTRUCTURE & MULTI-TENANCY
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hospitals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL, 
  address     TEXT,
  city        TEXT,
  country     TEXT,
  phone       TEXT,
  email       TEXT,
  logo_url    TEXT,
  config      JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BASE TABLES
-- ────────────────────────────────────────────────────────────

-- Users profile table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'mediator', 'admin', 'superadmin')),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  avatar_url  TEXT,
  hospital_id UUID REFERENCES public.hospitals(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Patients
CREATE TABLE IF NOT EXISTS public.patients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name              TEXT,
  full_name         TEXT, -- Added for compatibility
  patient_name      TEXT,
  phone             TEXT,
  date_of_birth     DATE,
  blood_type        TEXT CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','')),
  no_show_count     INTEGER DEFAULT 0,
  no_show_rate      DECIMAL(3,2) DEFAULT 0,
  total_visits      INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Doctors
CREATE TABLE IF NOT EXISTS public.doctors (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_id             UUID REFERENCES public.hospitals(id),
  name                    TEXT,
  specialization          TEXT DEFAULT 'General Practice',
  department              TEXT,
  experience_years        INTEGER DEFAULT 0,
  rating                  DECIMAL(2,1) DEFAULT 5.0,
  consultation_avg_time   INTEGER DEFAULT 15,
  is_available            BOOLEAN DEFAULT TRUE,
  is_onboarded            BOOLEAN DEFAULT FALSE,
  is_on_break             BOOLEAN DEFAULT FALSE,
  break_until             TIMESTAMPTZ,
  break_message           TEXT,
  location_city           TEXT,
  location_country        TEXT,
  daily_capacity          INTEGER DEFAULT 30,
  working_days            TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  consultation_start_time TIME DEFAULT '09:00',
  consultation_end_time   TIME DEFAULT '17:00',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Mediators (Clinical Staff)
CREATE TABLE IF NOT EXISTS public.mediators (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hospital_id  UUID REFERENCES public.hospitals(id),
  is_approved  BOOLEAN DEFAULT FALSE,
  created_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Mediator Assignments (Private Clinical Relationships)
CREATE TABLE IF NOT EXISTS public.mediator_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mediator_id  UUID NOT NULL REFERENCES public.mediators(id) ON DELETE CASCADE,
  doctor_id    UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mediator_id, doctor_id)
);

-- Family members
CREATE TABLE IF NOT EXISTS public.family_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  relationship    TEXT NOT NULL,
  date_of_birth   DATE,
  blood_type      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CORE QUEUE SYSTEM
-- ────────────────────────────────────────────────────────────

-- Custom Types
DO $$ BEGIN
    CREATE TYPE queue_type AS ENUM ('appointment', 'walk_in', 'emergency');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.queue_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id         UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id        UUID REFERENCES public.patients(id),
  appointment_id    UUID, -- Linked appointment if any
  family_member_id  UUID REFERENCES public.family_members(id),
  patient_name      TEXT NOT NULL,
  patient_phone     TEXT,
  token_number      TEXT NOT NULL, -- Unified as TEXT
  sequence_number   INTEGER,
  status            TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_consultation', 'completed', 'skipped', 'no_show', 'cancelled')),
  queue_type        TEXT NOT NULL CHECK (queue_type IN ('appointment', 'walk_in', 'emergency')),
  priority_score    INTEGER DEFAULT 0,
  symptoms          TEXT,
  check_in_status   BOOLEAN DEFAULT FALSE,
  check_in_time     TIMESTAMPTZ,
  arrival_status    TEXT DEFAULT 'not_arrived' CHECK (arrival_status IN ('not_arrived', 'arrived', 'late', 'no_show')),
  called_at         TIMESTAMPTZ,
  consultation_started_at TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  skipped_at        TIMESTAMPTZ,
  consultation_duration_minutes INTEGER,
  predicted_consultation_time INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments (Pre-booked)
CREATE TABLE IF NOT EXISTS public.appointments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id         UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES public.patients(id), -- Standardized to Patient ID
  family_member_id  UUID REFERENCES public.family_members(id),
  scheduled_time    TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER DEFAULT 15,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  visit_type        TEXT NOT NULL DEFAULT 'first_visit' CHECK (visit_type IN ('first_visit', 'follow_up', 'emergency', 'walk_in')),
  symptoms          TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Consultation History
CREATE TABLE IF NOT EXISTS public.consultation_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id        UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id       UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  queue_entry_id   UUID REFERENCES public.queue_entries(id) ON DELETE SET NULL,
  duration_minutes INTEGER,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  ended_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Medical Records
CREATE TABLE IF NOT EXISTS public.medical_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id        UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  appointment_id   UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  queue_entry_id   UUID REFERENCES public.queue_entries(id) ON DELETE SET NULL,
  diagnosis        TEXT NOT NULL,
  prescription     JSONB DEFAULT '[]',
  notes            TEXT,
  attachments      TEXT[],
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT CHECK (type IN ('appointment', 'queue', 'system', 'message')),
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SECURITY & POLICIES (RLS)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediator_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Hospital & Doctor Discovery
CREATE POLICY "Allow public read access to hospitals" ON public.hospitals FOR SELECT USING (true);
CREATE POLICY "Allow public read access to doctors" ON public.doctors FOR SELECT USING (true);

-- User Profile Policies
CREATE POLICY "Allow public read access to user profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Patient Policies
CREATE POLICY "Patients can view their own records" ON public.patients FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service providers can view patient records" ON public.patients FOR SELECT USING (true);

-- Mediator Privacy Policies
CREATE POLICY "Mediators can view their own assignment status" ON public.mediator_assignments
  FOR SELECT USING (mediator_id IN (SELECT id FROM public.mediators WHERE user_id = auth.uid()));

CREATE POLICY "Mediators can request access to doctors" ON public.mediator_assignments
  FOR INSERT WITH CHECK (mediator_id IN (SELECT id FROM public.mediators WHERE user_id = auth.uid()));

CREATE POLICY "Mediators can retry/update their own requests" ON public.mediator_assignments
  FOR UPDATE USING (mediator_id IN (SELECT id FROM public.mediators WHERE user_id = auth.uid()));

CREATE POLICY "Doctors can manage their staff assignments" ON public.mediator_assignments
  FOR ALL USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));

-- Queue Access
CREATE POLICY "Secure queue access" ON public.queue_entries
  FOR ALL USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    doctor_id IN (SELECT doctor_id FROM public.mediator_assignments WHERE status = 'approved' AND mediator_id IN (SELECT id FROM public.mediators WHERE user_id = auth.uid())) OR
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- Appointments Access
CREATE POLICY "appointments_patient_access" ON public.appointments
  FOR ALL USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "appointments_doctor_access" ON public.appointments
  FOR ALL USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    doctor_id IN (SELECT doctor_id FROM public.mediator_assignments WHERE status = 'approved' AND mediator_id IN (SELECT id FROM public.mediators WHERE user_id = auth.uid()))
  );

-- Medical Records Access
CREATE POLICY "medical_records_patient_access" ON public.medical_records
  FOR SELECT USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "medical_records_doctor_access" ON public.medical_records
  FOR ALL USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    (public.get_user_role() = 'mediator')
  );

-- Notifications Access
CREATE POLICY "Users can manage their own notifications" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- 6. RPC FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- Handle new user registration automatically via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_full_name TEXT;
  v_hospital_id UUID;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  v_hospital_id := '00000000-0000-0000-0000-000000000001'; -- Default Clinical TENANT

  INSERT INTO public.users (id, email, full_name, role, hospital_id)
  VALUES (NEW.id, NEW.email, v_full_name, v_role, v_hospital_id)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    hospital_id = EXCLUDED.hospital_id;

  IF v_role = 'patient' THEN
    INSERT INTO public.patients (user_id, name, patient_name, full_name) 
    VALUES (NEW.id, v_full_name, v_full_name, v_full_name)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF v_role = 'doctor' THEN
    INSERT INTO public.doctors (user_id, name, hospital_id) 
    VALUES (NEW.id, v_full_name, v_hospital_id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF v_role = 'mediator' THEN
    INSERT INTO public.mediators (user_id, hospital_id, is_approved) 
    VALUES (NEW.id, v_hospital_id, false)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check in from appointment
CREATE OR REPLACE FUNCTION public.check_in_from_appointment(
  p_appointment_id UUID,
  p_doctor_id UUID,
  p_token TEXT,
  p_priority_score INTEGER,
  p_predicted_time INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry_id UUID;
  v_user_id UUID;
  v_patient_id UUID;
  v_scheduled_time TIMESTAMPTZ;
  v_duration_minutes INTEGER;
  v_result JSON;
BEGIN
  -- 1. Get appointment details
  SELECT patient_id, scheduled_time, duration_minutes
  INTO v_patient_id, v_scheduled_time, v_duration_minutes
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- 2. Verify authorization
  IF (SELECT user_id FROM patients WHERE id = v_patient_id) != auth.uid() 
     AND (SELECT public.get_user_role()) != 'mediator' 
     AND (SELECT user_id FROM doctors WHERE id = p_doctor_id) != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to check in to this appointment';
  END IF;

  -- 3. Insert queue entry
  INSERT INTO public.queue_entries (
    doctor_id,
    patient_id,
    appointment_id,
    queue_type,
    token_number,
    priority_score,
    predicted_consultation_time,
    status,
    check_in_status,
    check_in_time,
    arrival_status,
    patient_name
  ) 
  SELECT 
    p_doctor_id,
    v_patient_id,
    p_appointment_id,
    'appointment',
    p_token,
    p_priority_score,
    COALESCE(v_duration_minutes, p_predicted_time),
    'waiting',
    true,
    NOW(),
    'arrived',
    p.patient_name
  FROM patients p WHERE p.id = v_patient_id
  RETURNING id INTO v_entry_id;

  -- 4. Update appointment status
  UPDATE public.appointments 
  SET status = 'completed'
  WHERE id = p_appointment_id;

  -- 5. Fetch full record
  SELECT json_build_object(
    'id', q.id,
    'doctor_id', q.doctor_id,
    'patient_id', q.patient_id,
    'token_number', q.token_number,
    'status', q.status
  ) INTO v_result
  FROM queue_entries q
  WHERE q.id = v_entry_id;

  RETURN v_result;
END;
$$;

-- Register walk-in patient
CREATE OR REPLACE FUNCTION register_walk_in_patient(
  p_full_name TEXT,
  p_phone TEXT,
  p_doctor_id UUID,
  p_symptoms TEXT,
  p_is_emergency BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_patient_id UUID;
  v_entry_id UUID;
  v_token_number TEXT;
  v_prefix TEXT;
  v_count INTEGER;
  v_priority_score INTEGER;
  v_result JSONB;
BEGIN
  -- 1. Find or create patient record
  SELECT id INTO v_patient_id FROM patients WHERE phone = p_phone LIMIT 1;
  
  IF v_patient_id IS NULL THEN
    INSERT INTO patients (full_name, phone, patient_name)
    VALUES (p_full_name, p_phone, p_full_name)
    RETURNING id INTO v_patient_id;
  END IF;

  -- 2. Generate Token
  v_prefix := CASE WHEN p_is_emergency THEN 'E' ELSE 'W' END;
  
  SELECT COUNT(*) + 1 INTO v_count 
  FROM queue_entries 
  WHERE doctor_id = p_doctor_id 
    AND created_at::DATE = CURRENT_DATE
    AND token_number LIKE v_prefix || '%';
  
  v_token_number := v_prefix || LPAD(v_count::TEXT, 2, '0');

  -- 3. Calculate initial priority
  v_priority_score := CASE WHEN p_is_emergency THEN 800 ELSE 100 END;

  -- 4. Insert into queue
  INSERT INTO queue_entries (
    patient_id,
    doctor_id,
    token_number,
    queue_type,
    status,
    priority_score,
    symptoms,
    check_in_status,
    check_in_time,
    arrival_status,
    patient_name
  )
  VALUES (
    v_patient_id,
    p_doctor_id,
    v_token_number,
    CASE WHEN p_is_emergency THEN 'emergency' ELSE 'walk_in' END,
    'waiting',
    v_priority_score,
    p_symptoms,
    TRUE,
    NOW(),
    'arrived',
    p_full_name
  )
  RETURNING id INTO v_entry_id;

  SELECT row_to_json(t)::JSONB INTO v_result FROM (SELECT * FROM queue_entries WHERE id = v_entry_id) t;
  RETURN v_result;
END;
$$;

-- Call next patient
CREATE OR REPLACE FUNCTION call_next_patient(p_doctor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_entry RECORD;
BEGIN
  SELECT * INTO v_next_entry
  FROM queue_entries
  WHERE doctor_id = p_doctor_id AND status = 'waiting'
  ORDER BY priority_score DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_next_entry IS NULL THEN RETURN NULL; END IF;

  UPDATE queue_entries
  SET status = 'in_consultation', called_at = NOW(), updated_at = NOW()
  WHERE id = v_next_entry.id
  RETURNING * INTO v_next_entry;

  RETURN row_to_json(v_next_entry)::JSONB;
END;
$$;

-- Doctor Queue Stats
CREATE OR REPLACE FUNCTION public.get_doctor_queue_stats(p_doctor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'waiting_count', (SELECT count(*) FROM queue_entries WHERE doctor_id = p_doctor_id AND status = 'waiting'),
    'in_consultation_count', (SELECT count(*) FROM queue_entries WHERE doctor_id = p_doctor_id AND status = 'in_consultation'),
    'completed_today', (SELECT count(*) FROM queue_entries WHERE doctor_id = p_doctor_id AND status = 'completed' AND created_at >= CURRENT_DATE),
    'avg_consultation_time', (SELECT COALESCE(avg(consultation_duration_minutes), 15) FROM queue_entries WHERE doctor_id = p_doctor_id AND status = 'completed')
  ) INTO result;
  RETURN result;
END;
$$;

-- Hospital Realtime Metrics
CREATE OR REPLACE FUNCTION public.get_hospital_realtime_metrics(p_hospital_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_today', (SELECT count(*) FROM queue_entries q JOIN doctors d ON q.doctor_id = d.id WHERE d.hospital_id = p_hospital_id AND q.created_at >= CURRENT_DATE),
    'active_queue', (SELECT count(*) FROM queue_entries q JOIN doctors d ON q.doctor_id = d.id WHERE d.hospital_id = p_hospital_id AND q.status IN ('waiting', 'in_consultation')),
    'completed_today', (SELECT count(*) FROM queue_entries q JOIN doctors d ON q.doctor_id = d.id WHERE d.hospital_id = p_hospital_id AND q.status = 'completed' AND q.created_at >= CURRENT_DATE),
    'avg_wait_time', (SELECT COALESCE(avg(EXTRACT(EPOCH FROM (consultation_started_at - created_at))/60), 0) FROM queue_entries q JOIN doctors d ON q.doctor_id = d.id WHERE d.hospital_id = p_hospital_id AND q.status IN ('in_consultation', 'completed') AND q.created_at >= CURRENT_DATE)
  ) INTO result;
  RETURN result;
END;
$$;

-- Admin Create Mediator
CREATE OR REPLACE FUNCTION public.admin_create_mediator(
  p_email TEXT,
  p_password_hash TEXT,
  p_full_name TEXT,
  p_hospital_id UUID,
  p_doctor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_mediator_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE email = p_email;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User must be registered first via Auth.');
  END IF;

  UPDATE public.users SET role = 'mediator', hospital_id = p_hospital_id WHERE id = v_user_id;

  INSERT INTO public.mediators (user_id, hospital_id, is_approved)
  VALUES (v_user_id, p_hospital_id, true)
  ON CONFLICT (user_id) DO UPDATE SET is_approved = true
  RETURNING id INTO v_mediator_id;

  INSERT INTO public.mediator_assignments (mediator_id, doctor_id, status)
  VALUES (v_mediator_id, p_doctor_id, 'approved')
  ON CONFLICT (mediator_id, doctor_id) DO UPDATE SET status = 'approved';

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$;

-- 7. SEED DATA (CORE TENANCY)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.hospitals (id, name, slug, city, country)
VALUES ('00000000-0000-0000-0000-000000000001', 'MediQueue General Hospital', 'general-hospital', 'Global', 'Global')
ON CONFLICT (id) DO NOTHING;

-- 8. PERMISSIONS
-- ────────────────────────────────────────────────────────────

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;

-- 9. TRIGGERS
-- ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
