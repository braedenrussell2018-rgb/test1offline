import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Video, Users, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LiveMeeting {
  id: string;
  title: string;
  status: string;
  created_by: string;
  started_at: string | null;
}

interface LiveMeetingsBannerProps {
  onJoinMeeting: (meetingId: string, title: string) => void;
}

export function LiveMeetingsBanner({ onJoinMeeting }: LiveMeetingsBannerProps) {
  const [liveMeetings, setLiveMeetings] = useState<LiveMeeting[]>([]);

  const loadLiveMeetings = async () => {
    const { data } = await supabase
      .from("video_meetings")
      .select("id, title, status, created_by, started_at")
      .in("status", ["waiting", "live"])
      .order("created_at", { ascending: false });

    setLiveMeetings((data as any[]) || []);
  };

  useEffect(() => {
    loadLiveMeetings();

    // Subscribe to changes
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

  return (
    <div className="space-y-2">
      {liveMeetings.map((meeting) => (
        <Card key={meeting.id} className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-center justify-between py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Video className="h-5 w-5 text-primary" />
                <Circle className="h-2 w-2 fill-green-500 text-green-500 absolute -top-0.5 -right-0.5" />
              </div>
              <div>
                <p className="font-medium text-sm">{meeting.title}</p>
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
            <Button
              size="sm"
              onClick={() => onJoinMeeting(meeting.id, meeting.title)}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Join
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
