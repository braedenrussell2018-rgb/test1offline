import { WeeklyCalendar } from "@/components/calendar/WeeklyCalendar";
import { supabase } from "@/integrations/supabase/client";

interface CalendarTabProps {
  onJoinVideoMeeting: (meetingId: string, title: string, isHost: boolean, code?: string) => void;
}

export function CalendarTab({ onJoinVideoMeeting }: CalendarTabProps) {
  return (
    <div className="space-y-4">
      <WeeklyCalendar
        onCreateVideoMeeting={async (meetingId, title) => {
          const { data } = await (supabase as any).from("video_meetings").select("meeting_code").eq("id", meetingId).maybeSingle();
          onJoinVideoMeeting(meetingId, title, true, data?.meeting_code);
        }}
      />
    </div>
  );
}
