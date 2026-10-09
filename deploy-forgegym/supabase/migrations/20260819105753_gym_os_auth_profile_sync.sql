-- Auth → profiles sync. Does not drop or alter profiles_super_admin_gym.
-- Does not disable RLS, change tenant helpers, drop tables, or modify user rows.

CREATE OR REPLACE FUNCTION private.parse_app_role(p_value text)
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN btrim(p_value)::public.app_role;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role public.app_role;
  v_gym uuid;
  v_branch uuid;
  v_username text;
  v_name text;
BEGIN
  v_role := private.parse_app_role(NEW.raw_app_meta_data->>'role');

  BEGIN
    v_gym := NULLIF(btrim(COALESCE(NEW.raw_app_meta_data->>'gym_id', '')), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_gym := NULL;
  END;

  BEGIN
    v_branch := NULLIF(btrim(COALESCE(NEW.raw_app_meta_data->>'home_branch_id', '')), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_branch := NULL;
  END;

  v_username := COALESCE(
    NULLIF(btrim(COALESCE(NEW.raw_app_meta_data->>'username', '')), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), '')
  );
  v_name := COALESCE(
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    v_username
  );

  -- Incomplete Auth metadata (GoTrue timing) or unknown role: wait.
  -- Never default a tenant profile to member + NULL gym_id.
  IF v_role IS NULL OR v_username IS NULL OR v_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_role = 'super_admin' THEN
    v_gym := NULL;
    v_branch := NULL;
  ELSIF v_gym IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (
    id, username, full_name, role, gym_id, home_branch_id, status
  )
  VALUES (
    NEW.id,
    v_username,
    v_name,
    v_role,
    v_gym,
    v_branch,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    gym_id = EXCLUDED.gym_id,
    home_branch_id = CASE
      WHEN EXCLUDED.role = 'super_admin' THEN NULL
      ELSE COALESCE(EXCLUDED.home_branch_id, public.profiles.home_branch_id)
    END,
    updated_at = now()
  WHERE public.profiles.username IS DISTINCT FROM EXCLUDED.username
     OR public.profiles.full_name IS DISTINCT FROM EXCLUDED.full_name
     OR public.profiles.role IS DISTINCT FROM EXCLUDED.role
     OR public.profiles.gym_id IS DISTINCT FROM EXCLUDED.gym_id
     OR (
       EXCLUDED.role = 'super_admin'
       AND public.profiles.home_branch_id IS NOT NULL
     )
     OR (
       EXCLUDED.role <> 'super_admin'
       AND EXCLUDED.home_branch_id IS NOT NULL
       AND public.profiles.home_branch_id IS DISTINCT FROM EXCLUDED.home_branch_id
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

-- Required: GoTrue may INSERT auth.users before app_metadata is present.
DROP TRIGGER IF EXISTS on_auth_user_metadata_updated ON auth.users;
CREATE TRIGGER on_auth_user_metadata_updated
  AFTER UPDATE OF raw_app_meta_data, raw_user_meta_data ON auth.users
  FOR EACH ROW
  WHEN (
    OLD.raw_app_meta_data IS DISTINCT FROM NEW.raw_app_meta_data
    OR OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
  )
  EXECUTE FUNCTION private.handle_new_user();
