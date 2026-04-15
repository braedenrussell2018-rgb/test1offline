ALTER TABLE public.video_meetings
  ADD COLUMN IF NOT EXISTS recording_tracks jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS speaker_timeline jsonb DEFAULT '[]'::jsonb;