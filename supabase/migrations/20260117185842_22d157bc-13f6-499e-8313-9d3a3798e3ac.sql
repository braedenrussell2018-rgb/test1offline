-- Create internal_notes table for employee notes not tied to customers
CREATE TABLE public.internal_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;

-- Policies for internal notes - users can manage their own notes, owners can view all
CREATE POLICY "Users can view their own internal notes"
ON public.internal_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Owners can view all internal notes"
ON public.internal_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "Users can create their own internal notes"
ON public.internal_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own internal notes"
ON public.internal_notes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own internal notes"
ON public.internal_notes FOR DELETE
USING (auth.uid() = user_id);

-- Create company_meetings table
CREATE TABLE public.company_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER,
  location TEXT,
  meeting_type TEXT DEFAULT 'general',
  notes TEXT,
  audio_url TEXT,
  attendees TEXT[],
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_meetings ENABLE ROW LEVEL SECURITY;

-- Policies for meetings - all employees/owners can view, only creators/owners can edit
CREATE POLICY "Internal users can view meetings"
ON public.company_meetings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'employee')
  )
);

CREATE POLICY "Users can create meetings"
ON public.company_meetings FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'employee')
  )
);

CREATE POLICY "Creators and owners can update meetings"
ON public.company_meetings FOR UPDATE
USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "Creators and owners can delete meetings"
ON public.company_meetings FOR DELETE
USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

-- Add triggers for updated_at
CREATE TRIGGER update_internal_notes_updated_at
BEFORE UPDATE ON public.internal_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_meetings_updated_at
BEFORE UPDATE ON public.company_meetings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();