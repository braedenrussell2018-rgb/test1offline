import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Video, Users, Circle, Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, isFuture } from "date-fns";

interface LiveMeeting {
  id: string;
  title: string;
  status: string;
  created_by: string;
  started_at: string | null;
  meeting_code: string | null;
  scheduled_at: string | null;
}

interface LiveMeetingsBannerProps {
  onJoinMeeting: (meetingId: string, title: string) => void;
}

export function LiveMeetingsBanner({ onJoinMeeting }: LiveMeetingsBannerProps) {
  const [liveMeetings, setLiveMeetings] = useState<LiveMeeting[]>([]);

  const loadLiveMeetings = async () => {
    const { data } = await (supabase as any)
      .from("video_meetings")
      .select("id, title, status, created_by, started_at, meeting_code, scheduled_at")
      .in("status", ["waiting", "live", "scheduled"])
      .order("created_at", { ascending: false });

    setLiveMeetings(data || []);
  };

  useEffect(() => {
    loadLiveMeetings();

    const channel = supabase
      .channel("live-meetings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "video_meetings" },
        () => loadLiveMeetings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (liveMeetings.length === 0) return null;

  const activeMeetings = liveMeetings.filter(m => m.status === "waiting" || m.status === "live");
  const scheduledMeetings = liveMeetings.filter(m => m.status === "scheduled" && m.scheduled_at);

  return (
    <div className="space-y-2">
      {activeMeetings.map((meeting) => (
        <Card key={meeting.id} className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-center justify-between py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Video className="h-5 w-5 text-primary" />
                <Circle className="h-2 w-2 fill-green-500 text-green-500 absolute -top-0.5 -right-0.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{meeting.title}</p>
                  {meeting.meeting_code && (
                    <Badge variant="outline" className="text-[10px] font-mono">{meeting.meeting_code}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={meeting.status === "live" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {meeting.status === "live" ? (
                      <>
                        <Circle className="h-1.5 w-1.5 fill-current mr-1" />
                        Live
                      </>
                    ) : (
                      "Waiting"
                    )}
                  </Badge>
                </div>
              </div>
            </div>
            <Button size="sm" onClick={() => onJoinMeeting(meeting.id, meeting.title)} className="gap-2">
              <Users className="h-4 w-4" />
              Join
            </Button>
          </CardContent>
        </Card>
      ))}

      {scheduledMeetings.map((meeting) => (
        <Card key={meeting.id} className="border-muted-foreground/20">
          <CardContent className="flex items-center justify-between py-3 px-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{meeting.title}</p>
                  {meeting.meeting_code && (
                    <Badge variant="outline" className="text-[10px] font-mono">{meeting.meeting_code}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {meeting.scheduled_at && isFuture(new Date(meeting.scheduled_at))
                    ? `Starts ${formatDistanceToNow(new Date(meeting.scheduled_at), { addSuffix: true })}`
                    : meeting.scheduled_at
                      ? format(new Date(meeting.scheduled_at), "MMM d, h:mm a")
                      : ""}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onJoinMeeting(meeting.id, meeting.title)} className="gap-2">
              <Users className="h-4 w-4" />
              Join
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
