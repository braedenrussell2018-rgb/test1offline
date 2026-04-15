import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MeetingLobby } from "@/components/video/MeetingLobby";
import { VideoMeetingRoom } from "@/components/video/VideoMeetingRoom";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function MeetingJoin() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState<any>(null);
  const [userName, setUserName] = useState("Unknown");
  const [showLobby, setShowLobby] = useState(true);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (user?.id) {
      supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => { if (data?.full_name) setUserName(data.full_name); });
    }
  }, [user?.id]);

  useEffect(() => {
    if (!code) return;
    const loadMeeting = async () => {
      const { data, error } = await (supabase as any)
        .from("video_meetings")
        .select("*")
        .eq("meeting_code", code.toUpperCase())
        .maybeSingle();

      if (error || !data) {
        toast.error("Meeting not found");
        navigate("/dashboard");
        return;
      }
      if (data.status === "ended") {
        toast.error("This meeting has ended");
        navigate("/dashboard");
        return;
      }
      setMeeting(data);
      setLoading(false);
    };
    loadMeeting();
  }, [code, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (showLobby && meeting && !joined) {
    return (
      <MeetingLobby
        meetingTitle={meeting.title}
        meetingCode={meeting.meeting_code}
        displayName={userName}
        onJoin={() => {
          setShowLobby(false);
          setJoined(true);
        }}
        onCancel={() => navigate("/dashboard")}
      />
    );
  }

  if (joined && meeting) {
    return (
      <VideoMeetingRoom
        meetingId={meeting.id}
        meetingTitle={meeting.title}
        isHost={meeting.created_by === user?.id}
        onLeave={() => navigate("/dashboard")}
      />
    );
  }

  return null;
}
