-- Privilege-escalation lock, trainer checkout, payment-due renewal, member lock.

CREATE OR REPLACE FUNCTION private.protect_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF (SELECT private.is_super_admin()) THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'super_admin' AND OLD.role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'cannot grant super_admin';
  END IF;

  IF (SELECT private.is_gym_manager()) AND (SELECT private.has_gym(OLD.gym_id)) THEN
    IF NEW.gym_id IS DISTINCT FROM OLD.gym_id THEN
      RAISE EXCEPTION 'cannot move profile to another gym';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.gym_id IS DISTINCT FROM OLD.gym_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.username IS DISTINCT FROM OLD.username
     OR NEW.home_branch_id IS DISTINCT FROM OLD.home_branch_id THEN
    RAISE EXCEPTION 'cannot change privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_self ON public.profiles;
CREATE TRIGGER trg_profiles_protect_self
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.protect_profile_self_update();

DROP POLICY IF EXISTS visits_update ON public.visits;
CREATE POLICY visits_update ON public.visits
  FOR UPDATE TO authenticated
  USING (
    (
      (SELECT private.is_desk_staff())
      AND (SELECT private.has_gym(gym_id))
      AND (
        (SELECT private.is_gym_manager())
        OR (SELECT private.has_branch(branch_id))
      )
    )
    OR (
      (SELECT private.role()) = 'trainer'
      AND (SELECT private.trains_member(member_id))
    )
  )
  WITH CHECK (
    (
      (SELECT private.is_desk_staff())
      AND (SELECT private.has_gym(gym_id))
    )
    OR (
      (SELECT private.role()) = 'trainer'
      AND (SELECT private.trains_member(member_id))
    )
  );

CREATE OR REPLACE FUNCTION public.record_payment(
  p_member_id uuid,
  p_plan_id uuid,
  p_amount numeric,
  p_discount numeric,
  p_method text,
  p_notes text,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_plan public.membership_plans%ROWTYPE;
  v_membership public.memberships%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_start date;
  v_end date;
  v_method public.payment_method;
  v_reuse boolean := false;
BEGIN
  IF NOT (SELECT private.is_desk_staff()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member not found';
  END IF;
  IF NOT (SELECT private.has_gym(v_member.gym_id)) THEN
    RAISE EXCEPTION 'member does not belong to your gym';
  END IF;

  SELECT * INTO v_plan FROM public.membership_plans WHERE id = COALESCE(p_plan_id, v_member.plan_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found';
  END IF;
  IF v_plan.gym_id IS DISTINCT FROM v_member.gym_id THEN
    RAISE EXCEPTION 'plan does not belong to this gym';
  END IF;

  BEGIN
    v_method := NULLIF(p_method, '')::public.payment_method;
  EXCEPTION WHEN invalid_text_representation THEN
    v_method := 'cash';
  END;
  IF v_method IS NULL THEN
    v_method := 'cash';
  END IF;

  SELECT * INTO v_membership
  FROM public.memberships
  WHERE member_id = v_member.id
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_reuse := true;
    v_start := v_membership.starts_on;
    v_end := v_membership.ends_on;
  ELSE
    v_start := CURRENT_DATE;
    IF v_member.expiry_date IS NOT NULL AND v_member.expiry_date >= CURRENT_DATE THEN
      v_start := v_member.expiry_date + 1;
    END IF;
    v_end := v_start + v_plan.duration_days;

    INSERT INTO public.memberships (
      gym_id, branch_id, member_id, plan_id, starts_on, ends_on, status, amount_due, amount_paid
    ) VALUES (
      v_member.gym_id,
      COALESCE(p_branch_id, v_member.home_branch_id),
      v_member.id,
      v_plan.id,
      v_start,
      v_end,
      'pending',
      GREATEST(v_plan.final_price - COALESCE(p_discount, 0), 0),
      0
    ) RETURNING * INTO v_membership;
  END IF;

  INSERT INTO public.payments (
    gym_id, branch_id, member_id, plan_id, membership_id, amount, discount,
    payment_method, status, notes, recorded_by
  ) VALUES (
    v_member.gym_id,
    COALESCE(p_branch_id, v_member.home_branch_id),
    v_member.id,
    v_plan.id,
    v_membership.id,
    p_amount,
    COALESCE(p_discount, 0),
    v_method::text,
    'completed',
    p_notes,
    auth.uid()
  ) RETURNING * INTO v_payment;

  UPDATE public.memberships
  SET
    plan_id = v_plan.id,
    amount_paid = amount_paid + p_amount,
    amount_due = CASE WHEN v_reuse THEN amount_due ELSE GREATEST(v_plan.final_price - COALESCE(p_discount, 0), 0) END,
    status = 'active',
    starts_on = v_start,
    ends_on = v_end
  WHERE id = v_membership.id
  RETURNING * INTO v_membership;

  INSERT INTO public.notifications (gym_id, member_id, type, title, body)
  VALUES (
    v_member.gym_id,
    v_member.id,
    'payment_recorded',
    'Payment recorded',
    format('Payment of %s received for %s', p_amount, v_member.name)
  );

  RETURN jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'membership', to_jsonb(v_membership)
  );
END;
$$;
