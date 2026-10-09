CREATE UNIQUE INDEX IF NOT EXISTS music_tracks_provider_track_uidx
  ON public.music_tracks (provider, provider_track_id);
