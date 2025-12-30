-- Create table for AI conversation recordings
CREATE TABLE public.ai_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  transcript text NOT NULL,
  summary text,
  key_points jsonb DEFAULT '[]'::jsonb,
  audio_url text,
  duration_seconds integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own conversations
CREATE POLICY "Users can view their own conversations"
ON public.ai_conversations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
ON public.ai_conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
ON public.ai_conversations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
ON public.ai_conversations
FOR DELETE
USING (auth.uid() = user_id);

-- Create table for user AI settings (optional OpenAI key)
CREATE TABLE public.user_ai_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  openai_api_key text,
  preferred_model text DEFAULT 'lovable',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_ai_settings ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own settings
CREATE POLICY "Users can view their own settings"
ON public.user_ai_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON public.user_ai_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.user_ai_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_ai_conversations_updated_at
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_ai_settings_updated_at
BEFORE UPDATE ON public.user_ai_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();