import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Mic, MicOff, Video, VideoOff, Crown, Hand } from "lucide-react";

interface ParticipantInfo {
  user_id: string;
  user_name: string;
  is_host: boolean;
  stream?: MediaStream;
  handRaised?: boolean;
}

interface ParticipantListProps {
  participants: ParticipantInfo[];
  selfName: string;
  selfIsHost: boolean;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  onClose: () => void;
}

export function ParticipantList({
  participants,
  selfName,
  selfIsHost,
  isAudioMuted,
  isVideoMuted,
  onClose,
}: ParticipantListProps) {
  return (
    <div className="w-72 border-l bg-card flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">Participants ({participants.length + 1})</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Self */}
          <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">{selfName}</span>
                {selfIsHost && <Crown className="h-3 w-3 text-yellow-500 shrink-0" />}
                <Badge variant="outline" className="text-[10px] h-4 px-1">You</Badge>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isAudioMuted ? <MicOff className="h-3.5 w-3.5 text-destructive" /> : <Mic className="h-3.5 w-3.5 text-muted-foreground" />}
              {isVideoMuted ? <VideoOff className="h-3.5 w-3.5 text-destructive" /> : <Video className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </div>

          {/* Others */}
          {participants.map((p) => (
            <div key={p.user_id} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm truncate">{p.user_name}</span>
                  {p.is_host && <Crown className="h-3 w-3 text-yellow-500 shrink-0" />}
                  {p.handRaised && <Hand className="h-3.5 w-3.5 text-yellow-500 shrink-0 animate-bounce" />}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.stream ? (
                  <Video className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <VideoOff className="h-3.5 w-3.5 text-destructive" />
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
