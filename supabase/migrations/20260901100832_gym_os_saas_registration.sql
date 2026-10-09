-- Gym OS SaaS registration + launch coupon (isolated from gym/member tables).
-- No DROP, DELETE, or changes to existing tenant tables / RLS.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gym_os_coupons (
  code text PRIMARY KEY,
  discount_percent integer NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  max_redemptions integer NOT NULL CHECK (max_redemptions > 0),
  redeemed_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gym_os_coupons_redeemed_bounds_chk
    CHECK (redeemed_count >= 0 AND redeemed_count <= max_redemptions)
);

CREATE TABLE IF NOT EXISTS public.gym_os_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_reference_id text NOT NULL,
  idempotency_key uuid NOT NULL,
  gym_name text NOT NULL,
  owner_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  username_preference text NOT NULL,
  member_count integer NOT NULL CHECK (member_count >= 1 AND member_count <= 100000),
  plan_id text NOT NULL CHECK (plan_id = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'half_yearly'::text])),
  plan_name text NOT NULL,
  duration_months integer NOT NULL CHECK (duration_months > 0),
  base_amount numeric(12, 2) NOT NULL CHECK (base_amount >= 0),
  discount_amount numeric(12, 2) NOT NULL CHECK (discount_amount >= 0),
  final_amount numeric(12, 2) NOT NULL CHECK (final_amount >= 0),
  coupon_code text,
  payment_status text NOT NULL CHECK (payment_status = ANY (ARRAY['pending'::text, 'free_coupon'::text])),
  registration_status text NOT NULL CHECK (
    registration_status = ANY (ARRAY['pending'::text, 'under_review'::text, 'approved'::text, 'rejected'::text])
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gym_os_registration_amounts_chk CHECK (final_amount = base_amount - discount_amount),
  CONSTRAINT gym_os_registration_username_len_chk CHECK (
    char_length(username_preference) >= 3 AND char_length(username_preference) <= 64
  )
);

