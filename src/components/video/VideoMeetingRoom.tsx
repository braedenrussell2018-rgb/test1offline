import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  LayoutGrid,
  Presentation,
  Copy,
  Check,
  Hand,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebRTC } from "./useWebRTC";
import { MeetingChat } from "./MeetingChat";
import { MeetingTimer } from "./MeetingTimer";
import { MeetingReactions } from "./MeetingReactions";
import { ParticipantList } from "./ParticipantList";
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
  const recordingUploadPromise = useRef<Promise<void> | null>(null);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "speaker">("grid");
  const [handRaised, setHandRaised] = useState(false);
  const [meetingCode, setMeetingCode] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  // Load meeting code and started_at
  useEffect(() => {
    (supabase as any)
      .from("video_meetings")
      .select("meeting_code, started_at")
      .eq("id", meetingId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setMeetingCode(data.meeting_code);
          setStartedAt(data.started_at);
        }
      });
  }, [meetingId]);

  const handleRecordingReady = useCallback(
    (tracks: { blob: Blob; userId: string; userName: string; isScreenShare: boolean }[], speakerTimeline: { timestamp_ms: number; speaker_user_id: string }[]) => {
      const uploadWork = (async () => {
        setIsUploading(true);
        toast.info(`Uploading ${tracks.length} recording tracks...`);
        try {
          const recordingTracks: { user_id: string; user_name: string; file_path: string; is_screen_share: boolean }[] = [];

          // Upload each track
          await Promise.all(
            tracks.map(async (track) => {
              const suffix = track.isScreenShare ? "screen" : track.userId;
              const fileName = `${meetingId}/${suffix}-${Date.now()}.webm`;
              const { error: uploadError } = await supabase.storage
                .from("meeting-recordings")
                .upload(fileName, track.blob, { contentType: "video/webm" });

              if (uploadError) {
                console.error(`Upload error for ${track.userName}:`, uploadError);
                return;
              }

              recordingTracks.push({
                user_id: track.userId,
                user_name: track.userName,
                file_path: fileName,
                is_screen_share: track.isScreenShare,
              });
            })
          );

          // Save metadata: use first non-screen track as legacy recording_url
          const primaryTrack = recordingTracks.find(t => !t.is_screen_share) || recordingTracks[0];

          await (supabase as any)
            .from("video_meetings")
            .update({
              recording_url: primaryTrack?.file_path || null,
              recording_tracks: recordingTracks,
              speaker_timeline: speakerTimeline,
              status: "ended",
              ended_at: new Date().toISOString(),
            })
            .eq("id", meetingId);

          toast.success("Recording saved! AI is processing the meeting...");

          supabase.functions
            .invoke("process-meeting-recording", { body: { meetingId } })
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
      })();
      recordingUploadPromise.current = uploadWork;
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

        await (supabase as any).from("video_meeting_participants").insert({
          meeting_id: meetingId,
          user_id: user.id,
          user_name: userName,
          is_host: isHost,
        });

        if (isHost) {
          const now = new Date().toISOString();
          await (supabase as any)
            .from("video_meetings")
            .update({ status: "live", started_at: now })
            .eq("id", meetingId);
          setStartedAt(now);
        }
      } catch (error) {
        console.error("Failed to join meeting:", error);
        toast.error("Failed to join meeting. Check camera/microphone permissions.");
      }
    };

    init();
  }, [user?.id, userName]);

  // Track unread chat messages
  const isChatOpenRef = useRef(isChatOpen);
  isChatOpenRef.current = isChatOpen;

  useEffect(() => {
    const channel = supabase.channel(`meeting-chat-notif-${meetingId}`);
    channel
      .on("broadcast", { event: "chat-message" }, ({ payload }: any) => {
        if (payload?.userId !== user?.id && !isChatOpenRef.current) {
          setUnreadCount((c) => c + 1);
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            gain.gain.value = 0.15;
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
          } catch {}
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [meetingId, user?.id]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = isScreenSharing && screenStream ? screenStream : localStream;
    }
  }, [localStream, screenStream, isScreenSharing]);

  // Broadcast hand raise
  const toggleHandRaise = useCallback(() => {
    const newState = !handRaised;
    setHandRaised(newState);
    const channel = supabase.channel(`meeting:${meetingId}`);
    channel.send({
      type: "broadcast",
      event: "hand-raise",
      payload: { userId: user?.id, userName, raised: newState },
    });
  }, [handRaised, meetingId, user?.id, userName]);

  const handleCopyLink = () => {
    if (meetingCode) {
      navigator.clipboard.writeText(`${window.location.origin}/meeting/${meetingCode}`);
      setCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEndCall = async () => {
    if (isHost && isRecording) {
      toast.info("Saving recording...");
      await stopRecording();
      // Wait for upload to complete before leaving
      if (recordingUploadPromise.current) {
        await recordingUploadPromise.current;
        recordingUploadPromise.current = null;
      }
    }

    if (user?.id) {
      await (supabase as any)
        .from("video_meeting_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("meeting_id", meetingId)
        .eq("user_id", user.id);
    }

    if (isHost && !isRecording) {
      await (supabase as any)
        .from("video_meetings")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", meetingId);
    }

    disconnect();
    onLeave();
  };

  const participantArray = Array.from(participants.values());
  const totalParticipants = participantArray.length + 1;

  // Speaker view: find active speaker (last participant with stream or first)
  const activeSpeaker = viewMode === "speaker" && participantArray.length > 0
    ? participantArray[0]
    : null;

  return (
    <div className="fixed inset-0 z-[200] bg-background flex">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-lg">{meetingTitle}</h2>
            <MeetingTimer startedAt={startedAt} />
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
            {meetingCode && (
              <Button variant="ghost" size="sm" className="gap-1 text-xs font-mono" onClick={handleCopyLink}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {meetingCode}
              </Button>
            )}
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {totalParticipants}
            </Badge>
            {isConnected && (
              <Badge variant="secondary" className="text-emerald-500">Connected</Badge>
            )}
          </div>
        </div>

        {/* Video Grid / Speaker View */}
        <div className="flex-1 p-4 overflow-auto">
          {viewMode === "grid" ? (
            <div className={`grid gap-4 h-full ${
              totalParticipants <= 1 ? "grid-cols-1"
                : totalParticipants <= 4 ? "grid-cols-2"
                : "grid-cols-3"
            }`}>
              <Card className="relative overflow-hidden bg-muted flex items-center justify-center">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">You {isHost ? "(Host)" : ""}</Badge>
                  {isAudioMuted && <MicOff className="h-3 w-3 text-destructive" />}
                  {handRaised && <Hand className="h-3.5 w-3.5 text-yellow-500 animate-bounce" />}
                </div>
              </Card>
              {participantArray.map((participant) => (
                <Card key={participant.user_id} className="relative overflow-hidden bg-muted flex items-center justify-center">
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
                      {participant.user_name}{participant.is_host ? " (Host)" : ""}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            /* Speaker View */
            <div className="flex flex-col h-full gap-3">
              <div className="flex-1 min-h-0">
                <Card className="relative overflow-hidden bg-muted flex items-center justify-center h-full">
                  {activeSpeaker?.stream ? (
                    <RemoteVideo stream={activeSpeaker.stream} />
                  ) : (
                    <>
                      <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="secondary" className="text-xs">You {isHost ? "(Host)" : ""}</Badge>
                      </div>
                    </>
                  )}
                  {activeSpeaker && (
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="secondary" className="text-xs">{activeSpeaker.user_name}</Badge>
                    </div>
                  )}
                </Card>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {activeSpeaker && (
                  <Card className="relative overflow-hidden bg-muted flex items-center justify-center w-32 h-24 shrink-0">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute bottom-1 left-1">
                      <Badge variant="secondary" className="text-[10px]">You</Badge>
                    </div>
                  </Card>
                )}
                {participantArray.filter(p => p !== activeSpeaker).map((p) => (
                  <Card key={p.user_id} className="relative overflow-hidden bg-muted flex items-center justify-center w-32 h-24 shrink-0">
                    {p.stream ? <RemoteVideo stream={p.stream} /> : <Users className="h-6 w-6 text-muted-foreground" />}
                    <div className="absolute bottom-1 left-1">
                      <Badge variant="secondary" className="text-[10px]">{p.user_name}</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 px-4 py-4 border-t bg-card flex-wrap">
          <Button variant={isAudioMuted ? "destructive" : "outline"} size="icon" className="h-12 w-12 rounded-full" onClick={toggleAudio}>
            {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button variant={isVideoMuted ? "destructive" : "outline"} size="icon" className="h-12 w-12 rounded-full" onClick={toggleVideo}>
            {isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
          <Button variant={isScreenSharing ? "destructive" : "outline"} size="icon" className="h-12 w-12 rounded-full" onClick={isScreenSharing ? stopScreenShare : startScreenShare} title={isScreenSharing ? "Stop sharing" : "Share screen"}>
            {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
          </Button>

          <MeetingReactions
            meetingId={meetingId}
            userId={user?.id || ""}
            userName={userName}
            handRaised={handRaised}
            onToggleHand={toggleHandRaise}
          />

          <Button
            variant={viewMode === "speaker" ? "secondary" : "outline"}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={() => setViewMode(v => v === "grid" ? "speaker" : "grid")}
            title={viewMode === "grid" ? "Speaker view" : "Grid view"}
          >
            {viewMode === "grid" ? <Presentation className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
          </Button>

          <Button
            variant={isParticipantsOpen ? "secondary" : "outline"}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
            title="Participants"
          >
            <Users className="h-5 w-5" />
          </Button>

          <Button
            variant={isChatOpen ? "secondary" : "outline"}
            size="icon"
            className="h-12 w-12 rounded-full relative"
            onClick={() => { setIsChatOpen(!isChatOpen); if (!isChatOpen) setUnreadCount(0); }}
            title="Toggle chat"
          >
            <MessageSquare className="h-5 w-5" />
            {!isChatOpen && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          {isHost && (
            <Button variant={isRecording ? "destructive" : "secondary"} className="rounded-full gap-2" onClick={isRecording ? stopRecording : startRecording}>
              <Circle className={`h-4 w-4 ${isRecording ? "fill-current animate-pulse" : ""}`} />
              {isRecording ? "Stop Recording" : "Start Recording"}
            </Button>
          )}

          <Button variant="destructive" size="icon" className="h-12 w-12 rounded-full" onClick={handleEndCall}>
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {isParticipantsOpen && (
        <ParticipantList
          participants={participantArray}
          selfName={userName}
          selfIsHost={isHost}
          isAudioMuted={isAudioMuted}
          isVideoMuted={isVideoMuted}
          onClose={() => setIsParticipantsOpen(false)}
        />
      )}

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

  return <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />;
}
