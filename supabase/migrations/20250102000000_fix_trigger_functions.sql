-- Fix trigger function calls in RPC functions and add bidirectional sync
-- The issue was that trigger functions were being called directly from RPC functions,
-- which is not allowed in PostgreSQL. Also adds bidirectional sync between subscriptions and pool seats.

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

  -- If a subscription is being assigned, also update the subscription to link it to this pool and seat
  IF p_subscription_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET 
      resource_pool_id = p_pool_id,
      resource_pool_seat_id = v_seat_id,
      updated_at = now()
    WHERE id = p_subscription_id;
  END IF;

  -- Note: used_seats sync is handled automatically by triggers
  
  RETURN v_seat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix unassign_seat function with bidirectional sync
CREATE OR REPLACE FUNCTION public.unassign_seat(
  p_seat_id uuid
)
RETURNS void AS $$
DECLARE
  v_subscription_id uuid;
BEGIN
  -- Get the subscription ID before unassigning
  SELECT assigned_subscription_id INTO v_subscription_id
  FROM public.resource_pool_seats
  WHERE id = p_seat_id;

  -- Unassign the seat
  UPDATE public.resource_pool_seats
  SET 
    seat_status = 'available',
    assigned_email = null,
    assigned_client_id = null,
    assigned_subscription_id = null,
    unassigned_at = now(),
    updated_at = now()
  WHERE id = p_seat_id;

  -- If there was a subscription assigned, also unlink it from the pool and seat
  IF v_subscription_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET 
      resource_pool_id = null,
      resource_pool_seat_id = null,
      updated_at = now()
    WHERE id = v_subscription_id;
  END IF;
  
  -- Note: used_seats sync is handled automatically by triggers
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to ensure subscription updates also update seat assignments
CREATE OR REPLACE FUNCTION public.fn_sync_subscription_seat_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- If subscription is being linked to a pool and seat
  IF NEW.resource_pool_id IS NOT NULL AND NEW.resource_pool_seat_id IS NOT NULL THEN
    -- Update the seat to reflect the subscription assignment
    UPDATE public.resource_pool_seats
    SET 
      assigned_subscription_id = NEW.id,
      seat_status = 'assigned',
      assigned_at = COALESCE(assigned_at, now()),
      updated_at = now()
    WHERE id = NEW.resource_pool_seat_id;
  END IF;

  -- If subscription is being unlinked from pool and seat
  IF (OLD.resource_pool_id IS NOT NULL OR OLD.resource_pool_seat_id IS NOT NULL) AND 
     (NEW.resource_pool_id IS NULL AND NEW.resource_pool_seat_id IS NULL) THEN
    -- Unassign the seat if it was linked to this subscription
    UPDATE public.resource_pool_seats
    SET 
      assigned_subscription_id = null,
      seat_status = 'available',
      unassigned_at = now(),
      updated_at = now()
    WHERE assigned_subscription_id = OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subscription updates
DROP TRIGGER IF EXISTS trg_sync_subscription_seat_assignment ON public.subscriptions;
CREATE TRIGGER trg_sync_subscription_seat_assignment
  AFTER UPDATE OF resource_pool_id, resource_pool_seat_id ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.fn_sync_subscription_seat_assignment();
