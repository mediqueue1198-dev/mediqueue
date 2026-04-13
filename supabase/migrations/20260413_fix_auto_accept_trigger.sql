-- Fix auto-accept trigger to only auto-accept when daily_capacity = -1 (explicitly enabled)

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
  
  -- Only auto-accept if daily_capacity = -1 (explicitly enabled for auto-accept)
  -- Otherwise leave as pending for manual review
  IF v_daily_capacity IS NULL OR v_daily_capacity != -1 THEN
    RETURN NEW;
  END IF;

  -- If auto-accept enabled, count today's appointments
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

DROP TRIGGER IF EXISTS on_auto_accept_appointment ON public.appointments;
CREATE TRIGGER on_auto_accept_appointment
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.auto_accept_appointment();