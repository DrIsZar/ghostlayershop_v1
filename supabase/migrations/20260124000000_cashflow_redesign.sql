-- Migration: Cashflow Redesign
-- Adds money pools, transfers, ad spend tracking, and pending payouts

-- Money Pools (Business Vault, Savings, Personal)
CREATE TABLE public.money_pools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (name = ANY (ARRAY['business_vault'::text, 'savings'::text, 'personal'::text])),
  display_name text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  target numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT money_pools_pkey PRIMARY KEY (id),
  CONSTRAINT money_pools_name_key UNIQUE (name)
);

-- Insert default pools
INSERT INTO public.money_pools (name, display_name, balance, target) VALUES
  ('business_vault', 'Business Vault', 0, 3000),
  ('savings', 'Savings', 0, 1000),
  ('personal', 'Personal', 0, 500);

-- Pool Transfers (moving money between pools)
CREATE TABLE public.pool_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_pool text NOT NULL,
  to_pool text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pool_transfers_pkey PRIMARY KEY (id),
  CONSTRAINT pool_transfers_from_pool_check CHECK (from_pool = ANY (ARRAY['business_vault'::text, 'savings'::text, 'personal'::text, 'external'::text])),
  CONSTRAINT pool_transfers_to_pool_check CHECK (to_pool = ANY (ARRAY['business_vault'::text, 'savings'::text, 'personal'::text, 'external'::text]))
);

-- Daily Ad Spend tracking
CREATE TABLE public.daily_ad_spend (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  platform text NOT NULL DEFAULT 'meta',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT daily_ad_spend_pkey PRIMARY KEY (id),
  CONSTRAINT daily_ad_spend_date_platform_key UNIQUE (date, platform)
);

-- Pending Payouts (Stripe, PayPal, etc.)
CREATE TABLE public.pending_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  expected_date date NOT NULL,
  received boolean NOT NULL DEFAULT false,
  received_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pending_payouts_pkey PRIMARY KEY (id)
);

-- Update money pool balance trigger
CREATE OR REPLACE FUNCTION update_money_pool_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER money_pools_updated_at
  BEFORE UPDATE ON public.money_pools
  FOR EACH ROW
  EXECUTE FUNCTION update_money_pool_timestamp();

CREATE TRIGGER daily_ad_spend_updated_at
  BEFORE UPDATE ON public.daily_ad_spend
  FOR EACH ROW
  EXECUTE FUNCTION update_money_pool_timestamp();

CREATE TRIGGER pending_payouts_updated_at
  BEFORE UPDATE ON public.pending_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_money_pool_timestamp();

-- Enable RLS (Row Level Security) - disabled for now since no auth
ALTER TABLE public.money_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_ad_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_payouts ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (matches existing pattern)
CREATE POLICY "Allow all money_pools" ON public.money_pools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all pool_transfers" ON public.pool_transfers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all daily_ad_spend" ON public.daily_ad_spend FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all pending_payouts" ON public.pending_payouts FOR ALL USING (true) WITH CHECK (true);
