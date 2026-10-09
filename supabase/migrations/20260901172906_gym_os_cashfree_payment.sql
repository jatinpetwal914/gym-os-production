-- Isolated SaaS payment columns for Cashfree. Does not touch gym/member tables.

ALTER TABLE public.gym_os_registration_requests
  DROP CONSTRAINT IF EXISTS gym_os_registration_requests_payment_status_check;

ALTER TABLE public.gym_os_registration_requests
  ADD CONSTRAINT gym_os_registration_requests_payment_status_check
  CHECK (payment_status = ANY (ARRAY['pending'::text, 'free_coupon'::text, 'paid'::text, 'failed'::text]));

ALTER TABLE public.gym_os_registration_requests
  ADD COLUMN IF NOT EXISTS cashfree_order_id text,
  ADD COLUMN IF NOT EXISTS cashfree_payment_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS gym_os_registration_requests_cashfree_order_uidx
  ON public.gym_os_registration_requests (cashfree_order_id)
  WHERE cashfree_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.mark_gym_os_registration_paid(
  p_public_reference_id text,
  p_cashfree_order_id text,
  p_cashfree_payment_id text,
  p_paid_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.gym_os_registration_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.gym_os_registration_requests
  WHERE public_reference_id = trim(p_public_reference_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'not_found', 'message', 'Registration not found.');
  END IF;

  IF v_row.payment_status = 'free_coupon' OR v_row.final_amount = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'not_payable', 'message', 'No payment is required for this registration.');
  END IF;

  IF v_row.payment_status = 'paid' THEN
    IF v_row.cashfree_order_id IS NOT DISTINCT FROM p_cashfree_order_id THEN
      RETURN private.gym_os_registration_payload(v_row, true);
    END IF;
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'public_reference_id', v_row.public_reference_id);
  END IF;

  IF p_paid_amount IS NULL OR p_paid_amount <> v_row.final_amount THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'amount_mismatch', 'message', 'Paid amount does not match the registration.');
  END IF;

  UPDATE public.gym_os_registration_requests
  SET
    payment_status = 'paid',
    registration_status = 'under_review',
    cashfree_order_id = p_cashfree_order_id,
    cashfree_payment_id = nullif(trim(coalesce(p_cashfree_payment_id, '')), ''),
    paid_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN private.gym_os_registration_payload(v_row, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_gym_os_registration_paid(
  p_public_reference_id text,
  p_cashfree_order_id text,
  p_cashfree_payment_id text,
  p_paid_amount numeric
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT private.mark_gym_os_registration_paid(
    p_public_reference_id,
    p_cashfree_order_id,
    p_cashfree_payment_id,
    p_paid_amount
  );
$$;

REVOKE ALL ON FUNCTION private.mark_gym_os_registration_paid(text, text, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_gym_os_registration_paid(text, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.mark_gym_os_registration_paid(text, text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_gym_os_registration_paid(text, text, text, numeric) TO service_role;
