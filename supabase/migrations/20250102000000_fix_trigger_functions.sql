-- Fix trigger function calls in RPC functions
-- The issue was that trigger functions were being called directly from RPC functions,
-- which is not allowed in PostgreSQL

-- Fix assign_next_free_seat function
CREATE OR REPLACE FUNCTION public.assign_next_free_seat(
  p_pool_id uuid,
  p_email text,
  p_client_id uuid,
  p_subscription_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_seat_id uuid;
BEGIN
  -- Find and lock the next available seat
  SELECT id INTO v_seat_id 
  FROM public.resource_pool_seats
  WHERE pool_id = p_pool_id 
    AND seat_status = 'available'
  ORDER BY seat_index ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  -- If no seat found, raise exception
  IF v_seat_id IS NULL THEN
    RAISE EXCEPTION 'No available seats in pool %', p_pool_id USING errcode = 'P0001';
  END IF;

  -- Assign the seat
  UPDATE public.resource_pool_seats
  SET 
    seat_status = 'assigned',
    assigned_email = p_email,
    assigned_client_id = p_client_id,
    assigned_subscription_id = p_subscription_id,
    assigned_at = now(),
    unassigned_at = null,
    updated_at = now()
  WHERE id = v_seat_id;

  -- Note: used_seats sync is handled automatically by triggers
  
  RETURN v_seat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix unassign_seat function
CREATE OR REPLACE FUNCTION public.unassign_seat(
  p_seat_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE public.resource_pool_seats
  SET 
    seat_status = 'available',
    assigned_email = null,
    assigned_client_id = null,
    assigned_subscription_id = null,
    unassigned_at = now(),
    updated_at = now()
  WHERE id = p_seat_id;
  
  -- Note: used_seats sync is handled automatically by triggers
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
