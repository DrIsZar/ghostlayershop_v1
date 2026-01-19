-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.client_purchases (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  client_id uuid,
  service_id uuid,
  transaction_id uuid,
  purchase_date timestamp with time zone DEFAULT now(),
  amount numeric NOT NULL,
  notes text,
  CONSTRAINT client_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT client_purchases_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT client_purchases_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id),
  CONSTRAINT client_purchases_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  email character varying,
  telegram character varying,
  discord character varying,
  notes text,
  source character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  type text NOT NULL DEFAULT 'client'::text CHECK (type = ANY (ARRAY['client'::text, 'reseller'::text])),
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.personal_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  login_email text NOT NULL,
  login_secret text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expiry_date timestamp with time zone,
  status text NOT NULL DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'assigned'::text, 'expired'::text])),
  assigned_to_client_id uuid,
  assigned_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT personal_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT personal_accounts_assigned_to_client_id_fkey FOREIGN KEY (assigned_to_client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.resource_pool_seats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL,
  seat_index integer NOT NULL,
  assigned_email text,
  assigned_client_id uuid,
  assigned_subscription_id uuid,
  assigned_at timestamp with time zone,
  unassigned_at timestamp with time zone,
  seat_status text NOT NULL DEFAULT 'available'::text CHECK (seat_status = ANY (ARRAY['available'::text, 'reserved'::text, 'assigned'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT resource_pool_seats_pkey PRIMARY KEY (id),
  CONSTRAINT resource_pool_seats_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.resource_pools(id),
  CONSTRAINT resource_pool_seats_assigned_client_id_fkey FOREIGN KEY (assigned_client_id) REFERENCES public.clients(id),
  CONSTRAINT resource_pool_seats_assigned_subscription_id_fkey FOREIGN KEY (assigned_subscription_id) REFERENCES public.subscriptions(id)
);
CREATE TABLE public.resource_pools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  pool_type text NOT NULL CHECK (pool_type = ANY (ARRAY['admin_console'::text, 'family'::text, 'team'::text, 'workspace'::text])),
  login_email text NOT NULL,
  login_secret text,
  notes text,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  is_alive boolean NOT NULL DEFAULT true,
  max_seats integer NOT NULL CHECK (max_seats > 0),
  used_seats integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'overdue'::text, 'expired'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT resource_pools_pkey PRIMARY KEY (id)
);
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_service text NOT NULL,
  category text NOT NULL DEFAULT 'Software'::text,
  duration text NOT NULL DEFAULT '1 month'::text,
  info_needed text NOT NULL DEFAULT 'Email'::text,
  cost numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  logo_url text,
  service_type text CHECK (service_type = ANY (ARRAY['personal_upgrade'::text, 'family_invite'::text])),
  CONSTRAINT services_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subscription_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['created'::text, 'renewed'::text, 'custom_date_set'::text, 'custom_date_cleared'::text, 'paused'::text, 'resumed'::text, 'completed'::text, 'overdue'::text, 'canceled'::text, 'updated'::text, 'archived'::text, 'reverted'::text])),
  at timestamp with time zone NOT NULL,
  meta jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscription_events_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_events_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id)
);
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  client_id uuid NOT NULL,
  transaction_id uuid,
  started_at timestamp with time zone NOT NULL,
  current_cycle_start_at timestamp with time zone NOT NULL,
  last_renewal_at timestamp with time zone,
  next_renewal_at timestamp with time zone,
  custom_next_renewal_at timestamp with time zone,
  target_end_at timestamp with time zone,
  iterations_done integer DEFAULT 0,
  strategy text NOT NULL DEFAULT 'MONTHLY'::text CHECK (strategy = ANY (ARRAY['MONTHLY'::text, 'EVERY_N_DAYS'::text])),
  interval_days integer,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'overdue'::text, 'canceled'::text, 'archived'::text])),
  is_auto_renew boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  resource_pool_id uuid,
  resource_pool_seat_id uuid,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id),
  CONSTRAINT subscriptions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT subscriptions_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT subscriptions_resource_pool_id_fkey FOREIGN KEY (resource_pool_id) REFERENCES public.resource_pools(id),
  CONSTRAINT subscriptions_resource_pool_seat_id_fkey FOREIGN KEY (resource_pool_seat_id) REFERENCES public.resource_pool_seats(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  cost_at_sale numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  notes text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_id uuid,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id),
  CONSTRAINT transactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);