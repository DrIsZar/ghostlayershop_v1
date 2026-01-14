-- Add service_type field to services table
-- This field indicates whether a service is a personal upgrade or family/invite service

ALTER TABLE IF EXISTS public.services
  ADD COLUMN IF NOT EXISTS service_type text CHECK (service_type IN ('personal_upgrade', 'family_invite'));

-- Create index for service_type
CREATE INDEX IF NOT EXISTS idx_services_service_type ON public.services(service_type);

-- Update existing services to have a default type (you can adjust this based on your needs)
-- For now, we'll set them to 'family_invite' as the default
UPDATE public.services
SET service_type = 'family_invite'
WHERE service_type IS NULL;

