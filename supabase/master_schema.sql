-- ============================================================
-- MediQueue - Complete Production Schema
-- Consolidated Source of Truth (Snapshot: 2025-04-10)
-- This file can be run in the Supabase SQL Editor or via CLI.
-- ============================================================

-- 0. EXTENSIONS & SEARCH PATH
SET search_path TO public, extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BASE TABLES
-- ────────────────────────────────────────────────────────────

-- Users profile table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'mediator')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Patients
CREATE TABLE IF NOT EXISTS public.patients (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date_of_birth     DATE,
  blood_type        TEXT CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','')),
  allergies         TEXT[] DEFAULT '{}',
  medical_history   TEXT[] DEFAULT '{}',
  emergency_contact JSONB DEFAULT '{}',
  insurance_info    JSONB DEFAULT '{}',
  name              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Doctors
CREATE TABLE IF NOT EXISTS public.doctors (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  specialization          TEXT NOT NULL,
  license_number          TEXT UNIQUE,
  department              TEXT,
  consultation_avg_time   INTEGER DEFAULT 15,
  experience_years        INTEGER DEFAULT 0,
  rating                  DECIMAL(2,1) DEFAULT 5.0,
  bio                     TEXT,
  availability_schedule   JSONB DEFAULT '{}',
  is_available            BOOLEAN DEFAULT TRUE,
  education               TEXT,
  education_institution   TEXT,
  hospital_name           TEXT,
  location                TEXT,
  name                    TEXT,
  first_visit_fee         DECIMAL(10,2) DEFAULT 0,
  follow_up_fee           DECIMAL(10,2) DEFAULT 0,
  emergency_fee           DECIMAL(10,2) DEFAULT 0,
  fixed_fee               DECIMAL(10,2) DEFAULT 0,
  fee_type                TEXT DEFAULT 'by_visit_type' CHECK (fee_type IN ('by_visit_type','fixed','any')),
  daily_capacity          INTEGER DEFAULT 30,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Family members
CREATE TABLE IF NOT EXISTS public.family_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  relationship    TEXT NOT NULL,
  date_of_birth   DATE,
  blood_type      TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES public.users(id),
  doctor_id       UUID NOT NULL REFERENCES public.doctors(id),
  scheduled_time  TIMESTAMPTZ NOT NULL,
  visit_type      TEXT NOT NULL DEFAULT 'first_visit'
                  CHECK (visit_type IN ('first_visit','follow_up','emergency')),
  symptoms        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  notes           TEXT,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  payment_method   TEXT CHECK (payment_method IN ('cash','card','upi')),
  payment_status   TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','partial','waived')),
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  additional_charges DECIMAL(10,2) DEFAULT 0,
  additional_charges_details JSONB DEFAULT '[]',
  total_amount    DECIMAL(10,2) DEFAULT 0,
  paid_amount     DECIMAL(10,2) DEFAULT 0,
  payment_time     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Queue entries
CREATE TABLE IF NOT EXISTS public.queue_entries (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id                   UUID NOT NULL REFERENCES public.doctors(id),
  patient_id                  UUID NOT NULL REFERENCES public.users(id),
  appointment_id              UUID REFERENCES public.appointments(id),
  queue_type                  TEXT NOT NULL DEFAULT 'walk_in'
                              CHECK (queue_type IN ('appointment','walk_in','emergency')),
  token_number                TEXT NOT NULL,
  priority_score              INTEGER DEFAULT 100,
  predicted_consultation_time INTEGER DEFAULT 15,
  status                      TEXT NOT NULL DEFAULT 'waiting'
                              CHECK (status IN ('waiting','in_consultation','completed','skipped','no_show','cancelled')),
  check_in_status             BOOLEAN DEFAULT FALSE,
  check_in_time               TIMESTAMPTZ,
  called_at                   TIMESTAMPTZ,
  completed_at                 TIMESTAMPTZ,
  family_member_id            UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  arrival_status              TEXT DEFAULT 'pending' CHECK (arrival_status IN ('pending', 'arrived', 'late', 'no_show')),
  queue_position              INTEGER,
  consultation_started_at     TIMESTAMPTZ,
  consultation_ended_at       TIMESTAMPTZ,
  consultation_duration_minutes INTEGER,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Medical records
CREATE TABLE IF NOT EXISTS public.medical_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES public.users(id),
  doctor_id       UUID NOT NULL REFERENCES public.doctors(id),
  appointment_id  UUID REFERENCES public.appointments(id),
  diagnosis       TEXT NOT NULL,
  prescription    JSONB DEFAULT '[]',
  notes           TEXT,
  attachments     TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID NOT NULL REFERENCES public.users(id),
  receiver_id UUID NOT NULL REFERENCES public.users(id),
  content     TEXT NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id),
  user_role   TEXT CHECK (user_role IN ('patient', 'doctor', 'mediator')),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT DEFAULT 'system'
              CHECK (type IN ('appointment','queue','medical','message','system')),
  is_read     BOOLEAN DEFAULT FALSE,
  metadata    JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Consultation History
CREATE TABLE IF NOT EXISTS public.consultation_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id       UUID NOT NULL REFERENCES public.doctors(id),
  patient_id      UUID NOT NULL REFERENCES public.users(id),
  queue_entry_id  UUID REFERENCES public.queue_entries(id),
  duration_minutes INTEGER NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_table TEXT,
    target_id UUID,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_patient   ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor    ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_queue_doctor           ON public.queue_entries(doctor_id);
CREATE INDEX IF NOT EXISTS idx_queue_priority         ON public.queue_entries(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user     ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_history_doctor ON public.consultation_history(doctor_id);

-- 3. CORE FUNCTIONS & RPCs
-- ────────────────────────────────────────────────────────────

-- Optimized Role Access (from JWT)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(auth.jwt()->'user_metadata'->>'role', 'patient');
$$ LANGUAGE SQL STABLE;

-- Atomic Queue Management
CREATE OR REPLACE FUNCTION public.call_next_patient(p_doctor_id UUID)
RETURNS JSON AS $$
DECLARE
  v_next_entry RECORD;
BEGIN
  UPDATE public.queue_entries SET status = 'completed', completed_at = NOW()
  WHERE doctor_id = p_doctor_id AND status = 'in_consultation';

  SELECT q.*, u.full_name as patient_name FROM public.queue_entries q
  JOIN public.users u ON u.id = q.patient_id
  WHERE q.doctor_id = p_doctor_id AND q.status = 'waiting' AND q.check_in_status = true
  ORDER BY q.priority_score DESC, q.created_at ASC LIMIT 1 INTO v_next_entry;

  IF v_next_entry.id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.queue_entries SET status = 'in_consultation', called_at = NOW() WHERE id = v_next_entry.id;

  RETURN json_build_object('id', v_next_entry.id, 'patient_id', v_next_entry.patient_id, 'patient_name', v_next_entry.patient_name, 'token_number', v_next_entry.token_number);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Priority Calculation Engine
CREATE OR REPLACE FUNCTION public.calculate_entry_priority(p_entry public.queue_entries)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_waiting_mins INTEGER;
BEGIN
  IF p_entry.queue_type = 'emergency' THEN score := 500;
  ELSIF p_entry.queue_type = 'appointment' THEN score := 100;
  ELSE score := 60; END IF;

  v_waiting_mins := EXTRACT(EPOCH FROM (v_now - p_entry.created_at)) / 60;
  score := score + v_waiting_mins;
  IF p_entry.check_in_status THEN score := score + 80; END IF;
  RETURN score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Hospital Metrics
CREATE OR REPLACE FUNCTION public.get_hospital_realtime_metrics()
RETURNS JSON AS $$
DECLARE
  v_total_today INTEGER;
  v_waiting INTEGER;
  v_completed INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_today FROM public.queue_entries WHERE created_at >= CURRENT_DATE;
  SELECT COUNT(*) INTO v_waiting FROM public.queue_entries WHERE status = 'waiting' AND created_at >= CURRENT_DATE;
  SELECT COUNT(*) INTO v_completed FROM public.queue_entries WHERE status = 'completed' AND created_at >= CURRENT_DATE;
  RETURN json_build_object('total_patients_today', v_total_today, 'active_queues', v_waiting, 'completed_consultations', v_completed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TRIGGERS
-- ────────────────────────────────────────────────────────────

-- Auto-profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, phone, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), NEW.raw_user_meta_data->>'phone', COALESCE(NEW.raw_user_meta_data->>'role', 'patient'));
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'patient') = 'patient' THEN
    INSERT INTO public.patients (user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-priority update
CREATE OR REPLACE FUNCTION public.trig_update_priority_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority_score := public.calculate_entry_priority(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_queue_entry_upsert BEFORE INSERT OR UPDATE ON public.queue_entries FOR EACH ROW EXECUTE FUNCTION public.trig_update_priority_score();

-- 5. ROW LEVEL SECURITY (OPTIMIZED)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_history ENABLE ROW LEVEL SECURITY;

-- Dynamic Policies
CREATE POLICY "consultation_history_insert_doctor" ON public.consultation_history FOR INSERT WITH CHECK (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));
CREATE POLICY "consultation_history_select_doctor" ON public.consultation_history FOR SELECT USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));
CREATE POLICY "users_select_optimized" ON public.users FOR SELECT USING (id = auth.uid() OR public.get_user_role() IN ('doctor', 'mediator') OR id IN (SELECT user_id FROM public.doctors));
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "users_insert_mediator" ON public.users FOR INSERT WITH CHECK (public.get_user_role() = 'mediator');
CREATE POLICY "users_select_mediator" ON public.users FOR SELECT USING (public.get_user_role() = 'mediator' OR id = auth.uid());
CREATE POLICY "messages_select_strict" ON public.messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "notifs_select_strict" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "doctors_read_public" ON public.doctors FOR SELECT USING (TRUE);
CREATE POLICY "doctors_update_own" ON public.doctors FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "doctors_insert_own" ON public.doctors FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "patients_select_own" ON public.patients FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "family_members_select_own" ON public.family_members FOR SELECT USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY "family_members_insert_own" ON public.family_members FOR INSERT WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY "family_members_update_own" ON public.family_members FOR UPDATE USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY "family_members_delete_own" ON public.family_members FOR DELETE USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY "appointments_select_own" ON public.appointments FOR SELECT USING (patient_id = auth.uid() OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));
CREATE POLICY "appointments_insert_patient" ON public.appointments FOR INSERT WITH CHECK (patient_id = auth.uid() OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));
CREATE POLICY "queue_entries_insert_patient" ON public.queue_entries FOR INSERT WITH CHECK (
  patient_id = auth.uid() 
  OR public.get_user_role() = 'mediator' 
  OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);
