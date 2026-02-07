
-- Create video_meetings table
CREATE TABLE public.video_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'live', 'ended')),
  meeting_type TEXT NOT NULL DEFAULT 'local_company',
  created_by UUID NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url TEXT,
  ai_summary TEXT,
  ai_key_points JSONB,
  ai_todo_list JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create video_meeting_participants table
CREATE TABLE public.video_meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.video_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  is_host BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.video_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_meeting_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for video_meetings
CREATE POLICY "Authenticated users can view all meetings"
  ON public.video_meetings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create meetings"
  ON public.video_meetings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Authenticated users can update meetings"
  ON public.video_meetings FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only creator can delete meetings"
  ON public.video_meetings FOR DELETE
  USING (auth.uid() = created_by);

-- RLS policies for video_meeting_participants
CREATE POLICY "Authenticated users can view participants"
  ON public.video_meeting_participants FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can join meetings"
  ON public.video_meeting_participants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update their own participation"
  ON public.video_meeting_participants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can leave meetings"
  ON public.video_meeting_participants FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_video_meetings_updated_at
  BEFORE UPDATE ON public.video_meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_meeting_participants;

-- Create storage bucket for meeting recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-recordings', 'meeting-recordings', false);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'meeting-recordings' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view recordings"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'meeting-recordings' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update recordings"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'meeting-recordings' AND auth.uid() IS NOT NULL);
