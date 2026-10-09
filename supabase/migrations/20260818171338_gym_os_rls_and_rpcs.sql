-- ForgeGym OS RLS, grants, and invoker RPCs.
-- Drops the legacy "any authenticated user" policies and enforces gym isolation.

-- ---------------------------------------------------------------------------
-- Drop legacy open policies
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers (private, DEFINER, STABLE) — source of truth is profiles, not JWT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid()
$$;

CREATE OR REPLACE FUNCTION private.current_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.*
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.status = 'active'
$$;

CREATE OR REPLACE FUNCTION private.role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role FROM public.profiles p
  WHERE p.id = auth.uid() AND p.status = 'active'
$$;

CREATE OR REPLACE FUNCTION private.gym_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.gym_id FROM public.profiles p
  WHERE p.id = auth.uid() AND p.status = 'active'
$$;

CREATE OR REPLACE FUNCTION private.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.status = 'active' AND p.role = 'super_admin'
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
      AND p.role IN ('gym_owner', 'gym_admin', 'staff')
  )
$$;

CREATE OR REPLACE FUNCTION private.has_gym(p_gym uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_gym IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND p.gym_id = p_gym
  )
$$;

CREATE OR REPLACE FUNCTION private.has_support_gym(p_gym uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_grants g
    WHERE g.granted_to = auth.uid()
      AND g.gym_id = p_gym
      AND g.expires_at > now()
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
          p.role IN ('gym_owner', 'gym_admin')
          AND EXISTS (
            SELECT 1 FROM public.gym_branches b
            WHERE b.id = p_branch AND b.gym_id = p.gym_id
          )
        )
        OR (
          p.role IN ('staff', 'trainer')
          AND EXISTS (
            SELECT 1 FROM public.staff_branch_access a
            WHERE a.profile_id = p.id AND a.branch_id = p_branch
          )
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION private.own_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.id FROM public.members m
  WHERE m.profile_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.trains_member(p_member uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trainer_members t
    WHERE t.trainer_profile_id = auth.uid()
      AND t.member_id = p_member
  )
$$;

GRANT EXECUTE ON FUNCTION private.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION private.role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.gym_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_gym_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_desk_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_gym(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_support_gym(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.own_member_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.trains_member(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Enable + force RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gym_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_branches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.staff_branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_branch_access FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.support_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_tracks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.music_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Privileges: least privilege. users/attendance have no grants (legacy).
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gyms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gym_branches TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.staff_branch_access TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.trainer_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.visits TO authenticated;
GRANT SELECT, UPDATE, INSERT ON public.notifications TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_grants TO authenticated;
GRANT SELECT ON public.music_tracks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.music_tracks TO authenticated;
GRANT SELECT ON public.music_settings TO anon, authenticated;
GRANT UPDATE ON public.music_settings TO authenticated;

-- ---------------------------------------------------------------------------
-- gyms
-- ---------------------------------------------------------------------------
CREATE POLICY gyms_select ON public.gyms
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_super_admin())
    OR id = (SELECT private.gym_id())
  );

CREATE POLICY gyms_insert ON public.gyms
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_super_admin()));

CREATE POLICY gyms_update ON public.gyms
  FOR UPDATE TO authenticated
  USING (
    (SELECT private.is_super_admin())
    OR (id = (SELECT private.gym_id()) AND (SELECT private.role()) = 'gym_owner')
  )
  WITH CHECK (
    (SELECT private.is_super_admin())
    OR (id = (SELECT private.gym_id()) AND (SELECT private.role()) = 'gym_owner')
  );

CREATE POLICY gyms_delete ON public.gyms
  FOR DELETE TO authenticated
  USING ((SELECT private.is_super_admin()));

-- ---------------------------------------------------------------------------
-- gym_branches
-- ---------------------------------------------------------------------------
CREATE POLICY gym_branches_select ON public.gym_branches
  FOR SELECT TO authenticated
  USING (
    (SELECT private.has_gym(gym_id))
    OR (SELECT private.has_support_gym(gym_id))
  );

CREATE POLICY gym_branches_insert ON public.gym_branches
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)));

CREATE POLICY gym_branches_update ON public.gym_branches
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)))
  WITH CHECK ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)));

CREATE POLICY gym_branches_delete ON public.gym_branches
  FOR DELETE TO authenticated
  USING ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)) AND is_default = false);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT private.uid())
    OR ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)))
    OR ((SELECT private.role()) = 'trainer' AND (SELECT private.has_gym(gym_id)))
    OR (
      (SELECT private.is_super_admin())
      AND role IN ('gym_owner', 'gym_admin', 'staff', 'trainer', 'super_admin')
    )
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT private.uid())
    OR ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)))
    OR ((SELECT private.is_super_admin()) AND role <> 'member')
  )
  WITH CHECK (
    id = (SELECT private.uid())
    OR ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)))
    OR ((SELECT private.is_super_admin()) AND role <> 'member')
  );