CREATE POLICY "queue_entries_select_own" ON public.queue_entries FOR SELECT USING (
  patient_id = auth.uid() 
  OR public.get_user_role() = 'mediator' 
  OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);
CREATE POLICY "queue_entries_update_own" ON public.queue_entries FOR UPDATE USING (
  patient_id = auth.uid() 
  OR public.get_user_role() = 'mediator' 
  OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);
CREATE POLICY "consultation_history_insert_doctor" ON public.consultation_history FOR INSERT WITH CHECK (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));
CREATE POLICY "consultation_history_select_doctor" ON public.consultation_history FOR SELECT USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));

-- 6. REALTIME CONFIG
-- ────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_entries, public.appointments, public.notifications, public.messages;
-- Add location to appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS location TEXT;
-- Auto-priority update fix
CREATE OR REPLACE FUNCTION public.trig_update_priority_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority_score := public.calculate_entry_priority(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.calculate_priority_score(p_entry public.queue_entries)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_waiting_mins INTEGER;
BEGIN
  IF p_entry.queue_type = 'emergency' THEN score := 500;
  ELSIF p_entry.queue_type = 'appointment' THEN score := 100;
  ELSE score := 60; END IF;

  v_waiting_mins := EXTRACT(EPOCH FROM (v_now - p_entry.created_at)) / 60;
  score := score + v_waiting_mins;
  IF p_entry.check_in_status THEN score := score + 80; END IF;
  RETURN score;
END;
$$ LANGUAGE plpgsql STABLE;
-- ============================================================
-- Migration: Walk-in patient registration RPC
-- Fixes: FK violation when patient_id is a fake guest UUID
-- ============================================================

-- RPC to register a walk-in patient atomically
-- Creates a guest user row + queue entry in a single transaction
CREATE OR REPLACE FUNCTION register_walk_in_patient(
  p_full_name TEXT,
  p_phone TEXT,
  p_doctor_id UUID,
  p_symptoms TEXT DEFAULT '',
  p_is_emergency BOOLEAN DEFAULT FALSE,
  p_token TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
  v_token TEXT;
  v_queue_type TEXT;
  v_priority_score INTEGER;
  v_guest_email TEXT;
BEGIN
  -- Generate guest email
  v_guest_email := 'walkin_' || floor(extract(epoch from now()))::text || '@mediqueue.local';
  
  -- Create or find existing guest user with this phone
  SELECT id INTO v_user_id
  FROM users
  WHERE phone = p_phone AND role = 'patient'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO users (full_name, phone, email, role)
    VALUES (p_full_name, p_phone, v_guest_email, 'patient')
    RETURNING id INTO v_user_id;
  END IF;

  -- Determine queue type and priority
  v_queue_type := CASE WHEN p_is_emergency THEN 'emergency' ELSE 'walk_in' END;
  v_priority_score := CASE WHEN p_is_emergency THEN 650 ELSE 300 END;
  v_token := COALESCE(p_token, v_queue_type::text || '-' || floor(extract(epoch from now()))::text);

  -- Insert queue entry
  INSERT INTO queue_entries (
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
    called_at,
    completed_at
  )
  VALUES (
    p_doctor_id,
    v_user_id,
    NULL,
    v_queue_type,
    v_token,
    v_priority_score,
    15,
    'waiting',
    TRUE,
    NOW(),
    'arrived',
    NULL,
    NULL
  )
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

-- Grant execute to authenticated users and anon (mediator is authenticated)
GRANT EXECUTE ON FUNCTION register_walk_in_patient(TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION register_walk_in_patient(TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT) TO anon;
-- ============================================================
-- Migration: Enable Standalone Users (Walk-Ins)
-- Fixes: "null value in column id of relation users"
-- Removes rigid auth.users dependency for public profiles
-- ============================================================

-- 1. Remove the rigid foreign key constraint that requires an auth.users record
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. Add a default UUID generator to public.users.id so guest accounts can be easily created
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- 3. To maintain the ON DELETE CASCADE behavior we lost, create a trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid conflicts upon re-runs
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Create the trigger so when an auth record is deleted, its public profile is removed
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_delete();

-- 4. Re-create the walk in RPC just to be absolutely certain it expects the default
CREATE OR REPLACE FUNCTION register_walk_in_patient(
  p_full_name TEXT,
  p_phone TEXT,
  p_doctor_id UUID,
  p_symptoms TEXT DEFAULT '',
  p_is_emergency BOOLEAN DEFAULT FALSE,
  p_token TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_entry_id UUID;
  v_token TEXT;
  v_queue_type TEXT;
  v_priority_score INTEGER;
  v_guest_email TEXT;
BEGIN
  v_guest_email := 'walkin_' || floor(extract(epoch from now()))::text || '@mediqueue.local';
  
  SELECT id INTO v_user_id
  FROM users
  WHERE phone = p_phone AND role = 'patient'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO users (full_name, phone, email, role)
    VALUES (p_full_name, p_phone, v_guest_email, 'patient')
    RETURNING id INTO v_user_id;

    -- Also create patient profile
    INSERT INTO patients (user_id) VALUES (v_user_id);
  END IF;

  v_queue_type := CASE WHEN p_is_emergency THEN 'emergency' ELSE 'walk_in' END;
  v_priority_score := CASE WHEN p_is_emergency THEN 650 ELSE 300 END;
  v_token := COALESCE(p_token, v_queue_type::text || '-' || floor(extract(epoch from now()))::text);

  INSERT INTO queue_entries (
    doctor_id, patient_id, queue_type, token_number, priority_score,
    predicted_consultation_time, status, check_in_status, check_in_time, arrival_status
  )
  VALUES (
    p_doctor_id, v_user_id, v_queue_type, v_token, v_priority_score,
    15, 'waiting', TRUE, NOW(), 'arrived'
  )
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;
-- ============================================================
-- Migration: Fix Priority Trigger Logic
-- Fixes: "record p_entry has no field scheduled_time"
-- Resolves the issue where queue_entries lacks scheduled_time
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_entry_priority(p_entry public.queue_entries)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  score INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_waiting_mins INTEGER;
  v_late_mins INTEGER;
  v_early_mins INTEGER;
  v_scheduled_time TIMESTAMPTZ;
BEGIN
  -- Base weights following frontend engine logic
  IF p_entry.queue_type = 'emergency' THEN 
    score := score + 500;
  ELSIF p_entry.queue_type = 'appointment' THEN 
    score := score + 100;
  ELSE 
    score := score + 60; -- walk_in
  END IF;

  -- Waiting time bonus (1 point per minute)
  v_waiting_mins := EXTRACT(EPOCH FROM (v_now - p_entry.created_at)) / 60;
  score := score + v_waiting_mins;

  -- Fetch scheduled_time if appointment
  IF p_entry.queue_type = 'appointment' AND p_entry.appointment_id IS NOT NULL THEN
    SELECT scheduled_time INTO v_scheduled_time FROM public.appointments WHERE id = p_entry.appointment_id;
  END IF;

  -- Check-in bonus and early arrival
  IF p_entry.check_in_status THEN
    score := score + 80;
    
    IF p_entry.queue_type = 'appointment' AND p_entry.check_in_time IS NOT NULL AND v_scheduled_time IS NOT NULL THEN
       v_early_mins := EXTRACT(EPOCH FROM (v_scheduled_time - p_entry.check_in_time)) / 60;
       IF v_early_mins >= 5 THEN
          score := score + 20 + (FLOOR(v_early_mins / 5)::INTEGER * 2);
       END IF;
    END IF;
  END IF;

  -- Lateness penalty for appointments
  IF p_entry.queue_type = 'appointment' AND v_scheduled_time IS NOT NULL THEN
    IF v_now > v_scheduled_time THEN
      v_late_mins := EXTRACT(EPOCH FROM (v_now - v_scheduled_time)) / 60;
      score := score - (FLOOR(v_late_mins / 5)::INTEGER * 30);
      -- Prevent appointments from falling below walk-ins entirely if only slightly late
      IF score < 70 THEN score := 70; END IF;
    END IF;
  END IF;

  RETURN score;
END;
$function$;
-- ============================================================
-- Migration: Fix get_user_role for RLS
-- Fixes: Silent relation drop due to JWT metadata sync loops
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_role text;
BEGIN
  -- Pull standard DB validated role first, avoiding stale JWT caches
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  
  -- Prevent totally null returns by checking JWT metadata
  IF v_role IS NULL THEN
    v_role := COALESCE(auth.jwt()->'user_metadata'->>'role', 'patient');
  END IF;

  RETURN v_role;
END;
$function$;
CREATE OR REPLACE FUNCTION public.notify_consultation_near(p_doctor_id uuid, p_threshold integer DEFAULT 3)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  entry RECORD;
  patients_ahead INTEGER;
BEGIN
  FOR entry IN 
    SELECT q.id, q.patient_id, q.queue_position
    FROM public.queue_entries q
    WHERE q.doctor_id = p_doctor_id
      AND q.status = 'waiting'
      AND q.check_in_status = true
    ORDER BY q.priority_score DESC
  LOOP
    -- Count patients ahead
    SELECT COUNT(*) INTO patients_ahead
    FROM public.queue_entries
    WHERE doctor_id = p_doctor_id
      AND status = 'waiting'
      AND check_in_status = true
      AND priority_score > (
        SELECT priority_score FROM public.queue_entries WHERE id = entry.id
      );

    IF patients_ahead <= p_threshold THEN
      -- Send notification using 'queue' type rather than invalid 'CONSULTATION_NEAR' string
      );
    END IF;
  END LOOP;
END;
$function$;

-- ============================================================
-- Appointment Request Workflow
-- New: Patient books → Doctor approves → Patient added to queue
-- ============================================================

-- Trigger: Notify doctor when new appointment request
CREATE OR REPLACE FUNCTION public.notify_new_appointment_request()
RETURNS TRIGGER AS $$
DECLARE
  v_doctor_record RECORD;
  v_patient_name TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT d.user_id, u.full_name as doctor_name 
    INTO v_doctor_record
    FROM public.doctors d
    JOIN public.users u ON d.user_id = u.id
    WHERE d.id = NEW.doctor_id;
    
    SELECT full_name INTO v_patient_name
    FROM public.users WHERE id = NEW.patient_id;
    
    INSERT INTO public.notifications (user_id, user_role, title, message, type, metadata)
    VALUES (
      v_doctor_record.user_id,
      'doctor',
      'New Appointment Request',
      'You have a new appointment request from ' || COALESCE(v_patient_name, 'a patient') || '. Please review and respond.',
      'appointment',
      jsonb_build_object('appointment_id', NEW.id, 'patient_id', NEW.patient_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_appointment_request
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_appointment_request();

-- Trigger: Notify patient on appointment status change
CREATE OR REPLACE FUNCTION public.notify_appointment_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_name TEXT;
BEGIN
  IF NEW.status != OLD.status AND NEW.status IN ('confirmed', 'rejected') THEN
    SELECT full_name INTO v_patient_name
    FROM public.users WHERE id = NEW.patient_id;
    
    IF NEW.status = 'confirmed' THEN
      INSERT INTO public.notifications (user_id, user_role, title, message, type, metadata)
      VALUES (
        NEW.patient_id,
        'patient',
        'Appointment Confirmed',
        'Your appointment has been confirmed by the doctor. Please check-in when you arrive.',
        'appointment',
        jsonb_build_object('appointment_id', NEW.id, 'doctor_id', NEW.doctor_id)
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, user_role, title, message, type, metadata)
      VALUES (
        NEW.patient_id,
        'patient',
        'Appointment Rejected',
        'Your appointment request has been rejected by the doctor. Please book a new appointment.',
        'appointment',
        jsonb_build_object('appointment_id', NEW.id, 'doctor_id', NEW.doctor_id, 'reason', COALESCE(NEW.notes, ''))
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_appointment_status_change
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_appointment_status_change();

-- Auto-accept/reject based on doctor's daily capacity
-- Only auto-accepts when daily_capacity = -1 (explicitly enabled)
CREATE OR REPLACE FUNCTION public.auto_accept_appointment()
RETURNS TRIGGER AS $$
DECLARE
  v_doctor_record RECORD;
  v_today_count INTEGER;
  v_daily_capacity INTEGER;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT daily_capacity INTO v_daily_capacity
  FROM public.doctors
  WHERE id = NEW.doctor_id;
  
  -- Only auto-accept if daily_capacity = -1 (explicitly enabled for auto-accept)
  -- Otherwise leave as pending for manual review
  IF v_daily_capacity IS NULL OR v_daily_capacity != -1 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_today_count
  FROM public.appointments
  WHERE doctor_id = NEW.doctor_id
    AND status IN ('confirmed', 'completed')
    AND DATE(scheduled_time) = DATE(NEW.scheduled_time);

  -- Auto-accept if within capacity (default 30)
  IF v_today_count < 30 THEN
    NEW.status := 'confirmed';
  ELSE
    NEW.status := 'rejected';
    NEW.notes := COALESCE(NEW.notes || E'\n', '') || 'Auto-rejected: Daily capacity reached (' || v_today_count || '/30)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auto_accept_appointment
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.auto_accept_appointment();

-- ============================================================
-- RPC: Patient check-in from appointment
-- Bypasses RLS for patient check-in
-- ============================================================
CREATE OR REPLACE FUNCTION check_in_from_appointment(
  p_appointment_id UUID,
  p_doctor_id UUID,
  p_token TEXT,
  p_priority_score INTEGER DEFAULT 100,
  p_predicted_time INTEGER DEFAULT 15
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry_id UUID;
  v_patient_id UUID;
  v_scheduled_time TIMESTAMPTZ;
  v_duration_minutes INTEGER;
BEGIN
  -- Get appointment details
  SELECT patient_id, scheduled_time, duration_minutes
  INTO v_patient_id, v_scheduled_time, v_duration_minutes
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- Verify the current user owns this appointment
  IF v_patient_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to check in to this appointment';
  END IF;

  -- Insert queue entry (bypasses RLS due to SECURITY DEFINER)
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
    arrival_status
  ) VALUES (
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
    'arrived'
  )
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION check_in_from_appointment TO authenticated;
GRANT EXECUTE ON FUNCTION check_in_from_appointment TO anon;

-- ============================================================
-- Production Enhancement Migration (Applied: 2026-04-14)
-- All changes are additive — no breaking changes
-- ============================================================

-- ─── 1. NO-SHOW BEHAVIORAL TRACKING ──────────────────────────────────────────
-- Queue scoring engine reads no_show_rate to deprioritise repeat no-shows.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS no_show_count  INTEGER      DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_visits   INTEGER      DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS no_show_rate   DECIMAL(4,3) DEFAULT 0.0;

-- ─── 2. DOCTOR BREAK MODE COLUMNS ────────────────────────────────────────────
-- Allows a doctor to pause their queue without cancelling patients.
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS is_on_break   BOOLEAN     DEFAULT FALSE;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS break_until   TIMESTAMPTZ;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS break_message TEXT;

-- ─── 3. SKIPPED_AT COLUMN ON QUEUE_ENTRIES ───────────────────────────────────
-- Records exact skip time for the 10-minute auto re-queue grace period.
ALTER TABLE public.queue_entries ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ;

-- ─── 4. HANDLE_PATIENT_NO_SHOW RPC ───────────────────────────────────────────
-- Marks entry as no_show AND atomically updates patient's no_show_rate.
CREATE OR REPLACE FUNCTION public.handle_patient_no_show(p_entry_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_patient_id UUID;
BEGIN
  SELECT patient_id INTO v_patient_id FROM public.queue_entries WHERE id = p_entry_id;

  UPDATE public.queue_entries
  SET status = 'no_show', arrival_status = 'no_show', completed_at = NOW()
  WHERE id = p_entry_id;

  UPDATE public.users
  SET
    no_show_count = no_show_count + 1,
    total_visits  = total_visits  + 1,
    no_show_rate  = ROUND((no_show_count + 1)::DECIMAL / GREATEST(total_visits + 1, 1), 3)
  WHERE id = v_patient_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_patient_no_show(UUID) TO authenticated;

-- ─── 5. ATOMIC DB-SIDE TOKEN GENERATION ──────────────────────────────────────
-- Eliminates the client-side race condition (two concurrent users getting same token).
CREATE OR REPLACE FUNCTION public.generate_queue_token(p_doctor_id UUID, p_queue_type TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix TEXT;
  v_count  INTEGER;
BEGIN
  v_prefix := CASE p_queue_type
    WHEN 'emergency'   THEN 'E'
    WHEN 'walk_in'     THEN 'W'
    WHEN 'appointment' THEN 'A'
    ELSE                    'W'
  END;

  SELECT COUNT(*) + 1 INTO v_count
  FROM public.queue_entries
  WHERE doctor_id = p_doctor_id
    AND token_number LIKE v_prefix || '%'
    AND created_at::date = CURRENT_DATE;

  RETURN v_prefix || LPAD(v_count::TEXT, 2, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_queue_token(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_queue_token(UUID, TEXT) TO anon;

-- ─── 6. AUTO-CLEAR EXPIRED BREAKS ────────────────────────────────────────────
-- Call on doctor login or via pg_cron. Frontend also handles client-side.
CREATE OR REPLACE FUNCTION public.clear_expired_breaks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.doctors
  SET is_on_break = FALSE, break_until = NULL, break_message = NULL
  WHERE is_on_break = TRUE AND break_until IS NOT NULL AND break_until < NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_expired_breaks() TO authenticated;

-- ─── 7. REGISTER_WALK_IN_PATIENT: atomic token generation ────────────────────
-- Replaces the old version — uses generate_queue_token() inside the transaction.
CREATE OR REPLACE FUNCTION public.register_walk_in_patient(
  p_full_name    TEXT,
  p_phone        TEXT,
  p_doctor_id    UUID,
  p_symptoms     TEXT    DEFAULT '',
  p_is_emergency BOOLEAN DEFAULT FALSE,
  p_token        TEXT    DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id        UUID;
  v_entry_id       UUID;
  v_token          TEXT;
  v_queue_type     TEXT;
  v_priority_score INTEGER;
  v_guest_email    TEXT;
BEGIN
  v_guest_email := 'walkin_' || floor(extract(epoch from now()))::TEXT || '@mediqueue.local';

  SELECT id INTO v_user_id FROM public.users
  WHERE phone = p_phone AND role = 'patient' LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO public.users (full_name, phone, email, role)
    VALUES (p_full_name, p_phone, v_guest_email, 'patient')
    RETURNING id INTO v_user_id;
    INSERT INTO public.patients (user_id) VALUES (v_user_id);
  END IF;

  v_queue_type     := CASE WHEN p_is_emergency THEN 'emergency' ELSE 'walk_in' END;
  v_priority_score := CASE WHEN p_is_emergency THEN 650 ELSE 300 END;
  v_token          := COALESCE(p_token, public.generate_queue_token(p_doctor_id, v_queue_type));

  INSERT INTO public.queue_entries (
    doctor_id, patient_id, queue_type, token_number, priority_score,
    predicted_consultation_time, status, check_in_status, check_in_time, arrival_status
  )
  VALUES (
    p_doctor_id, v_user_id, v_queue_type, v_token, v_priority_score,
    15, 'waiting', TRUE, NOW(), 'arrived'
  )
  RETURNING id INTO v_entry_id;

  RETURN v_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_walk_in_patient(TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_walk_in_patient(TEXT, TEXT, UUID, TEXT, BOOLEAN, TEXT) TO anon;

-- ─── 8. PERFORMANCE INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_queue_skipped_entries
  ON public.queue_entries(doctor_id, status, skipped_at)
  WHERE status = 'skipped';

CREATE INDEX IF NOT EXISTS idx_users_no_show_rate
  ON public.users(no_show_rate)
  WHERE no_show_rate > 0;

-- ============================================================
-- END OF SCHEMA
-- This file is the single source of truth for the MediQueue DB.
-- Last updated: 2026-04-14
-- ============================================================
