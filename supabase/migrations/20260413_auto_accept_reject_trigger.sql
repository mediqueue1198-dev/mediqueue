-- Auto-accept/reject based on daily capacity

CREATE OR REPLACE FUNCTION public.auto_accept_appointment()
RETURNS TRIGGER AS $$
DECLARE
  v_doctor_record RECORD;
  v_today_count INTEGER;
  v_daily_capacity INTEGER;
BEGIN
  -- Only process pending appointments
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Get doctor's daily capacity
  SELECT daily_capacity INTO v_daily_capacity
  FROM public.doctors
  WHERE id = NEW.doctor_id;
  
  -- If no daily capacity set, leave as pending for manual review
  IF v_daily_capacity IS NULL OR v_daily_capacity = 0 THEN
    RETURN NEW;
  END IF;

  -- Count appointments for today for this doctor
  SELECT COUNT(*) INTO v_today_count
  FROM public.appointments
  WHERE doctor_id = NEW.doctor_id
    AND status IN ('confirmed', 'completed')
    AND DATE(scheduled_time) = DATE(NEW.scheduled_time);

  -- Auto-accept if within capacity, auto-reject if over
  IF v_today_count < v_daily_capacity THEN
    NEW.status := 'confirmed';
  ELSE
    NEW.status := 'rejected';
    NEW.notes := COALESCE(NEW.notes || E'\n', '') || 'Auto-rejected: Daily capacity reached (' || v_today_count || '/' || v_daily_capacity || ')';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auto_accept_appointment ON public.appointments;
CREATE TRIGGER on_auto_accept_appointment
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.auto_accept_appointment();

GRANT EXECUTE ON FUNCTION public.auto_accept_appointment() TO authenticated;