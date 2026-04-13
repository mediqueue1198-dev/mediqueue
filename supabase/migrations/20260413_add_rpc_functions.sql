-- Add missing RPC functions

-- handle_patient_no_show
CREATE OR REPLACE FUNCTION public.handle_patient_no_show(p_entry_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.queue_entries 
  SET status = 'no_show', arrival_status = 'no_show'
  WHERE id = p_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_patient_no_show(UUID) TO authenticated;

-- get_doctor_capacity
CREATE OR REPLACE FUNCTION public.get_doctor_capacity(p_doctor_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_completed INTEGER;
  v_remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.queue_entries 
  WHERE doctor_id = p_doctor_id AND created_at >= CURRENT_DATE;
  
  SELECT COUNT(*) INTO v_completed FROM public.queue_entries 
  WHERE doctor_id = p_doctor_id AND status = 'completed' AND created_at >= CURRENT_DATE;
  
  v_remaining := v_total - v_completed;
  
  RETURN json_build_object('total', v_total, 'completed', v_completed, 'remaining', v_remaining);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_doctor_capacity(UUID) TO authenticated;

-- send_notification
CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id UUID,
  p_user_role TEXT,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'system',
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, user_role, title, message, type, metadata)
  VALUES (p_user_id, p_user_role, p_title, p_message, p_type, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;