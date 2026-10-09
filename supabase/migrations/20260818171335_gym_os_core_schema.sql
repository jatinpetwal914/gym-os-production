-- ForgeGym OS core schema
-- Incremental: safe on empty DBs (CREATE IF NOT EXISTS) and on DBs that already
-- ran the original gym SaaS migrations. Does not drop public.users or attendance.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'gym_owner', 'gym_admin', 'staff', 'trainer', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.entity_status AS ENUM ('active', 'suspended', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.membership_status AS ENUM ('pending', 'active', 'expiring', 'expired', 'frozen', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'digital_wallet');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.visit_method AS ENUM ('qr', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('in_app', 'email', 'sms');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'membership_expiring',
    'membership_expired',
    'payment_recorded',
    'check_in'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- updated_at helper (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.prevent_gym_id_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.gym_id IS DISTINCT FROM OLD.gym_id THEN
    RAISE EXCEPTION 'gym_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- gyms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id text UNIQUE NOT NULL,
  name text NOT NULL,
  owner_name text,
  phone text,
  email text,
  address text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gyms ADD COLUMN IF NOT EXISTS owner_profile_id uuid;
ALTER TABLE public.gyms DROP CONSTRAINT IF EXISTS gyms_status_check;
ALTER TABLE public.gyms ADD CONSTRAINT gyms_status_check
  CHECK (status IN ('active', 'suspended'));

DROP TRIGGER IF EXISTS trg_gyms_updated_at ON public.gyms;
CREATE TRIGGER trg_gyms_updated_at
  BEFORE UPDATE ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- gym_branches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gym_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  timezone text NOT NULL DEFAULT 'UTC',
  max_capacity integer,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gym_branches_capacity_check CHECK (max_capacity IS NULL OR max_capacity > 0),
  CONSTRAINT gym_branches_status_check CHECK (status IN ('active', 'suspended', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS gym_branches_one_default_per_gym
  ON public.gym_branches (gym_id) WHERE is_default;

CREATE INDEX IF NOT EXISTS gym_branches_gym_id_idx ON public.gym_branches (gym_id);

DROP TRIGGER IF EXISTS trg_gym_branches_updated_at ON public.gym_branches;
CREATE TRIGGER trg_gym_branches_updated_at
  BEFORE UPDATE ON public.gym_branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_gym_branches_gym_id_immutable ON public.gym_branches;
CREATE TRIGGER trg_gym_branches_gym_id_immutable
  BEFORE UPDATE ON public.gym_branches
  FOR EACH ROW EXECUTE FUNCTION private.prevent_gym_id_change();

INSERT INTO public.gym_branches (gym_id, name, address, phone, is_default, status)
SELECT g.id, 'Main', g.address, g.phone, true, 'active'
FROM public.gyms g
WHERE NOT EXISTS (
  SELECT 1 FROM public.gym_branches b WHERE b.gym_id = g.id
);

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  full_name text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE,
  home_branch_id uuid REFERENCES public.gym_branches(id) ON DELETE SET NULL,
  phone text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_len CHECK (char_length(username) BETWEEN 3 AND 64),
  CONSTRAINT profiles_status_check CHECK (status IN ('active', 'suspended', 'inactive')),
  CONSTRAINT profiles_super_admin_gym CHECK (
    (role = 'super_admin' AND gym_id IS NULL)
    OR (role <> 'super_admin' AND gym_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_ci ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS profiles_gym_id_idx ON public.profiles (gym_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_home_branch_id_idx ON public.profiles (home_branch_id);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.gyms DROP CONSTRAINT IF EXISTS gyms_owner_profile_id_fkey;
ALTER TABLE public.gyms
  ADD CONSTRAINT gyms_owner_profile_id_fkey
  FOREIGN KEY (owner_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- staff_branch_access / trainer_members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_branch_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.gym_branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, branch_id)
);

CREATE INDEX IF NOT EXISTS staff_branch_access_profile_id_idx ON public.staff_branch_access (profile_id);
CREATE INDEX IF NOT EXISTS staff_branch_access_branch_id_idx ON public.staff_branch_access (branch_id);
CREATE INDEX IF NOT EXISTS staff_branch_access_gym_id_idx ON public.staff_branch_access (gym_id);

CREATE TABLE IF NOT EXISTS public.trainer_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  trainer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_profile_id, member_id)
);

CREATE INDEX IF NOT EXISTS trainer_members_trainer_idx ON public.trainer_members (trainer_profile_id);
CREATE INDEX IF NOT EXISTS trainer_members_member_idx ON public.trainer_members (member_id);
CREATE INDEX IF NOT EXISTS trainer_members_gym_id_idx ON public.trainer_members (gym_id);

-- ---------------------------------------------------------------------------
-- Legacy tables (created here if older migrations have not run)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id text NOT NULL,
  name text NOT NULL,
  duration_days int NOT NULL,
  price numeric(10,2) NOT NULL,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  final_price numeric(10,2) NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id text NOT NULL,
  member_id text NOT NULL,
  name text NOT NULL,
  photo_url text,
  date_of_birth date,
  age int,
  gender text,
  phone text,
  address text,
  emergency_contact text,
  plan_id uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  start_date date,
  expiry_date date,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  qr_token text UNIQUE NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id text NOT NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  date date NOT NULL,
  check_in_time timestamptz,
  check_out_time timestamptz,
  status text NOT NULL DEFAULT 'present',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id text NOT NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text,
  payment_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'GYM_ADMIN',
  gym_id text,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_membership_plans_updated_at ON public.membership_plans;
CREATE TRIGGER trg_membership_plans_updated_at
  BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_members_updated_at ON public.members;
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Convert tenant keys on existing child tables from text gym code to uuid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.convert_text_gym_id(p_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table AND column_name = 'gym_id';

  IF col_type IS NULL THEN
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN gym_id uuid REFERENCES public.gyms(id) ON DELETE CASCADE', p_table);
    RETURN;
  END IF;

  IF col_type IN ('text', 'character varying') THEN
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS gym_uuid uuid', p_table);
    EXECUTE format(
      'UPDATE public.%I t SET gym_uuid = g.id FROM public.gyms g WHERE g.gym_id = t.gym_id AND t.gym_uuid IS NULL',
      p_table
    );
    EXECUTE format('DROP INDEX IF EXISTS idx_%s_gym_id', p_table);
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', p_table, p_table || '_gym_id_member_id_key');
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', p_table, p_table || '_gym_id_member_id_date_key');
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN gym_id', p_table);
    EXECUTE format('ALTER TABLE public.%I RENAME COLUMN gym_uuid TO gym_id', p_table);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN gym_id SET NOT NULL', p_table);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (gym_id) REFERENCES public.gyms(id) ON DELETE CASCADE',
      p_table, p_table || '_gym_id_fkey'
    );
  END IF;
END;
$$;

SELECT private.convert_text_gym_id('membership_plans');
SELECT private.convert_text_gym_id('members');
SELECT private.convert_text_gym_id('payments');
SELECT private.convert_text_gym_id('attendance');

DROP FUNCTION private.convert_text_gym_id(text);

-- ---------------------------------------------------------------------------
-- membership_plans extras
-- ---------------------------------------------------------------------------
ALTER TABLE public.membership_plans ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.gym_branches(id) ON DELETE SET NULL;
ALTER TABLE public.membership_plans DROP CONSTRAINT IF EXISTS membership_plans_duration_check;
ALTER TABLE public.membership_plans ADD CONSTRAINT membership_plans_duration_check CHECK (duration_days > 0);
ALTER TABLE public.membership_plans DROP CONSTRAINT IF EXISTS membership_plans_price_check;
ALTER TABLE public.membership_plans ADD CONSTRAINT membership_plans_price_check CHECK (price >= 0 AND discount >= 0 AND final_price >= 0);
ALTER TABLE public.membership_plans DROP CONSTRAINT IF EXISTS membership_plans_status_check;
ALTER TABLE public.membership_plans ADD CONSTRAINT membership_plans_status_check CHECK (status IN ('active', 'inactive'));

CREATE INDEX IF NOT EXISTS membership_plans_gym_id_idx ON public.membership_plans (gym_id);
CREATE INDEX IF NOT EXISTS membership_plans_branch_id_idx ON public.membership_plans (branch_id);

DROP TRIGGER IF EXISTS trg_membership_plans_gym_id_immutable ON public.membership_plans;
CREATE TRIGGER trg_membership_plans_gym_id_immutable
  BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION private.prevent_gym_id_change();

-- ---------------------------------------------------------------------------
-- members extras
-- ---------------------------------------------------------------------------
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS home_branch_id uuid REFERENCES public.gym_branches(id) ON DELETE SET NULL;
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE public.members ADD CONSTRAINT members_status_check
  CHECK (status IN ('active', 'expiring', 'expired', 'inactive'));
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_gender_check;
ALTER TABLE public.members ADD CONSTRAINT members_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'));
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_amount_paid_check;
ALTER TABLE public.members ADD CONSTRAINT members_amount_paid_check CHECK (amount_paid >= 0);

UPDATE public.members m
SET home_branch_id = b.id
FROM public.gym_branches b
WHERE b.gym_id = m.gym_id AND b.is_default AND m.home_branch_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS members_gym_member_code_idx ON public.members (gym_id, member_id);
CREATE UNIQUE INDEX IF NOT EXISTS members_qr_token_idx ON public.members (qr_token);
CREATE INDEX IF NOT EXISTS members_gym_id_idx ON public.members (gym_id);
CREATE INDEX IF NOT EXISTS members_home_branch_id_idx ON public.members (home_branch_id);
CREATE INDEX IF NOT EXISTS members_profile_id_idx ON public.members (profile_id);
CREATE INDEX IF NOT EXISTS members_plan_id_idx ON public.members (plan_id);
CREATE INDEX IF NOT EXISTS members_expiry_date_idx ON public.members (expiry_date);
CREATE INDEX IF NOT EXISTS members_status_idx ON public.members (status);
CREATE INDEX IF NOT EXISTS members_phone_idx ON public.members (phone);

DROP TRIGGER IF EXISTS trg_members_gym_id_immutable ON public.members;
CREATE TRIGGER trg_members_gym_id_immutable
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION private.prevent_gym_id_change();

ALTER TABLE public.trainer_members DROP CONSTRAINT IF EXISTS trainer_members_member_id_fkey;
ALTER TABLE public.trainer_members
  ADD CONSTRAINT trainer_members_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- memberships (history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.gym_branches(id) ON DELETE SET NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status public.membership_status NOT NULL DEFAULT 'pending',
  amount_due numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount_due >= 0),
  amount_paid numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_dates_check CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS memberships_gym_id_idx ON public.memberships (gym_id);
CREATE INDEX IF NOT EXISTS memberships_member_id_idx ON public.memberships (member_id);
CREATE INDEX IF NOT EXISTS memberships_plan_id_idx ON public.memberships (plan_id);
CREATE INDEX IF NOT EXISTS memberships_branch_id_idx ON public.memberships (branch_id);
CREATE INDEX IF NOT EXISTS memberships_status_idx ON public.memberships (status);
CREATE INDEX IF NOT EXISTS memberships_member_ends_idx ON public.memberships (member_id, ends_on DESC);

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON public.memberships;
CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_memberships_gym_id_immutable ON public.memberships;
CREATE TRIGGER trg_memberships_gym_id_immutable
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION private.prevent_gym_id_change();

INSERT INTO public.memberships (
  gym_id, branch_id, member_id, plan_id, starts_on, ends_on, status, amount_due, amount_paid
)
SELECT
  m.gym_id,
  m.home_branch_id,
  m.id,
  m.plan_id,
  COALESCE(m.start_date, CURRENT_DATE),
  COALESCE(m.expiry_date, CURRENT_DATE),
  CASE
    WHEN m.status IN ('active', 'expiring', 'expired') THEN m.status::public.membership_status
    ELSE 'active'::public.membership_status
  END,
  0,
  COALESCE(m.amount_paid, 0)
FROM public.members m
WHERE m.plan_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.memberships ms WHERE ms.member_id = m.id
  );

-- ---------------------------------------------------------------------------
-- payments extras
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.gym_branches(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status public.payment_status NOT NULL DEFAULT 'completed';

UPDATE public.payments p
SET membership_id = ms.id
FROM public.memberships ms
WHERE p.membership_id IS NULL AND ms.member_id = p.member_id AND ms.plan_id IS NOT DISTINCT FROM p.plan_id;

UPDATE public.payments p
SET branch_id = m.home_branch_id
FROM public.members m
WHERE p.branch_id IS NULL AND p.member_id = m.id;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_check CHECK (amount >= 0 AND discount >= 0);

CREATE INDEX IF NOT EXISTS payments_gym_id_idx ON public.payments (gym_id);
CREATE INDEX IF NOT EXISTS payments_member_id_idx ON public.payments (member_id);
CREATE INDEX IF NOT EXISTS payments_membership_id_idx ON public.payments (membership_id);
CREATE INDEX IF NOT EXISTS payments_branch_id_idx ON public.payments (branch_id);
CREATE INDEX IF NOT EXISTS payments_recorded_by_idx ON public.payments (recorded_by);
CREATE INDEX IF NOT EXISTS payments_paid_at_idx ON public.payments (payment_date);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status);

DROP TRIGGER IF EXISTS trg_payments_gym_id_immutable ON public.payments;
CREATE TRIGGER trg_payments_gym_id_immutable
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.prevent_gym_id_change();

-- ---------------------------------------------------------------------------
-- visits (open-visit model). attendance is kept for history; not dropped.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.gym_branches(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  check_in_at timestamptz NOT NULL DEFAULT now(),
  check_out_at timestamptz,
  method public.visit_method NOT NULL DEFAULT 'qr',
  scanned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'present',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visits_checkout_after_checkin CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS visits_one_open_per_member
  ON public.visits (member_id) WHERE check_out_at IS NULL;

CREATE INDEX IF NOT EXISTS visits_gym_id_idx ON public.visits (gym_id);
CREATE INDEX IF NOT EXISTS visits_branch_id_idx ON public.visits (branch_id);
CREATE INDEX IF NOT EXISTS visits_member_id_idx ON public.visits (member_id);
CREATE INDEX IF NOT EXISTS visits_open_branch_idx ON public.visits (branch_id) WHERE check_out_at IS NULL;
CREATE INDEX IF NOT EXISTS visits_check_in_at_idx ON public.visits (check_in_at);

DROP TRIGGER IF EXISTS trg_visits_gym_id_immutable ON public.visits;
CREATE TRIGGER trg_visits_gym_id_immutable
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION private.prevent_gym_id_change();

INSERT INTO public.visits (id, gym_id, branch_id, member_id, check_in_at, check_out_at, method, status, created_at)
SELECT
  a.id,
  a.gym_id,
  COALESCE(m.home_branch_id, b.id),
  a.member_id,
  COALESCE(a.check_in_time, a.created_at),
  a.check_out_time,
  'qr'::public.visit_method,
  COALESCE(a.status, 'present'),
  a.created_at
FROM public.attendance a
JOIN public.members m ON m.id = a.member_id
LEFT JOIN LATERAL (
  SELECT gb.id FROM public.gym_branches gb WHERE gb.gym_id = a.gym_id AND gb.is_default LIMIT 1
) b ON true
WHERE NOT EXISTS (SELECT 1 FROM public.visits v WHERE v.id = a.id)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- notifications + support grants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  channel public.notification_channel NOT NULL DEFAULT 'in_app',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_recipient_check CHECK (profile_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS notifications_gym_id_idx ON public.notifications (gym_id);
CREATE INDEX IF NOT EXISTS notifications_profile_id_idx ON public.notifications (profile_id, read_at);
CREATE INDEX IF NOT EXISTS notifications_member_id_idx ON public.notifications (member_id);

CREATE TABLE IF NOT EXISTS public.support_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  granted_to uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_grants_future CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS support_grants_lookup_idx ON public.support_grants (granted_to, gym_id, expires_at);

-- ---------------------------------------------------------------------------
-- audit_logs extras
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS gym_id uuid REFERENCES public.gyms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS audit_logs_gym_id_idx ON public.audit_logs (gym_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- music tables (if this migration is applied before older music migrations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'audius',
  provider_track_id text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  album text,
  artwork_url text,
  stream_url text,
  duration bigint,
  genre text,
  category text NOT NULL DEFAULT 'workout',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.music_settings (
  id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  default_provider text,
  default_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Auth profile sync (DEFINER lives in private)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role public.app_role;
  v_gym uuid;
  v_username text;
BEGIN
  v_role := COALESCE(NULLIF(NEW.raw_app_meta_data->>'role', '')::public.app_role, 'member');
  v_gym := NULLIF(NEW.raw_app_meta_data->>'gym_id', '')::uuid;
  v_username := COALESCE(
    NULLIF(NEW.raw_app_meta_data->>'username', ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, username, full_name, role, gym_id, status)
  VALUES (
    NEW.id,
    v_username,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), v_username),
    v_role,
    v_gym,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

CREATE OR REPLACE FUNCTION private.sync_profile_claims()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', NEW.role::text,
    'gym_id', NEW.gym_id::text,
    'username', NEW.username
  )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_claims ON public.profiles;
CREATE TRIGGER trg_profiles_sync_claims
  AFTER INSERT OR UPDATE OF role, gym_id, username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.sync_profile_claims();

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

DROP TRIGGER IF EXISTS trg_profiles_protect ON public.profiles;
CREATE TRIGGER trg_profiles_protect
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.protect_profile_privileges();

-- ---------------------------------------------------------------------------
-- Membership status derived from dates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.refresh_membership_status()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_memberships_status ON public.memberships;
CREATE TRIGGER trg_memberships_status
  BEFORE INSERT OR UPDATE OF starts_on, ends_on, status ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION private.refresh_membership_status();

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
        WHEN current_ms.status = 'pending' THEN 'active'
        ELSE 'expired'
      END,
      updated_at = now()
    WHERE id = current_ms.member_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_sync_member ON public.memberships;
CREATE TRIGGER trg_memberships_sync_member
  AFTER INSERT OR UPDATE OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION private.sync_member_from_membership();

-- ---------------------------------------------------------------------------
-- Storage bucket metadata (policies in RLS migration)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-photos', 'member-photos', false)
ON CONFLICT (id) DO NOTHING;
