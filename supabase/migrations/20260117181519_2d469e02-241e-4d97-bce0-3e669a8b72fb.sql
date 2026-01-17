-- Remove unused openai_api_key column from user_ai_settings
-- This column stored user-provided OpenAI API keys which are no longer used
-- The application now uses Lovable AI exclusively for AI features
ALTER TABLE public.user_ai_settings DROP COLUMN IF EXISTS openai_api_key;