-- ---------------------------------------------------------------------------
-- staff_branch_access
-- ---------------------------------------------------------------------------
CREATE POLICY staff_branch_access_select ON public.staff_branch_access
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT private.uid())
    OR ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)))
  );

CREATE POLICY staff_branch_access_insert ON public.staff_branch_access
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_gym_manager())
    AND (SELECT private.has_gym(gym_id))
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = staff_branch_access.profile_id AND p.gym_id = staff_branch_access.gym_id
    )
    AND EXISTS (
      SELECT 1 FROM public.gym_branches b
      WHERE b.id = staff_branch_access.branch_id AND b.gym_id = staff_branch_access.gym_id
    )
  );

CREATE POLICY staff_branch_access_delete ON public.staff_branch_access
  FOR DELETE TO authenticated
  USING ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)));

-- ---------------------------------------------------------------------------
-- trainer_members
-- ---------------------------------------------------------------------------
CREATE POLICY trainer_members_select ON public.trainer_members
  FOR SELECT TO authenticated
  USING (
    trainer_profile_id = (SELECT private.uid())
    OR member_id = (SELECT private.own_member_id())
    OR ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)))
  );

CREATE POLICY trainer_members_insert ON public.trainer_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_gym_manager())
    AND (SELECT private.has_gym(gym_id))
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = trainer_members.trainer_profile_id AND p.gym_id = trainer_members.gym_id AND p.role = 'trainer')
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = trainer_members.member_id AND m.gym_id = trainer_members.gym_id)
  );

CREATE POLICY trainer_members_delete ON public.trainer_members
  FOR DELETE TO authenticated
  USING ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)));

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------
CREATE POLICY members_select ON public.members
  FOR SELECT TO authenticated
  USING (
    ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)))
    OR ((SELECT private.role()) = 'trainer' AND (SELECT private.trains_member(id)))
    OR id = (SELECT private.own_member_id())
    OR (SELECT private.has_support_gym(gym_id))
  );

CREATE POLICY members_insert ON public.members
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(gym_id))
    AND (home_branch_id IS NULL OR (SELECT private.has_branch(home_branch_id)))
    AND (
      profile_id IS NULL
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = members.profile_id AND p.gym_id = members.gym_id)
    )
  );

CREATE POLICY members_update ON public.members
  FOR UPDATE TO authenticated
  USING (
    ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)))
    OR id = (SELECT private.own_member_id())
  )
  WITH CHECK (
    ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)))
    OR id = (SELECT private.own_member_id())
  );

CREATE POLICY members_delete ON public.members
  FOR DELETE TO authenticated
  USING ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)));

-- ---------------------------------------------------------------------------
-- membership_plans
-- ---------------------------------------------------------------------------
CREATE POLICY membership_plans_select ON public.membership_plans
  FOR SELECT TO authenticated
  USING (
    (SELECT private.has_gym(gym_id))
    OR ((SELECT private.role()) = 'member' AND gym_id = (SELECT private.gym_id()) AND status = 'active')
  );

CREATE POLICY membership_plans_insert ON public.membership_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_gym_manager())
    AND (SELECT private.has_gym(gym_id))
    AND (
      branch_id IS NULL
      OR EXISTS (SELECT 1 FROM public.gym_branches b WHERE b.id = membership_plans.branch_id AND b.gym_id = membership_plans.gym_id)
    )
  );

CREATE POLICY membership_plans_update ON public.membership_plans
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)))
  WITH CHECK ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)));

CREATE POLICY membership_plans_delete ON public.membership_plans
  FOR DELETE TO authenticated
  USING ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)));

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
CREATE POLICY memberships_select ON public.memberships
  FOR SELECT TO authenticated
  USING (
    ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)))
    OR ((SELECT private.role()) = 'trainer' AND (SELECT private.trains_member(member_id)))
    OR member_id = (SELECT private.own_member_id())
    OR (SELECT private.has_support_gym(gym_id))
  );

CREATE POLICY memberships_insert ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(gym_id))
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = memberships.member_id AND m.gym_id = memberships.gym_id)
    AND (
      plan_id IS NULL
      OR EXISTS (SELECT 1 FROM public.membership_plans p WHERE p.id = memberships.plan_id AND p.gym_id = memberships.gym_id)
    )
  );

