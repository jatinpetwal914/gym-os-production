-- Audit hardening: pending = payment due, check-in races, trainer branch, member self-update.

ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  ALTER TABLE public.membership_plans
    ADD CONSTRAINT membership_plans_tier_check
    CHECK (tier IN ('standard', 'premium'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION private.sync_member_from_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_ms public.memberships%ROWTYPE;
BEGIN
  SELECT * INTO current_ms
  FROM public.memberships
  WHERE member_id = COALESCE(NEW.member_id, OLD.member_id)
    AND status IN ('pending', 'active', 'expiring', 'expired', 'frozen')
  ORDER BY
    CASE status
      WHEN 'active' THEN 1
      WHEN 'expiring' THEN 2
      WHEN 'pending' THEN 3
      WHEN 'frozen' THEN 4
      ELSE 5
    END,
    ends_on DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.members
    SET
      plan_id = current_ms.plan_id,
      start_date = current_ms.starts_on,
      expiry_date = current_ms.ends_on,
      amount_paid = current_ms.amount_paid,
      status = CASE
        WHEN current_ms.status IN ('active', 'expiring', 'expired') THEN current_ms.status::text
        WHEN current_ms.status = 'pending' THEN 'inactive'
        ELSE 'expired'
      END,
      updated_at = now()
    WHERE id = current_ms.member_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION private.has_branch(p_branch uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND (
        (
          p.role IN ('gym_owner', 'gym_admin')
          AND EXISTS (
            SELECT 1 FROM public.gym_branches b
            WHERE b.id = p_branch AND b.gym_id = p.gym_id
          )
        )
        OR (
          p.role IN ('staff', 'trainer')
          AND (
            p.home_branch_id = p_branch
            OR EXISTS (
              SELECT 1 FROM public.staff_branch_access a
              WHERE a.profile_id = p.id AND a.branch_id = p_branch
            )
          )
        )
      )
  )
$$;

DROP POLICY IF EXISTS visits_insert ON public.visits;
CREATE POLICY visits_insert ON public.visits
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.has_gym(gym_id))
    AND (SELECT private.has_branch(branch_id))
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = visits.member_id AND m.gym_id = visits.gym_id)
    AND (
      (SELECT private.is_desk_staff())
      OR (
        (SELECT private.role()) = 'trainer'
        AND (SELECT private.trains_member(member_id))
      )
    )
  );

CREATE OR REPLACE FUNCTION private.protect_member_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF (SELECT private.is_desk_staff()) OR (SELECT private.is_super_admin()) THEN
    RETURN NEW;
  END IF;

  IF NEW.gym_id IS DISTINCT FROM OLD.gym_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
     OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.qr_token IS DISTINCT FROM OLD.qr_token
     OR NEW.member_id IS DISTINCT FROM OLD.member_id
     OR NEW.expiry_date IS DISTINCT FROM OLD.expiry_date
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'cannot change privileged member fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_protect_self ON public.members;
CREATE TRIGGER trg_members_protect_self
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION private.protect_member_self_update();

CREATE OR REPLACE FUNCTION public.check_in(p_qr_token text, p_branch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_open public.visits%ROWTYPE;
  v_capacity integer;
  v_inside integer;
  v_visit public.visits%ROWTYPE;
  v_branch_gym uuid;
BEGIN
  IF p_qr_token IS NULL OR p_branch_id IS NULL THEN
    RAISE EXCEPTION 'qr_token and branch_id are required';
  END IF;

  IF NOT (SELECT private.has_branch(p_branch_id)) THEN
    RAISE EXCEPTION 'no access to this branch';
  END IF;

  SELECT gym_id INTO v_branch_gym FROM public.gym_branches WHERE id = p_branch_id;
  IF v_branch_gym IS NULL THEN
    RAISE EXCEPTION 'branch not found';
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE qr_token = p_qr_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid QR token';
  END IF;

  IF v_member.gym_id IS DISTINCT FROM v_branch_gym THEN
    RAISE EXCEPTION 'member does not belong to this gym';
  END IF;

  IF (SELECT private.role()) = 'trainer' AND NOT (SELECT private.trains_member(v_member.id)) THEN
    RAISE EXCEPTION 'trainer can only check in assigned members';
  END IF;

  IF v_member.status = 'expired' THEN
    RAISE EXCEPTION 'membership expired';
  END IF;

  IF v_member.status = 'inactive' THEN
    RAISE EXCEPTION 'payment due';
  END IF;

  SELECT * INTO v_open
  FROM public.visits
  WHERE member_id = v_member.id AND check_out_at IS NULL
  ORDER BY check_in_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'action', 'already_checked_in',
      'member', jsonb_build_object('id', v_member.id, 'member_id', v_member.member_id, 'name', v_member.name, 'status', v_member.status),
      'visit', to_jsonb(v_open)
    );
  END IF;

  SELECT max_capacity INTO v_capacity FROM public.gym_branches WHERE id = p_branch_id;

  IF v_capacity IS NOT NULL THEN
    SELECT count(*) INTO v_inside FROM public.visits WHERE branch_id = p_branch_id AND check_out_at IS NULL;
    IF v_inside >= v_capacity THEN
      RAISE EXCEPTION 'branch is at capacity';
    END IF;
  END IF;

  INSERT INTO public.visits (gym_id, branch_id, member_id, method, scanned_by)
  VALUES (v_member.gym_id, p_branch_id, v_member.id, 'qr', auth.uid())
  RETURNING * INTO v_visit;

  RETURN jsonb_build_object(
    'action', 'checkin',
    'member', jsonb_build_object('id', v_member.id, 'member_id', v_member.member_id, 'name', v_member.name, 'status', v_member.status),
    'visit', to_jsonb(v_visit)
  );
END;
$$;
