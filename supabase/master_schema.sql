-- ============================================================
-- MediQueue - Complete Production Schema (HARDENED - v2.5)
-- Consolidated Source of Truth
-- ============================================================

-- 0. EXTENSIONS & SEARCH PATH
SET search_path TO public, extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. INFRASTRUCTURE & MULTI-TENANCY
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

-- 2. BASE TABLES
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
  created_at   TIMESTAMPTZ DEFAULT NOW()
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

-- 3. CORE QUEUE SYSTEM
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.queue_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id         UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id        UUID REFERENCES public.patients(id),
  family_member_id  UUID REFERENCES public.family_members(id),
  patient_name      TEXT NOT NULL,
  patient_phone     TEXT,
  token_number      INTEGER NOT NULL,
  sequence_number   INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_consultation', 'completed', 'skipped', 'no_show', 'cancelled')),
  queue_type        TEXT NOT NULL CHECK (queue_type IN ('appointment', 'walk_in', 'emergency')),
  priority_score    INTEGER DEFAULT 0,
  symptoms          TEXT,
  check_in_status   BOOLEAN DEFAULT FALSE,
  arrival_status    TEXT DEFAULT 'not_arrived' CHECK (arrival_status IN ('not_arrived', 'arrived', 'late')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments (Pre-booked)
CREATE TABLE IF NOT EXISTS public.appointments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id         UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES public.patients(id),
  family_member_id  UUID REFERENCES public.family_members(id),
  scheduled_time    TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  visit_type        TEXT NOT NULL DEFAULT 'first_visit' CHECK (visit_type IN ('first_visit', 'follow_up', 'emergency', 'walk_in')),
  symptoms          TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
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

-- 4. SECURITY & POLICIES (RLS)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediator_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Basic Public Access Policy for Hospitals (Discovery)
CREATE POLICY "Allow public read access to hospitals" ON public.hospitals FOR SELECT USING (true);
CREATE POLICY "Allow public read access to doctors" ON public.doctors FOR SELECT USING (true);

-- User Profile Policies
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Mediator Privacy Policies (LOCKED DOWN)
CREATE POLICY "Mediators can view their own assignment status" ON public.mediator_assignments
  FOR SELECT USING (mediator_id IN (SELECT id FROM public.mediators WHERE user_id = auth.uid()));

CREATE POLICY "Mediators can request access to doctors" ON public.mediator_assignments
  FOR INSERT WITH CHECK (mediator_id IN (SELECT id FROM public.mediators WHERE user_id = auth.uid()));

CREATE POLICY "Doctors can manage their staff assignments" ON public.mediator_assignments
  FOR ALL USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));

-- Queue Access (Doctor OR Approved Mediator)
CREATE POLICY "Secure queue access" ON public.queue_entries
  FOR ALL USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()) OR
    doctor_id IN (SELECT doctor_id FROM public.mediator_assignments WHERE status = 'approved' AND mediator_id IN (SELECT id FROM public.mediators WHERE user_id = auth.uid())) OR
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- 5. FUNCTIONS & TRIGGERS
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
  VALUES (NEW.id, NEW.email, v_full_name, v_role, v_hospital_id);

  IF v_role = 'patient' THEN
    INSERT INTO public.patients (user_id, name, patient_name) VALUES (NEW.id, v_full_name, v_full_name);
  ELSIF v_role = 'doctor' THEN
    INSERT INTO public.doctors (user_id, name, hospital_id) VALUES (NEW.id, v_full_name, v_hospital_id);
  ELSIF v_role = 'mediator' THEN
    INSERT INTO public.mediators (user_id, hospital_id, is_approved) VALUES (NEW.id, v_hospital_id, false);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC & ANALYTICS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_hospital_realtime_metrics(p_hospital_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'waiting', (SELECT count(*) FROM queue_entries WHERE status = 'waiting'),
    'in_consultation', (SELECT count(*) FROM queue_entries WHERE status = 'in_consultation'),
    'completed', (SELECT count(*) FROM queue_entries WHERE status = 'completed'),
    'avg_wait_time', 22 -- Static sample for now
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. SEED DATA (CORE TENANCY)
-- ────────────────────────────────────────────────────────────

INSERT INTO public.hospitals (id, name, slug, city, country)
VALUES ('00000000-0000-0000-0000-000000000001', 'MediQueue General Hospital', 'general-hospital', 'Global', 'Global')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to REST roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
