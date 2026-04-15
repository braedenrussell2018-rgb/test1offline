import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Video, VideoOff, LogIn, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface MeetingLobbyProps {
  meetingTitle: string;
  meetingCode?: string;
  displayName: string;
  onJoin: (settings: { audioEnabled: boolean; videoEnabled: boolean; displayName: string }) => void;
  onCancel: () => void;
}

export function MeetingLobby({ meetingTitle, meetingCode, displayName: initialName, onJoin, onCancel }: MeetingLobbyProps) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [name, setName] = useState(initialName);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getMedia = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        setLocalStream(stream);
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setLocalStream(stream);
          setVideoEnabled(false);
        } catch {
          toast.error("Unable to access camera or microphone");
        }
      }
    };
    getMedia();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = audioEnabled; });
      localStream.getVideoTracks().forEach(t => { t.enabled = videoEnabled; });
    }
  }, [audioEnabled, videoEnabled, localStream]);

  const handleCopyLink = () => {
    if (meetingCode) {
      const url = `${window.location.origin}/meeting/${meetingCode}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoin = () => {
    // Stop preview stream – the room will create its own
    localStream?.getTracks().forEach(t => t.stop());
    onJoin({ audioEnabled, videoEnabled, displayName: name });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{meetingTitle}</CardTitle>
          {meetingCode && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-sm font-mono tracking-wider">{meetingCode}</Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyLink}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Preview */}
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            {videoEnabled && localStream ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <VideoOff className="h-12 w-12" />
              </div>
            )}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              <Button
                variant={audioEnabled ? "secondary" : "destructive"}
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setAudioEnabled(!audioEnabled)}
              >
                {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button
                variant={videoEnabled ? "secondary" : "destructive"}
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setVideoEnabled(!videoEnabled)}
              >
                {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <Label htmlFor="lobby-name">Display Name</Label>
            <Input
              id="lobby-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button onClick={handleJoin} className="flex-1 gap-2" disabled={!name.trim()}>
              <LogIn className="h-4 w-4" />
              Join Meeting
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
