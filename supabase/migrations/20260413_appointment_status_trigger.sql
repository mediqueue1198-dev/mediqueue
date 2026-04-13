-- Trigger for appointment status change notifications

CREATE OR REPLACE FUNCTION public.notify_appointment_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_patient_name TEXT;
BEGIN
  -- Notify patient when status changes to confirmed or rejected
  IF NEW.status != OLD.status AND NEW.status IN ('confirmed', 'rejected') THEN
    -- Get patient name
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

DROP TRIGGER IF EXISTS on_appointment_status_change ON public.appointments;
CREATE TRIGGER on_appointment_status_change
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_appointment_status_change();

GRANT EXECUTE ON FUNCTION public.notify_appointment_status_change() TO authenticated;