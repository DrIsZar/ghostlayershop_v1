-- Auto-archive expired pools migration
-- This migration updates the fn_refresh_pool_status function to automatically archive expired pools

-- Function to refresh pool status (overdue/expired) and auto-archive expired pools
CREATE OR REPLACE FUNCTION public.fn_refresh_pool_status() 
RETURNS void AS $$
BEGIN
  UPDATE public.resource_pools
  SET status = CASE
    WHEN now() >= end_at THEN 'expired'
    WHEN now() >= end_at - interval '1 day' THEN 'overdue'
    ELSE 'active'
  END,
  is_alive = CASE
    WHEN now() >= end_at THEN false  -- Auto-archive expired pools
    ELSE is_alive
  END,
  updated_at = now()
  WHERE status IN ('active', 'overdue');
END;
$$ LANGUAGE sql;
