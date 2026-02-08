
-- Create meeting chat messages table for persisted chat
CREATE TABLE public.meeting_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.video_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_chat_messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users who are participants of the meeting can read messages
CREATE POLICY "Meeting participants can view chat messages"
  ON public.meeting_chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.video_meeting_participants vmp
      WHERE vmp.meeting_id = meeting_chat_messages.meeting_id
        AND vmp.user_id = auth.uid()
    )
  );

-- Authenticated users can insert their own messages
CREATE POLICY "Authenticated users can send chat messages"
  ON public.meeting_chat_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_chat_messages;
