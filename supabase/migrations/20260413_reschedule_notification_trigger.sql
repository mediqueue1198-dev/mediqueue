-- Trigger for reschedule notification

CREATE OR REPLACE FUNCTION public.notify_appointment_reschedule()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_name TEXT;
  v_old_date TEXT;
  v_new_date TEXT;
BEGIN
  -- Notify when scheduled_time changes
  IF OLD.scheduled_time != NEW.scheduled_time AND NEW.status IN ('confirmed', 'pending') THEN
    SELECT full_name INTO v_patient_name
    FROM public.users WHERE id = NEW.patient_id;
    
    v_old_date := TO_CHAR(OLD.scheduled_time, 'FMMonth DD, YYYY FMHH12:MI AM');
    v_new_date := TO_CHAR(NEW.scheduled_time, 'FMMonth DD, YYYY FMHH12:MI AM');
    
    INSERT INTO public.notifications (user_id, user_role, title, message, type, metadata)
    VALUES (
      NEW.patient_id,
      'patient',
      'Appointment Rescheduled',
      'Your appointment has been rescheduled from ' || v_old_date || ' to ' || v_new_date || '.',
      'appointment',
      jsonb_build_object('appointment_id', NEW.id, 'doctor_id', NEW.doctor_id, 'old_time', OLD.scheduled_time, 'new_time', NEW.scheduled_time)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_appointment_reschedule ON public.appointments;
CREATE TRIGGER on_appointment_reschedule
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_appointment_reschedule();

GRANT EXECUTE ON FUNCTION public.notify_appointment_reschedule() TO authenticated;