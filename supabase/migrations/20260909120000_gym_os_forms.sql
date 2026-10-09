-- Gym-scoped public forms. Isolated from SaaS gym_os_registration_requests.
-- Reuses private.has_gym / private.is_desk_staff. Does not alter members, payments, or auth.

CREATE TABLE IF NOT EXISTS public.gym_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms (id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
  success_message text NOT NULL DEFAULT 'Thank you. Your form has been submitted.',
  member_sync text NOT NULL DEFAULT 'none' CHECK (member_sync IN ('none', 'create_or_update')),
  allowed_plan_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gym_form_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.gym_forms (id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.gym_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.gym_forms (id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.gym_form_sections (id) ON DELETE CASCADE,
  field_type text NOT NULL,
  label text NOT NULL,
  placeholder text NOT NULL DEFAULT '',
  help_text text NOT NULL DEFAULT '',
  required boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_value text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.gym_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms (id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.gym_forms (id) ON DELETE CASCADE,
  public_reference text NOT NULL UNIQUE,
  member_id uuid REFERENCES public.members (id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.membership_plans (id) ON DELETE SET NULL,
  submitter_name text,
  submitter_phone text,
  submitter_email text,
  schema_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gym_forms_gym_idx ON public.gym_forms (gym_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS gym_forms_public_id_uidx ON public.gym_forms (public_id);
CREATE INDEX IF NOT EXISTS gym_form_sections_form_idx ON public.gym_form_sections (form_id, sort_order);
CREATE INDEX IF NOT EXISTS gym_form_fields_form_idx ON public.gym_form_fields (form_id, sort_order);
CREATE INDEX IF NOT EXISTS gym_form_submissions_gym_created_idx ON public.gym_form_submissions (gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gym_form_submissions_form_created_idx ON public.gym_form_submissions (form_id, created_at DESC);

DROP TRIGGER IF EXISTS gym_forms_set_updated_at ON public.gym_forms;
CREATE TRIGGER gym_forms_set_updated_at
  BEFORE UPDATE ON public.gym_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS gym_form_submissions_set_updated_at ON public.gym_form_submissions;
CREATE TRIGGER gym_form_submissions_set_updated_at
  BEFORE UPDATE ON public.gym_form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.gym_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_forms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gym_form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_form_sections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gym_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_form_fields FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gym_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_form_submissions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.gym_forms FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.gym_form_sections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.gym_form_fields FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.gym_form_submissions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gym_forms TO authenticated, service_role;
GRANT ALL ON TABLE public.gym_form_sections TO authenticated, service_role;
GRANT ALL ON TABLE public.gym_form_fields TO authenticated, service_role;
GRANT ALL ON TABLE public.gym_form_submissions TO authenticated, service_role;

DROP POLICY IF EXISTS gym_forms_select ON public.gym_forms;
CREATE POLICY gym_forms_select ON public.gym_forms
  FOR SELECT TO authenticated
  USING ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)));

DROP POLICY IF EXISTS gym_forms_write ON public.gym_forms;
CREATE POLICY gym_forms_write ON public.gym_forms
  FOR ALL TO authenticated
  USING ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)))
  WITH CHECK ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)));

DROP POLICY IF EXISTS gym_form_sections_select ON public.gym_form_sections;
CREATE POLICY gym_form_sections_select ON public.gym_form_sections
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_desk_staff())
    AND EXISTS (
      SELECT 1 FROM public.gym_forms f
      WHERE f.id = form_id AND (SELECT private.has_gym(f.gym_id))
    )
  );

DROP POLICY IF EXISTS gym_form_sections_write ON public.gym_form_sections;
CREATE POLICY gym_form_sections_write ON public.gym_form_sections
  FOR ALL TO authenticated
  USING (
    (SELECT private.is_desk_staff())
    AND EXISTS (
      SELECT 1 FROM public.gym_forms f
      WHERE f.id = form_id AND (SELECT private.has_gym(f.gym_id))
    )
  )
  WITH CHECK (
    (SELECT private.is_desk_staff())
    AND EXISTS (
      SELECT 1 FROM public.gym_forms f
      WHERE f.id = form_id AND (SELECT private.has_gym(f.gym_id))
    )
  );

DROP POLICY IF EXISTS gym_form_fields_select ON public.gym_form_fields;
CREATE POLICY gym_form_fields_select ON public.gym_form_fields
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_desk_staff())
    AND EXISTS (
      SELECT 1 FROM public.gym_forms f
      WHERE f.id = form_id AND (SELECT private.has_gym(f.gym_id))
    )
  );

DROP POLICY IF EXISTS gym_form_fields_write ON public.gym_form_fields;
CREATE POLICY gym_form_fields_write ON public.gym_form_fields
  FOR ALL TO authenticated
  USING (
    (SELECT private.is_desk_staff())
    AND EXISTS (
      SELECT 1 FROM public.gym_forms f
      WHERE f.id = form_id AND (SELECT private.has_gym(f.gym_id))
    )
  )
  WITH CHECK (
    (SELECT private.is_desk_staff())
    AND EXISTS (
      SELECT 1 FROM public.gym_forms f
      WHERE f.id = form_id AND (SELECT private.has_gym(f.gym_id))
    )
  );

DROP POLICY IF EXISTS gym_form_submissions_select ON public.gym_form_submissions;
CREATE POLICY gym_form_submissions_select ON public.gym_form_submissions
  FOR SELECT TO authenticated
  USING ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)));

DROP POLICY IF EXISTS gym_form_submissions_write ON public.gym_form_submissions;
CREATE POLICY gym_form_submissions_write ON public.gym_form_submissions
  FOR ALL TO authenticated
  USING ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)))
  WITH CHECK ((SELECT private.is_desk_staff()) AND (SELECT private.has_gym(gym_id)));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gym-form-uploads',
  'gym-form-uploads',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  file_size_limit = 8388608,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

DROP POLICY IF EXISTS gym_form_uploads_select ON storage.objects;
CREATE POLICY gym_form_uploads_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'gym-form-uploads'
    AND (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(NULLIF(split_part(name, '/', 1), '')::uuid))
  );

DROP POLICY IF EXISTS gym_form_uploads_write ON storage.objects;
CREATE POLICY gym_form_uploads_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'gym-form-uploads'
    AND (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(NULLIF(split_part(name, '/', 1), '')::uuid))
  )
  WITH CHECK (
    bucket_id = 'gym-form-uploads'
    AND (SELECT private.is_desk_staff())
    AND (SELECT private.has_gym(NULLIF(split_part(name, '/', 1), '')::uuid))
  );
