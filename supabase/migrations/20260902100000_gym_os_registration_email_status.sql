-- Isolated email delivery tracking for Gym OS SaaS registration.
-- Does not modify gyms, profiles, members, membership_plans, payments, attendance, music, or auth.

ALTER TABLE public.gym_os_registration_requests
  ADD COLUMN IF NOT EXISTS customer_email_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS caumas_email_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS customer_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS caumas_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_email_error text,
  ADD COLUMN IF NOT EXISTS caumas_email_error text;

ALTER TABLE public.gym_os_registration_requests
  DROP CONSTRAINT IF EXISTS gym_os_registration_customer_email_status_check;

ALTER TABLE public.gym_os_registration_requests
  ADD CONSTRAINT gym_os_registration_customer_email_status_check
  CHECK (customer_email_status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text]));

ALTER TABLE public.gym_os_registration_requests
  DROP CONSTRAINT IF EXISTS gym_os_registration_caumas_email_status_check;

ALTER TABLE public.gym_os_registration_requests
  ADD CONSTRAINT gym_os_registration_caumas_email_status_check
  CHECK (caumas_email_status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text]));

CREATE OR REPLACE FUNCTION private.claim_gym_os_registration_email(
  p_public_reference_id text,
  p_channel text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF p_channel IS DISTINCT FROM 'customer' AND p_channel IS DISTINCT FROM 'caumas' THEN
    RETURN false;
  END IF;

  IF p_channel = 'customer' THEN
    UPDATE public.gym_os_registration_requests
    SET
      customer_email_status = 'sending',
      customer_email_error = NULL
    WHERE public_reference_id = trim(p_public_reference_id)
      AND (
        customer_email_status IN ('pending', 'failed')
        OR (customer_email_status = 'sending' AND updated_at < now() - interval '10 minutes')
      );
  ELSE
    UPDATE public.gym_os_registration_requests
    SET
      caumas_email_status = 'sending',
      caumas_email_error = NULL
    WHERE public_reference_id = trim(p_public_reference_id)
      AND (
        caumas_email_status IN ('pending', 'failed')
        OR (caumas_email_status = 'sending' AND updated_at < now() - interval '10 minutes')
      );
  END IF;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION private.complete_gym_os_registration_email(
  p_public_reference_id text,
  p_channel text,
  p_ok boolean,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text := CASE WHEN p_ok THEN 'sent' ELSE 'failed' END;
  v_error text := CASE
    WHEN p_ok THEN NULL
    ELSE nullif(left(trim(coalesce(p_error, '')), 500), '')
  END;
BEGIN
  IF p_channel IS DISTINCT FROM 'customer' AND p_channel IS DISTINCT FROM 'caumas' THEN
    RETURN;
  END IF;

  IF p_channel = 'customer' THEN
    UPDATE public.gym_os_registration_requests
    SET
      customer_email_status = v_status,
      customer_email_sent_at = CASE WHEN p_ok THEN now() ELSE customer_email_sent_at END,
      customer_email_error = v_error
    WHERE public_reference_id = trim(p_public_reference_id)
      AND customer_email_status = 'sending';
  ELSE
    UPDATE public.gym_os_registration_requests
    SET
      caumas_email_status = v_status,
      caumas_email_sent_at = CASE WHEN p_ok THEN now() ELSE caumas_email_sent_at END,
      caumas_email_error = v_error
    WHERE public_reference_id = trim(p_public_reference_id)
      AND caumas_email_status = 'sending';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_gym_os_registration_email(
  p_public_reference_id text,
  p_channel text
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT private.claim_gym_os_registration_email(p_public_reference_id, p_channel);
$$;

CREATE OR REPLACE FUNCTION public.complete_gym_os_registration_email(
  p_public_reference_id text,
  p_channel text,
  p_ok boolean,
  p_error text
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT private.complete_gym_os_registration_email(p_public_reference_id, p_channel, p_ok, p_error);
$$;

REVOKE ALL ON FUNCTION private.claim_gym_os_registration_email(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.complete_gym_os_registration_email(text, text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_gym_os_registration_email(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_gym_os_registration_email(text, text, boolean, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.claim_gym_os_registration_email(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION private.complete_gym_os_registration_email(text, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_gym_os_registration_email(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_gym_os_registration_email(text, text, boolean, text) TO service_role;