CREATE POLICY memberships_update ON public.memberships
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)))
  WITH CHECK ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)));

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
CREATE POLICY payments_select ON public.payments
  FOR SELECT TO authenticated
  USING (
    ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)))
    OR member_id = (SELECT private.own_member_id())
    OR (SELECT private.has_support_gym(gym_id))
  );

CREATE POLICY payments_insert ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(gym_id))
    AND (branch_id IS NULL OR (SELECT private.has_branch(branch_id)))
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = payments.member_id AND m.gym_id = payments.gym_id)
    AND (
      membership_id IS NULL
      OR EXISTS (SELECT 1 FROM public.memberships ms WHERE ms.id = payments.membership_id AND ms.gym_id = payments.gym_id)
    )
  );

CREATE POLICY payments_update ON public.payments
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)))
  WITH CHECK ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)));

-- ---------------------------------------------------------------------------
-- visits
-- ---------------------------------------------------------------------------
CREATE POLICY visits_select ON public.visits
  FOR SELECT TO authenticated
  USING (
    ((SELECT private.is_gym_manager()) AND (SELECT private.has_gym(gym_id)))
    OR ((SELECT private.role()) = 'staff' AND (SELECT private.has_branch(branch_id)))
    OR ((SELECT private.role()) = 'trainer' AND (SELECT private.trains_member(member_id)))
    OR member_id = (SELECT private.own_member_id())
    OR (SELECT private.has_support_gym(gym_id))
  );

CREATE POLICY visits_insert ON public.visits
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(gym_id))
    AND (SELECT private.has_branch(branch_id))
    AND EXISTS (SELECT 1 FROM public.members m WHERE m.id = visits.member_id AND m.gym_id = visits.gym_id)
  );

CREATE POLICY visits_update ON public.visits
  FOR UPDATE TO authenticated
  USING (
    (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(gym_id))
    AND ((SELECT private.is_gym_manager()) OR (SELECT private.has_branch(branch_id)))
  )
  WITH CHECK (
    (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(gym_id))
  );

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT private.uid())
    OR member_id = (SELECT private.own_member_id())
    OR ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)))
  );

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)));

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (profile_id = (SELECT private.uid()) OR member_id = (SELECT private.own_member_id()))
  WITH CHECK (profile_id = (SELECT private.uid()) OR member_id = (SELECT private.own_member_id()));

-- ---------------------------------------------------------------------------
-- support_grants (super_admin only)
-- ---------------------------------------------------------------------------
CREATE POLICY support_grants_select ON public.support_grants
  FOR SELECT TO authenticated
  USING ((SELECT private.is_super_admin()) OR granted_to = (SELECT private.uid()));

CREATE POLICY support_grants_insert ON public.support_grants
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_super_admin()));

CREATE POLICY support_grants_delete ON public.support_grants
  FOR DELETE TO authenticated
  USING ((SELECT private.is_super_admin()));

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_super_admin())
    OR ((SELECT private.is_gym_manager()) AND gym_id = (SELECT private.gym_id()))
  );

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = (SELECT private.uid()));

-- ---------------------------------------------------------------------------
-- music
-- ---------------------------------------------------------------------------
CREATE POLICY music_tracks_select_public ON public.music_tracks
  FOR SELECT TO anon
  USING (status = 'active');

CREATE POLICY music_tracks_select_auth ON public.music_tracks
  FOR SELECT TO authenticated
  USING (status = 'active' OR (SELECT private.is_super_admin()));

CREATE POLICY music_tracks_write ON public.music_tracks
  FOR ALL TO authenticated
  USING ((SELECT private.is_super_admin()))
  WITH CHECK ((SELECT private.is_super_admin()));

CREATE POLICY music_settings_select_public ON public.music_settings
  FOR SELECT TO anon
  USING (true);

CREATE POLICY music_settings_select_auth ON public.music_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY music_settings_update ON public.music_settings
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_super_admin()))
  WITH CHECK ((SELECT private.is_super_admin()));

-- Legacy tables: no policies for authenticated/anon = deny all (RLS enabled, no policy)

-- ---------------------------------------------------------------------------
-- Storage: member-photos / {gym_id}/{member_id}/...
-- ---------------------------------------------------------------------------
-- Storage policies for member-photos. Do not ALTER storage.objects (not owned
-- by the migration role); RLS is already enabled on that table.
DROP POLICY IF EXISTS member_photos_select ON storage.objects;
CREATE POLICY member_photos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'member-photos'
    AND (
      (SELECT private.has_gym(NULLIF(split_part(name, '/', 1), '')::uuid))
      OR split_part(name, '/', 2) = (SELECT private.own_member_id())::text
      OR (SELECT private.trains_member(NULLIF(split_part(name, '/', 2), '')::uuid))
    )
  );

