-- Trigger for new appointment request notification

CREATE OR REPLACE FUNCTION public.notify_new_appointment_request()
RETURNS TRIGGER AS $$
DECLARE
  v_doctor_record RECORD;
  v_patient_name TEXT;
BEGIN
  -- Only trigger when status is pending
  IF NEW.status = 'pending' THEN
    -- Get doctor info
    SELECT d.user_id, u.full_name as doctor_name 
    INTO v_doctor_record
    FROM public.doctors d
    JOIN public.users u ON d.user_id = u.id
    WHERE d.id = NEW.doctor_id;
    
    -- Get patient name
    SELECT full_name INTO v_patient_name
    FROM public.users WHERE id = NEW.patient_id;
    
    -- Insert notification for doctor
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

DROP TRIGGER IF EXISTS on_new_appointment_request ON public.appointments;
CREATE TRIGGER on_new_appointment_request
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_appointment_request();

GRANT EXECUTE ON FUNCTION public.notify_new_appointment_request() TO authenticated;