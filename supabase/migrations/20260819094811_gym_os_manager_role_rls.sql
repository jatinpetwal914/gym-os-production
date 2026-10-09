-- Use distinct manager after enum value is committed. No table drops.

CREATE OR REPLACE FUNCTION private.is_ops_lead()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND p.role IN ('gym_owner', 'gym_admin', 'manager')
  )
$$;

CREATE OR REPLACE FUNCTION private.is_gym_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND p.role IN ('gym_owner', 'gym_admin')
  )
$$;

CREATE OR REPLACE FUNCTION private.is_desk_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND p.role IN ('gym_owner', 'gym_admin', 'manager', 'staff')
  )
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
          p.role IN ('gym_owner', 'gym_admin', 'manager')
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

CREATE OR REPLACE FUNCTION private.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role public.app_role;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  SELECT p.role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.gym_id IS DISTINCT FROM OLD.gym_id
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF caller_role IS NULL OR caller_role NOT IN ('super_admin', 'gym_owner', 'gym_admin') THEN
      RAISE EXCEPTION 'cannot change role, gym, or status';
    END IF;
    IF caller_role <> 'super_admin' AND NEW.role = 'super_admin' THEN
      RAISE EXCEPTION 'cannot grant super_admin';
    END IF;
    IF caller_role IN ('gym_owner', 'gym_admin') AND NEW.gym_id IS DISTINCT FROM OLD.gym_id THEN
      RAISE EXCEPTION 'gym_id is immutable';
    END IF;
    IF caller_role = 'gym_admin' AND NEW.role IN ('super_admin', 'gym_owner') THEN
      RAISE EXCEPTION 'insufficient privilege to assign that role';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION private.is_ops_lead() TO authenticated;

DROP POLICY IF EXISTS membership_plans_insert ON public.membership_plans;
CREATE POLICY membership_plans_insert ON public.membership_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_ops_lead())
    AND (SELECT private.has_gym(gym_id))
    AND (
      branch_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.gym_branches b
        WHERE b.id = membership_plans.branch_id AND b.gym_id = membership_plans.gym_id
      )
    )
  );

DROP POLICY IF EXISTS membership_plans_update ON public.membership_plans;
CREATE POLICY membership_plans_update ON public.membership_plans
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_ops_lead()) AND (SELECT private.has_gym(gym_id)))
  WITH CHECK ((SELECT private.is_ops_lead()) AND (SELECT private.has_gym(gym_id)));

DROP POLICY IF EXISTS membership_plans_delete ON public.membership_plans;
CREATE POLICY membership_plans_delete ON public.membership_plans
  FOR DELETE TO authenticated
  USING ((SELECT private.is_ops_lead()) AND (SELECT private.has_gym(gym_id)));

DROP POLICY IF EXISTS visits_select ON public.visits;
CREATE POLICY visits_select ON public.visits
  FOR SELECT TO authenticated
  USING (
    ((SELECT private.is_ops_lead()) AND (SELECT private.has_gym(gym_id)))
    OR (((SELECT private.role()) = 'staff') AND (SELECT private.has_branch(branch_id)))
    OR (((SELECT private.role()) = 'trainer') AND (SELECT private.trains_member(member_id)))
    OR (member_id = (SELECT private.own_member_id()))
    OR (SELECT private.has_support_gym(gym_id))
  );

DROP POLICY IF EXISTS visits_update ON public.visits;
CREATE POLICY visits_update ON public.visits
  FOR UPDATE TO authenticated
  USING (
    (
      (SELECT private.is_desk_staff())
      AND (SELECT private.has_gym(gym_id))
      AND (
        (SELECT private.is_ops_lead())
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

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (id = (SELECT private.uid()))
    OR ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)))
    OR (((SELECT private.role()) = 'trainer') AND (SELECT private.has_gym(gym_id)))
    OR (
      (SELECT private.is_super_admin())
      AND role = ANY (ARRAY[
        'gym_owner'::public.app_role,
        'gym_admin'::public.app_role,
        'manager'::public.app_role,
        'staff'::public.app_role,
        'trainer'::public.app_role,
        'super_admin'::public.app_role
      ])
    )
  );
