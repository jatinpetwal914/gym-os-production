-- Seed the platform Super Admin (Supabase Auth).
-- Login: username `superadmin` or email `superadmin@forgegym.local`
-- Password: Super@2026#Admin
-- Idempotent.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  v_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'superadmin@forgegym.local'
  ) THEN
    RETURN;
  END IF;

  v_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    'superadmin@forgegym.local',
    extensions.crypt('Super@2026#Admin', extensions.gen_salt('bf')),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'role', 'super_admin',
      'username', 'superadmin'
    ),
    jsonb_build_object('full_name', 'System Administrator'),
    now(),
    now(),
    '',
    '',
    '',
    '',
    false
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_id,
    jsonb_build_object('sub', v_id::text, 'email', 'superadmin@forgegym.local'),
    'email',
    v_id::text,
    now(),
    now(),
    now()
  );
END $$;
