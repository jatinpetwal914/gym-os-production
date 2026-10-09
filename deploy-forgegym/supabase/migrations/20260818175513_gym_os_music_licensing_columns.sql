ALTER TABLE public.music_tracks
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS license_name text,
  ADD COLUMN IF NOT EXISTS license_url text,
  ADD COLUMN IF NOT EXISTS commercial_use_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_performance_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attribution_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attribution_text text,
  ADD COLUMN IF NOT EXISTS verification_date timestamptz,
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS is_explicit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS country_or_region text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS energy_level smallint,
  ADD COLUMN IF NOT EXISTS sub_genre text,
  ADD COLUMN IF NOT EXISTS provider_track_url text,
  ADD COLUMN IF NOT EXISTS bpm integer;

DO $$
BEGIN
  ALTER TABLE public.music_tracks
    ADD CONSTRAINT music_tracks_energy_level_check
    CHECK (energy_level IS NULL OR energy_level BETWEEN 1 AND 5);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