DROP POLICY IF EXISTS member_photos_insert ON storage.objects;
CREATE POLICY member_photos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'member-photos'
    AND (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(NULLIF(split_part(name, '/', 1), '')::uuid))
  );

DROP POLICY IF EXISTS member_photos_update ON storage.objects;
CREATE POLICY member_photos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'member-photos'
    AND (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(NULLIF(split_part(name, '/', 1), '')::uuid))
  )
  WITH CHECK (
    bucket_id = 'member-photos'
    AND (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(NULLIF(split_part(name, '/', 1), '')::uuid))
  );

DROP POLICY IF EXISTS member_photos_delete ON storage.objects;
CREATE POLICY member_photos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'member-photos'
    AND (SELECT private.is_gym_manager())
    AND (SELECT private.has_gym(NULLIF(split_part(name, '/', 1), '')::uuid))
  );

-- ---------------------------------------------------------------------------
-- Invoker RPCs (RLS still applies)
-- ---------------------------------------------------------------------------
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
BEGIN
  IF p_qr_token IS NULL OR p_branch_id IS NULL THEN
    RAISE EXCEPTION 'qr_token and branch_id are required';
  END IF;

  IF NOT (SELECT private.has_branch(p_branch_id)) THEN
    RAISE EXCEPTION 'no access to this branch';
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE qr_token = p_qr_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid QR token';
  END IF;

  IF v_member.status = 'expired' THEN
    RAISE EXCEPTION 'membership expired';
  END IF;

  SELECT max_capacity INTO v_capacity FROM public.gym_branches WHERE id = p_branch_id;

  SELECT * INTO v_open
  FROM public.visits
  WHERE member_id = v_member.id AND check_out_at IS NULL
  ORDER BY check_in_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.visits
    SET check_out_at = now()
    WHERE id = v_open.id
    RETURNING * INTO v_visit;

    RETURN jsonb_build_object(
      'action', 'checkout',
      'member', jsonb_build_object('id', v_member.id, 'member_id', v_member.member_id, 'name', v_member.name, 'status', v_member.status),
      'visit', to_jsonb(v_visit)
    );
  END IF;

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
BEGIN
  IF NOT (SELECT private.is_desk_staff()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_member FROM public.members WHERE id = p_member_id;
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

  v_start := CURRENT_DATE;
  IF v_member.expiry_date IS NOT NULL AND v_member.expiry_date >= CURRENT_DATE THEN
    v_start := v_member.expiry_date + 1;
  END IF;
  v_end := v_start + v_plan.duration_days;

  BEGIN
    v_method := NULLIF(p_method, '')::public.payment_method;
  EXCEPTION WHEN invalid_text_representation THEN
    v_method := 'cash';
  END;

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
    p_method,
    'completed',
    p_notes,
    auth.uid()
  ) RETURNING * INTO v_payment;

  UPDATE public.memberships
  SET
    amount_paid = amount_paid + p_amount,
    status = 'active',
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

  RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'membership', to_jsonb(v_membership));
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_expiring_memberships()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
  rec record;
BEGIN
  UPDATE public.memberships
  SET status = 'expired'
  WHERE status IN ('active', 'expiring') AND ends_on < CURRENT_DATE;

  UPDATE public.memberships
  SET status = 'expiring'
  WHERE status = 'active' AND ends_on >= CURRENT_DATE AND ends_on <= CURRENT_DATE + 7;

  GET DIAGNOSTICS n = ROW_COUNT;

  FOR rec IN
    SELECT ms.*, m.name
    FROM public.memberships ms
    JOIN public.members m ON m.id = ms.member_id
    WHERE ms.status IN ('expiring', 'expired')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.member_id = ms.member_id
          AND n.type = CASE WHEN ms.status = 'expired' THEN 'membership_expired'::public.notification_type ELSE 'membership_expiring'::public.notification_type END
          AND n.created_at::date = CURRENT_DATE
      )
  LOOP
    INSERT INTO public.notifications (gym_id, member_id, type, title, body)
    VALUES (
      rec.gym_id,
      rec.member_id,
      CASE WHEN rec.status = 'expired' THEN 'membership_expired'::public.notification_type ELSE 'membership_expiring'::public.notification_type END,
      CASE WHEN rec.status = 'expired' THEN 'Membership expired' ELSE 'Membership expiring' END,
      rec.name
    );
  END LOOP;

  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, uuid, numeric, numeric, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_expiring_memberships() TO authenticated;