CREATE TABLE IF NOT EXISTS public.gym_os_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code text NOT NULL REFERENCES public.gym_os_coupons (code),
  registration_request_id uuid NOT NULL REFERENCES public.gym_os_registration_requests (id),
  status text NOT NULL CHECK (status = 'success'::text),
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gym_os_coupon_redemptions_request_uidx UNIQUE (registration_request_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS gym_os_registration_requests_reference_uidx
  ON public.gym_os_registration_requests (public_reference_id);

CREATE UNIQUE INDEX IF NOT EXISTS gym_os_registration_requests_idempotency_uidx
  ON public.gym_os_registration_requests (idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS gym_os_registration_requests_open_email_uidx
  ON public.gym_os_registration_requests (lower(email))
  WHERE registration_status IN ('pending', 'under_review');

CREATE INDEX IF NOT EXISTS gym_os_registration_requests_created_idx
  ON public.gym_os_registration_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS gym_os_coupon_redemptions_code_success_idx
  ON public.gym_os_coupon_redemptions (coupon_code)
  WHERE status = 'success';

CREATE UNIQUE INDEX IF NOT EXISTS gym_os_coupon_redemptions_success_once_uidx
  ON public.gym_os_coupon_redemptions (coupon_code, registration_request_id)
  WHERE status = 'success';

DROP TRIGGER IF EXISTS gym_os_coupons_set_updated_at ON public.gym_os_coupons;
CREATE TRIGGER gym_os_coupons_set_updated_at
  BEFORE UPDATE ON public.gym_os_coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS gym_os_registration_requests_set_updated_at ON public.gym_os_registration_requests;
CREATE TRIGGER gym_os_registration_requests_set_updated_at
  BEFORE UPDATE ON public.gym_os_registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.gym_os_coupons (code, discount_percent, max_redemptions, redeemed_count, active)
VALUES ('RUNMYGYM26', 100, 5, 0, true)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS: no public read/write. Service role bypasses RLS.
-- ---------------------------------------------------------------------------

ALTER TABLE public.gym_os_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_os_coupons FORCE ROW LEVEL SECURITY;

ALTER TABLE public.gym_os_registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_os_registration_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE public.gym_os_coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_os_coupon_redemptions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.gym_os_coupons FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.gym_os_registration_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.gym_os_coupon_redemptions FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.gym_os_coupons TO service_role;
GRANT ALL ON TABLE public.gym_os_registration_requests TO service_role;
GRANT ALL ON TABLE public.gym_os_coupon_redemptions TO service_role;

-- ---------------------------------------------------------------------------
-- Server-authoritative plan catalog (not membership_plans)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.gym_os_saas_plan(p_plan_id text)
RETURNS TABLE (
  plan_id text,
  plan_name text,
  duration_months integer,
  base_amount numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT x.plan_id, x.plan_name, x.duration_months, x.base_amount
  FROM (
    VALUES
      ('monthly'::text, '1 Month'::text, 1, 1500.00::numeric),
      ('quarterly'::text, '3 Months'::text, 3, 3999.00::numeric),
      ('half_yearly'::text, '6 Months'::text, 6, 6999.00::numeric)
  ) AS x(plan_id, plan_name, duration_months, base_amount)
  WHERE x.plan_id = p_plan_id;
$$;

CREATE OR REPLACE FUNCTION private.gym_os_registration_payload(
  p_row public.gym_os_registration_requests,
  p_idempotent boolean
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'idempotent', p_idempotent,
    'id', p_row.id,
    'public_reference_id', p_row.public_reference_id,
    'plan_id', p_row.plan_id,
    'plan_name', p_row.plan_name,
    'duration_months', p_row.duration_months,
    'base_amount', p_row.base_amount,
    'discount_amount', p_row.discount_amount,
    'final_amount', p_row.final_amount,
    'coupon_code', p_row.coupon_code,
    'payment_status', p_row.payment_status,
    'registration_status', p_row.registration_status
  );
$$;

CREATE OR REPLACE FUNCTION private.quote_gym_os_registration(
  p_plan_id text,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan record;
  v_coupon public.gym_os_coupons%ROWTYPE;
  v_code text;
  v_discount numeric;
  v_status text;
  v_valid boolean;
BEGIN
  SELECT * INTO v_plan FROM private.gym_os_saas_plan(trim(coalesce(p_plan_id, '')));
  IF v_plan.plan_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'invalid_plan',
      'message', 'Invalid plan.'
    );
  END IF;

  v_code := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  v_discount := 0;
  v_valid := false;
  v_status := 'none';

  IF v_code IS NOT NULL THEN
    SELECT * INTO v_coupon
    FROM public.gym_os_coupons
    WHERE code = v_code;

    IF NOT FOUND OR NOT v_coupon.active THEN
      v_status := 'invalid';
    ELSIF v_coupon.redeemed_count >= v_coupon.max_redemptions THEN
      v_status := 'exhausted';
    ELSE
      v_valid := true;
      v_status := 'applied';
      v_discount := round(v_plan.base_amount * v_coupon.discount_percent / 100.0, 2);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'plan_id', v_plan.plan_id,
    'plan_name', v_plan.plan_name,
    'duration_months', v_plan.duration_months,
    'base_amount', v_plan.base_amount,
    'discount_amount', v_discount,
    'final_amount', v_plan.base_amount - v_discount,
    'coupon_valid', v_valid,
    'coupon_status', v_status
  );
END;
$$;

-- One atomic transaction: validate → claim slot (if coupon) → insert request → insert redemption.
-- Any failure rolls the whole function back. Concurrent claims serialize on FOR UPDATE.
CREATE OR REPLACE FUNCTION private.submit_gym_os_registration(
  p_gym_name text,
  p_owner_name text,
  p_email text,
  p_phone text,
  p_city text,
  p_state text,
  p_username_preference text,
  p_member_count integer,
  p_plan_id text,
  p_coupon_code text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan record;
  v_coupon public.gym_os_coupons%ROWTYPE;
  v_existing public.gym_os_registration_requests%ROWTYPE;
  v_row public.gym_os_registration_requests%ROWTYPE;
  v_code text;
  v_email text;
  v_gym_name text;
  v_owner_name text;
  v_phone text;
  v_city text;
  v_state text;
  v_username text;
  v_discount numeric;
  v_final numeric;
  v_payment_status text;
  v_reg_status text;
  v_updated integer;
  v_ref text;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'validation_error', 'message', 'Missing idempotency key.');
  END IF;

  SELECT * INTO v_existing
  FROM public.gym_os_registration_requests
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN private.gym_os_registration_payload(v_existing, true);
  END IF;

  SELECT * INTO v_plan FROM private.gym_os_saas_plan(trim(coalesce(p_plan_id, '')));
  IF v_plan.plan_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_plan', 'message', 'Invalid plan.');
  END IF;

  v_gym_name := trim(coalesce(p_gym_name, ''));
  v_owner_name := trim(coalesce(p_owner_name, ''));
  v_email := lower(trim(coalesce(p_email, '')));
  v_phone := trim(coalesce(p_phone, ''));
  v_city := trim(coalesce(p_city, ''));
  v_state := trim(coalesce(p_state, ''));
  v_username := trim(coalesce(p_username_preference, ''));
  v_code := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');

  IF char_length(v_gym_name) < 2 OR char_length(v_gym_name) > 120
     OR char_length(v_owner_name) < 2 OR char_length(v_owner_name) > 120
     OR v_email !~ '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
     OR char_length(v_phone) < 8 OR char_length(v_phone) > 20
     OR char_length(v_city) < 2 OR char_length(v_city) > 80
     OR char_length(v_state) < 2 OR char_length(v_state) > 80
     OR char_length(v_username) < 3 OR char_length(v_username) > 64
     OR v_username !~ '^[A-Za-z0-9._-]+$'
     OR p_member_count IS NULL OR p_member_count < 1 OR p_member_count > 100000 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'validation_error', 'message', 'Please check the registration details and try again.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.gym_os_registration_requests
    WHERE lower(email) = v_email
      AND registration_status IN ('pending', 'under_review')
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'duplicate_email',
      'message', 'A registration request for this email is already under review.'
    );
  END IF;

  v_discount := 0;
  v_final := v_plan.base_amount;
  v_payment_status := 'pending';
  v_reg_status := 'pending';

  IF v_code IS NOT NULL THEN
    SELECT * INTO v_coupon
    FROM public.gym_os_coupons
    WHERE code = v_code
    FOR UPDATE;

    IF NOT FOUND OR NOT v_coupon.active THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'coupon_invalid',
        'message', 'Invalid or unavailable coupon code.'
      );
    END IF;

    SELECT * INTO v_existing
    FROM public.gym_os_registration_requests
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN private.gym_os_registration_payload(v_existing, true);
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.gym_os_registration_requests
      WHERE lower(email) = v_email
        AND registration_status IN ('pending', 'under_review')
    ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'duplicate_email',
        'message', 'A registration request for this email is already under review.'
      );
    END IF;

    IF v_coupon.redeemed_count >= v_coupon.max_redemptions THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'coupon_exhausted',
        'message', 'This launch coupon has reached its maximum number of redemptions.'
      );
    END IF;

    UPDATE public.gym_os_coupons
    SET redeemed_count = redeemed_count + 1
    WHERE code = v_code
      AND active
      AND redeemed_count < max_redemptions;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'coupon_exhausted',
        'message', 'This launch coupon has reached its maximum number of redemptions.'
      );
    END IF;

    v_discount := round(v_plan.base_amount * v_coupon.discount_percent / 100.0, 2);
    v_final := v_plan.base_amount - v_discount;
    v_payment_status := 'free_coupon';
    v_reg_status := 'under_review';
  END IF;

  v_ref := 'GYMOS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.gym_os_registration_requests (
    public_reference_id,
    idempotency_key,
    gym_name,
    owner_name,
    email,
    phone,
    city,
    state,
    username_preference,
    member_count,
    plan_id,
    plan_name,
    duration_months,
    base_amount,
    discount_amount,
    final_amount,
    coupon_code,
    payment_status,
    registration_status
  )
  VALUES (
    v_ref,
    p_idempotency_key,
    v_gym_name,
    v_owner_name,
    v_email,
    v_phone,
    v_city,
    v_state,
    v_username,
    p_member_count,
    v_plan.plan_id,
    v_plan.plan_name,
    v_plan.duration_months,
    v_plan.base_amount,
    v_discount,
    v_final,
    v_code,
    v_payment_status,
    v_reg_status
  )
  RETURNING * INTO v_row;

  IF v_code IS NOT NULL THEN
    INSERT INTO public.gym_os_coupon_redemptions (
      coupon_code,
      registration_request_id,
      status
    )
    VALUES (
      v_code,
      v_row.id,
      'success'
    );
  END IF;

  RETURN private.gym_os_registration_payload(v_row, false);

EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.gym_os_registration_requests
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN private.gym_os_registration_payload(v_existing, true);
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'duplicate_email',
      'message', 'A registration request for this email is already under review.'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.quote_gym_os_registration(
  p_plan_id text,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT private.quote_gym_os_registration(p_plan_id, p_coupon_code);
$$;

CREATE OR REPLACE FUNCTION public.submit_gym_os_registration(
  p_gym_name text,
  p_owner_name text,
  p_email text,
  p_phone text,
  p_city text,
  p_state text,
  p_username_preference text,
  p_member_count integer,
  p_plan_id text,
  p_coupon_code text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT private.submit_gym_os_registration(
    p_gym_name,
    p_owner_name,
    p_email,
    p_phone,
    p_city,
    p_state,
    p_username_preference,
    p_member_count,
    p_plan_id,
    p_coupon_code,
    p_idempotency_key
  );
$$;

REVOKE ALL ON FUNCTION private.gym_os_saas_plan(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.gym_os_registration_payload(public.gym_os_registration_requests, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.quote_gym_os_registration(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.submit_gym_os_registration(text, text, text, text, text, text, text, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quote_gym_os_registration(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_gym_os_registration(text, text, text, text, text, text, text, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.gym_os_saas_plan(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.gym_os_registration_payload(public.gym_os_registration_requests, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION private.quote_gym_os_registration(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION private.submit_gym_os_registration(text, text, text, text, text, text, text, integer, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.quote_gym_os_registration(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_gym_os_registration(text, text, text, text, text, text, text, integer, text, text, uuid) TO service_role;
