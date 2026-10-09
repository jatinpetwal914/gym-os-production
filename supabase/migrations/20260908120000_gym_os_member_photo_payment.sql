-- Isolated member-registration payment fields + refund states.
-- Reuses public.payments. Does not touch SaaS gym_os_registration_requests.

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'partially_refunded';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'reversed';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS gateway text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS gateway_reference text,
  ADD COLUMN IF NOT EXISTS gateway_response jsonb,
  ADD COLUMN IF NOT EXISTS refund_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz;

UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'member-photos';

CREATE OR REPLACE FUNCTION public.adjust_member_payment(
  p_payment_id uuid,
  p_action text,
  p_amount numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_action text;
  v_refund numeric;
BEGIN
  IF NOT (SELECT private.is_desk_staff()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_action := lower(trim(coalesce(p_action, '')));
  IF v_action NOT IN ('refund', 'partial_refund', 'reverse', 'cancel') THEN
    RAISE EXCEPTION 'invalid payment action';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found';
  END IF;
  IF NOT (SELECT private.has_gym(v_payment.gym_id)) THEN
    RAISE EXCEPTION 'payment does not belong to your gym';
  END IF;

  IF v_action = 'cancel' THEN
    IF v_payment.status <> 'pending' AND v_payment.status <> 'processing' THEN
      RAISE EXCEPTION 'only pending payments can be cancelled';
    END IF;
    UPDATE public.payments
    SET status = 'cancelled', notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes)
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
  ELSIF v_action = 'reverse' THEN
    IF v_payment.status <> 'completed' THEN
      RAISE EXCEPTION 'only completed payments can be reversed';
    END IF;
    UPDATE public.payments
    SET
      status = 'reversed',
      refund_amount = v_payment.amount,
      reversed_at = now(),
      refunded_at = now(),
      notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes)
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
  ELSIF v_action = 'refund' THEN
    IF v_payment.status <> 'completed' AND v_payment.status <> 'partially_refunded' THEN
      RAISE EXCEPTION 'only completed payments can be refunded';
    END IF;
    UPDATE public.payments
    SET
      status = 'refunded',
      refund_amount = v_payment.amount,
      refunded_at = now(),
      notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes)
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
  ELSE
    v_refund := coalesce(p_amount, 0);
    IF v_refund <= 0 OR v_refund >= v_payment.amount THEN
      RAISE EXCEPTION 'partial refund amount must be between 0 and the paid amount';
    END IF;
    IF v_payment.status <> 'completed' AND v_payment.status <> 'partially_refunded' THEN
      RAISE EXCEPTION 'only completed payments can be partially refunded';
    END IF;
    UPDATE public.payments
    SET
      status = 'partially_refunded',
      refund_amount = least(v_payment.amount, v_payment.refund_amount + v_refund),
      refunded_at = now(),
      notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes)
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
  END IF;

  RETURN jsonb_build_object('ok', true, 'payment', to_jsonb(v_payment));
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_member_payment(uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_member_payment(uuid, text, numeric, text) TO authenticated, service_role;
