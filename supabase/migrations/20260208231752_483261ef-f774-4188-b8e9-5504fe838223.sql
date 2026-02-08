
-- Calendar events table for employee scheduling
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'meeting', -- meeting, video_meeting, task, reminder, out_of_office
  location TEXT,
  is_video_meeting BOOLEAN DEFAULT false,
  video_meeting_id UUID REFERENCES public.video_meetings(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Event invitees/participants
CREATE TABLE public.calendar_event_invitees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, declined
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_invitees ENABLE ROW LEVEL SECURITY;

-- Calendar events: internal roles can view all events (for seeing others' schedules)
CREATE POLICY "Internal users can view all calendar events"
  ON public.calendar_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'employee', 'developer')
    )
  );

-- Only creator can insert their own events
CREATE POLICY "Internal users can create calendar events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'employee', 'developer')
    )
  );

-- Only creator can update their own events
CREATE POLICY "Users can update their own calendar events"
  ON public.calendar_events FOR UPDATE
  USING (auth.uid() = created_by);

-- Only creator can delete their own events
CREATE POLICY "Users can delete their own calendar events"
  ON public.calendar_events FOR DELETE
  USING (auth.uid() = created_by);

-- Invitees: internal users can view invitees for events they can see
CREATE POLICY "Internal users can view calendar invitees"
  ON public.calendar_event_invitees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'employee', 'developer')
    )
  );

-- Event creator can add invitees
CREATE POLICY "Event creator can add invitees"
  ON public.calendar_event_invitees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calendar_events
      WHERE id = event_id AND created_by = auth.uid()
    )
  );

-- Invitees can update their own status (accept/decline)
CREATE POLICY "Invitees can update their own status"
  ON public.calendar_event_invitees FOR UPDATE
  USING (auth.uid() = user_id);

-- Event creator can delete invitees
CREATE POLICY "Event creator can remove invitees"
  ON public.calendar_event_invitees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_events
      WHERE id = event_id AND created_by = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for calendar events
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_event_invitees;
