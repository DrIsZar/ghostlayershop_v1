-- Inventory System Migration
-- This migration creates the resource pools and seats system for tracking inventory

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create resource_pools table
CREATE TABLE IF NOT EXISTS public.resource_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  pool_type text NOT NULL CHECK (pool_type IN ('admin_console','family','team','workspace')),
  login_email text NOT NULL,
  login_secret text,
  notes text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  is_alive boolean NOT NULL DEFAULT true,
  max_seats int NOT NULL CHECK (max_seats > 0),
  used_seats int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','overdue','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for resource_pools
CREATE INDEX IF NOT EXISTS idx_resource_pools_provider ON public.resource_pools(provider);
CREATE INDEX IF NOT EXISTS idx_resource_pools_status ON public.resource_pools(status);
CREATE INDEX IF NOT EXISTS idx_resource_pools_end_at ON public.resource_pools(end_at);
CREATE INDEX IF NOT EXISTS idx_resource_pools_pool_type ON public.resource_pools(pool_type);

-- Create resource_pool_seats table
CREATE TABLE IF NOT EXISTS public.resource_pool_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.resource_pools(id) ON DELETE CASCADE,
  seat_index int NOT NULL,
  assigned_email text,
  assigned_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  assigned_subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  unassigned_at timestamptz,
  seat_status text NOT NULL DEFAULT 'available' CHECK (seat_status IN ('available','reserved','assigned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pool_id, seat_index)
);

-- Create indexes for resource_pool_seats
CREATE INDEX IF NOT EXISTS idx_pool_seats_pool ON public.resource_pool_seats(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_seats_assigned_sub ON public.resource_pool_seats(assigned_subscription_id);
CREATE INDEX IF NOT EXISTS idx_pool_seats_assigned_client ON public.resource_pool_seats(assigned_client_id);
CREATE INDEX IF NOT EXISTS idx_pool_seats_status ON public.resource_pool_seats(seat_status);

-- Add resource pool references to subscriptions table
ALTER TABLE IF EXISTS public.subscriptions
  ADD COLUMN IF NOT EXISTS resource_pool_id uuid REFERENCES public.resource_pools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resource_pool_seat_id uuid REFERENCES public.resource_pool_seats(id) ON DELETE SET NULL;

-- Create indexes for subscription resource pool references
CREATE INDEX IF NOT EXISTS idx_subscriptions_resource_pool ON public.subscriptions(resource_pool_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_resource_pool_seat ON public.subscriptions(resource_pool_seat_id);

-- Function to sync used_seats count
CREATE OR REPLACE FUNCTION public.fn_sync_used_seats() 
RETURNS TRIGGER AS $$
BEGIN
  -- Update used_seats for the affected pool
  UPDATE public.resource_pools rp
    SET used_seats = (
      SELECT COUNT(*) FROM public.resource_pool_seats s
      WHERE s.pool_id = rp.id AND s.seat_status = 'assigned'
    ), 
    updated_at = now()
  WHERE rp.id = COALESCE(NEW.pool_id, OLD.pool_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for used_seats synchronization
CREATE TRIGGER trg_sync_used_seats_ins
  AFTER INSERT ON public.resource_pool_seats
  FOR EACH ROW EXECUTE PROCEDURE public.fn_sync_used_seats();

CREATE TRIGGER trg_sync_used_seats_upd
  AFTER UPDATE OF seat_status ON public.resource_pool_seats
  FOR EACH ROW EXECUTE PROCEDURE public.fn_sync_used_seats();

CREATE TRIGGER trg_sync_used_seats_del
  AFTER DELETE ON public.resource_pool_seats
  FOR EACH ROW EXECUTE PROCEDURE public.fn_sync_used_seats();

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

-- RPC function to assign next free seat atomically
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

-- RPC function to unassign a seat
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

-- RPC function to get pool statistics
CREATE OR REPLACE FUNCTION public.get_pool_stats(p_pool_id uuid)
RETURNS TABLE(
  total_seats int,
  used_seats int,
  available_seats int,
  assigned_seats int,
  reserved_seats int
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rp.max_seats as total_seats,
    rp.used_seats as used_seats,
    (rp.max_seats - rp.used_seats) as available_seats,
    COUNT(CASE WHEN s.seat_status = 'assigned' THEN 1 END)::int as assigned_seats,
    COUNT(CASE WHEN s.seat_status = 'reserved' THEN 1 END)::int as reserved_seats
  FROM public.resource_pools rp
  LEFT JOIN public.resource_pool_seats s ON s.pool_id = rp.id
  WHERE rp.id = p_pool_id
  GROUP BY rp.id, rp.max_seats, rp.used_seats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE public.resource_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_pool_seats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resource_pools
CREATE POLICY "Allow all operations for authenticated users" ON public.resource_pools
  FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for resource_pool_seats  
CREATE POLICY "Allow all operations for authenticated users" ON public.resource_pool_seats
  FOR ALL USING (auth.role() = 'authenticated');

-- Temporary policies for development (remove in production)
CREATE POLICY "Allow all operations for anon users" ON public.resource_pools
  FOR ALL USING (auth.role() = 'anon');

CREATE POLICY "Allow all operations for anon users" ON public.resource_pool_seats
  FOR ALL USING (auth.role() = 'anon');

-- Development policy - allow all access (remove in production)
CREATE POLICY "Allow all operations for development" ON public.resource_pools
  FOR ALL USING (true);

CREATE POLICY "Allow all operations for development" ON public.resource_pool_seats
  FOR ALL USING (true);

-- Grant necessary permissions
GRANT ALL ON public.resource_pools TO authenticated;
GRANT ALL ON public.resource_pool_seats TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_next_free_seat TO authenticated;
GRANT EXECUTE ON FUNCTION public.unassign_seat TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pool_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_refresh_pool_status TO authenticated;

-- Grant permissions to anon role for development
GRANT ALL ON public.resource_pools TO anon;
GRANT ALL ON public.resource_pool_seats TO anon;
GRANT EXECUTE ON FUNCTION public.assign_next_free_seat TO anon;
GRANT EXECUTE ON FUNCTION public.unassign_seat TO anon;
GRANT EXECUTE ON FUNCTION public.get_pool_stats TO anon;
GRANT EXECUTE ON FUNCTION public.fn_refresh_pool_status TO anon;

-- Grant permissions to public role for development
GRANT ALL ON public.resource_pools TO public;
GRANT ALL ON public.resource_pool_seats TO public;
GRANT EXECUTE ON FUNCTION public.assign_next_free_seat TO public;
GRANT EXECUTE ON FUNCTION public.unassign_seat TO public;
GRANT EXECUTE ON FUNCTION public.get_pool_stats TO public;
GRANT EXECUTE ON FUNCTION public.fn_refresh_pool_status TO public;

