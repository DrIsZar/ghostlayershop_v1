-- Auto-complete expired subscriptions migration
-- This migration adds automatic completion of subscriptions when their target_end_at date is reached

-- Function to automatically complete expired subscriptions
CREATE OR REPLACE FUNCTION public.fn_auto_complete_expired_subscriptions() 
RETURNS integer AS $$
DECLARE
  v_completed_count integer := 0;
BEGIN
  -- Update subscriptions that have reached their target end date
  UPDATE public.subscriptions
  SET 
    status = 'completed',
    next_renewal_at = null,
    updated_at = now()
  WHERE status = 'active' 
    AND target_end_at IS NOT NULL 
    AND now() >= target_end_at;
    
  -- Get the count of updated rows
  GET DIAGNOSTICS v_completed_count = ROW_COUNT;
    
  -- Log the completion events for subscriptions that were just completed
  INSERT INTO public.subscription_events (subscription_id, type, at, meta)
  SELECT 
    id,
    'completed',
    now(),
    jsonb_build_object(
      'auto_completed', true,
      'target_end_at', target_end_at,
      'completed_at', now()
    )
  FROM public.subscriptions
  WHERE status = 'completed' 
    AND updated_at = now()
    AND target_end_at IS NOT NULL;
    
  RETURN v_completed_count;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to automatically complete subscriptions when target_end_at is reached
CREATE OR REPLACE FUNCTION public.fn_check_subscription_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the subscription should be automatically completed
  IF NEW.target_end_at IS NOT NULL 
     AND NEW.status = 'active' 
     AND now() >= NEW.target_end_at THEN
    NEW.status := 'completed';
    NEW.next_renewal_at := null;
    NEW.updated_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic completion on insert/update
DROP TRIGGER IF EXISTS trg_auto_complete_subscription ON public.subscriptions;
CREATE TRIGGER trg_auto_complete_subscription
  BEFORE INSERT OR UPDATE OF target_end_at, status ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.fn_check_subscription_completion();

-- Create a scheduled function to run periodically (this would typically be called by a cron job)
-- For now, we'll create a function that can be called manually or by the application
CREATE OR REPLACE FUNCTION public.refresh_subscription_status() 
RETURNS TABLE(completed_count integer, overdue_count integer) AS $$
DECLARE
  v_completed_count integer := 0;
  v_overdue_count integer := 0;
BEGIN
  -- Auto-complete expired subscriptions
  SELECT public.fn_auto_complete_expired_subscriptions() INTO v_completed_count;
  
  -- Mark overdue subscriptions (past next_renewal_at but not completed)
  UPDATE public.subscriptions
  SET 
    status = 'overdue',
    updated_at = now()
  WHERE status = 'active' 
    AND next_renewal_at IS NOT NULL 
    AND now() > next_renewal_at;
    
  GET DIAGNOSTICS v_overdue_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_completed_count, v_overdue_count;
END;
$$ LANGUAGE plpgsql;
