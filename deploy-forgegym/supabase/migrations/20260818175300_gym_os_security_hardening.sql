-- Harden leftover functions and close the unused public definer RPC.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.prevent_gym_id_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.gym_id IS DISTINCT FROM OLD.gym_id THEN
    RAISE EXCEPTION 'gym_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.refresh_membership_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('frozen', 'cancelled', 'pending') THEN
    RETURN NEW;
  END IF;

  IF NEW.ends_on < CURRENT_DATE THEN
    NEW.status := 'expired';
  ELSIF NEW.ends_on <= CURRENT_DATE + 7 THEN
    NEW.status := 'expiring';
  ELSE
    NEW.status := 'active';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS gyms_owner_profile_id_idx ON public.gyms (owner_profile_id);
CREATE INDEX IF NOT EXISTS payments_plan_id_idx ON public.payments (plan_id);
CREATE INDEX IF NOT EXISTS support_grants_gym_id_idx ON public.support_grants (gym_id);
CREATE INDEX IF NOT EXISTS visits_scanned_by_idx ON public.visits (scanned_by);

DROP INDEX IF EXISTS public.members_qr_token_idx;
