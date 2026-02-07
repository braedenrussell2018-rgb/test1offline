import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Circle,
  Upload,
  MonitorUp,
  MonitorOff,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebRTC } from "./useWebRTC";
import { MeetingChat } from "./MeetingChat";
import { toast } from "sonner";

interface VideoMeetingRoomProps {
  meetingId: string;
  meetingTitle: string;
  isHost: boolean;
  onLeave: () => void;
}

export function VideoMeetingRoom({
  meetingId,
  meetingTitle,
  isHost,
  onLeave,
}: VideoMeetingRoomProps) {
  const { user } = useAuth();
  const [userName, setUserName] = useState("Unknown");
  const [isUploading, setIsUploading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (user?.id) {
      supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.full_name) setUserName(data.full_name);
        });
    }
  }, [user?.id]);

  const handleRecordingReady = useCallback(
    async (blob: Blob) => {
      setIsUploading(true);
      toast.info("Uploading meeting recording...");
      try {
        const fileName = `${meetingId}/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("meeting-recordings")
          .upload(fileName, blob, { contentType: "video/webm" });

        if (uploadError) throw uploadError;

        // Update meeting with recording URL
        await (supabase as any)
          .from("video_meetings")
          .update({
            recording_url: fileName,
            status: "ended",
            ended_at: new Date().toISOString(),
          })
          .eq("id", meetingId);

        toast.success("Recording saved! AI is processing the meeting...");

        // Trigger AI processing
        supabase.functions
          .invoke("process-meeting-recording", {
            body: { meetingId },
          })
          .then(({ error }) => {
            if (error) console.error("AI processing error:", error);
            else toast.success("AI notes are ready!");
          });
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload recording");
      } finally {
        setIsUploading(false);
      }
    },
    [meetingId]
  );

  const {
    localStream,
    screenStream,
    participants,
    isAudioMuted,
    isVideoMuted,
    isRecording,
    isConnected,
    isScreenSharing,
    startMedia,
    joinChannel,
    startRecording,
    stopRecording,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    disconnect,
  } = useWebRTC({
    meetingId,
    userId: user?.id || "",
    userName,
    isHost,
    onRecordingReady: handleRecordingReady,
  });

  useEffect(() => {
    if (!user?.id || userName === "Unknown") return;

    const init = async () => {
      try {
        await startMedia();
        await joinChannel();

        // Register as participant
        await (supabase as any).from("video_meeting_participants").insert({
          meeting_id: meetingId,
          user_id: user.id,
          user_name: userName,
          is_host: isHost,
        });

        // Update meeting status to live if host
        if (isHost) {
          await (supabase as any)
            .from("video_meetings")
            .update({
              status: "live",
              started_at: new Date().toISOString(),
            })
            .eq("id", meetingId);
        }
      } catch (error) {
        console.error("Failed to join meeting:", error);
        toast.error("Failed to join meeting. Check camera/microphone permissions.");
      }
    };

    init();
  }, [user?.id, userName]);

  // Attach local stream or screen share to video element
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = isScreenSharing && screenStream ? screenStream : localStream;
    }
  }, [localStream, screenStream, isScreenSharing]);

  const handleEndCall = async () => {
    // If host is recording, wait for the recording blob to be assembled before disconnecting
    if (isHost && isRecording) {
      toast.info("Saving recording...");
      await stopRecording();
      // Give the onRecordingReady callback time to fire and start uploading
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Mark participant as left
    if (user?.id) {
      await (supabase as any)
        .from("video_meeting_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("meeting_id", meetingId)
        .eq("user_id", user.id);
    }

    // If host and NOT recording (non-host or no recording), end the meeting
    // If host WAS recording, handleRecordingReady already sets status to "ended"
    if (isHost && !isRecording) {
      await (supabase as any)
        .from("video_meetings")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", meetingId);
    }

    disconnect();
    onLeave();
  };

  const participantArray = Array.from(participants.values());
  const totalParticipants = participantArray.length + 1; // +1 for self

  return (
    <div className="fixed inset-0 z-50 bg-background flex">
      <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-lg">{meetingTitle}</h2>
          {isRecording && (
            <Badge variant="destructive" className="gap-1 animate-pulse">
              <Circle className="h-2 w-2 fill-current" />
              Recording
            </Badge>
          )}
          {isUploading && (
            <Badge variant="secondary" className="gap-1">
              <Upload className="h-3 w-3" />
              Uploading...
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {totalParticipants}
          </Badge>
          {isConnected && (
            <Badge variant="secondary" className="text-emerald-500">Connected</Badge>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div
          className={`grid gap-4 h-full ${
            totalParticipants <= 1
              ? "grid-cols-1"
              : totalParticipants <= 4
              ? "grid-cols-2"
              : "grid-cols-3"
          }`}
        >
          {/* Local video */}
          <Card className="relative overflow-hidden bg-muted flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-1">
              <Badge variant="secondary" className="text-xs">
                You {isHost ? "(Host)" : ""}
              </Badge>
              {isAudioMuted && <MicOff className="h-3 w-3 text-destructive" />}
            </div>
          </Card>

          {/* Remote participants */}
          {participantArray.map((participant) => (
            <Card
              key={participant.user_id}
              className="relative overflow-hidden bg-muted flex items-center justify-center"
            >
              {participant.stream ? (
                <RemoteVideo stream={participant.stream} />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Users className="h-12 w-12" />
                  <span>Connecting...</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2">
                <Badge variant="secondary" className="text-xs">
                  {participant.user_name}
                  {participant.is_host ? " (Host)" : ""}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-4 border-t bg-card">
        <Button
          variant={isAudioMuted ? "destructive" : "outline"}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={toggleAudio}
        >
          {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>

        <Button
          variant={isVideoMuted ? "destructive" : "outline"}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={toggleVideo}
        >
          {isVideoMuted ? (
            <VideoOff className="h-5 w-5" />
          ) : (
            <Video className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant={isScreenSharing ? "destructive" : "outline"}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          {isScreenSharing ? (
            <MonitorOff className="h-5 w-5" />
          ) : (
            <MonitorUp className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant={isChatOpen ? "secondary" : "outline"}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={() => setIsChatOpen(!isChatOpen)}
          title="Toggle chat"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>

        {isHost && (
          <Button
            variant={isRecording ? "destructive" : "secondary"}
            className="rounded-full gap-2"
            onClick={isRecording ? stopRecording : startRecording}
          >
            <Circle
              className={`h-4 w-4 ${isRecording ? "fill-current animate-pulse" : ""}`}
            />
            {isRecording ? "Stop Recording" : "Start Recording"}
          </Button>
        )}

        <Button
          variant="destructive"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={handleEndCall}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
      </div>
      </div>

      {isChatOpen && (
        <MeetingChat
          meetingId={meetingId}
          userId={user?.id || ""}
          userName={userName}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
}
