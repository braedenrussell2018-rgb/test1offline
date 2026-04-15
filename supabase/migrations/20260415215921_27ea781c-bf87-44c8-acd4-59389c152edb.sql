
-- Add meeting_code and scheduled_at columns
ALTER TABLE public.video_meetings
ADD COLUMN IF NOT EXISTS meeting_code text UNIQUE,
ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Create function to auto-generate meeting codes
CREATE OR REPLACE FUNCTION public.generate_meeting_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i integer;
BEGIN
  IF NEW.meeting_code IS NULL THEN
    LOOP
      code := '';
      FOR i IN 1..6 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      -- Check uniqueness
      IF NOT EXISTS (SELECT 1 FROM video_meetings WHERE meeting_code = code) THEN
        NEW.meeting_code := code;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_generate_meeting_code ON public.video_meetings;
CREATE TRIGGER trigger_generate_meeting_code
BEFORE INSERT ON public.video_meetings
FOR EACH ROW
EXECUTE FUNCTION public.generate_meeting_code();

-- Backfill existing meetings with codes
DO $$
DECLARE
  rec RECORD;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i integer;
BEGIN
  FOR rec IN SELECT id FROM video_meetings WHERE meeting_code IS NULL LOOP
    LOOP
      code := '';
      FOR i IN 1..6 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      IF NOT EXISTS (SELECT 1 FROM video_meetings WHERE meeting_code = code) THEN
        UPDATE video_meetings SET meeting_code = code WHERE id = rec.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
