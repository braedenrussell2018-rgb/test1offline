import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Hand } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const REACTIONS = [
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "👏", label: "Clap" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "😂", label: "Laugh" },
];

interface FloatingReaction {
  id: string;
  emoji: string;
  userName: string;
  x: number;
}

interface MeetingReactionsProps {
  meetingId: string;
  userId: string;
  userName: string;
  handRaised: boolean;
  onToggleHand: () => void;
}

export function MeetingReactions({ meetingId, userId, userName, handRaised, onToggleHand }: MeetingReactionsProps) {
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  const sendReaction = useCallback((emoji: string) => {
    const channel = supabase.channel(`meeting:${meetingId}`);
    channel.send({
      type: "broadcast",
      event: "reaction",
      payload: { emoji, userId, userName },
    });
    // Also show locally
    addFloating(emoji, userName);
  }, [meetingId, userId, userName]);

  const addFloating = (emoji: string, name: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const x = 20 + Math.random() * 60; // 20-80% from left
    setFloatingReactions(prev => [...prev, { id, emoji, userName: name, x }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2500);
  };

  useEffect(() => {
    const channel = supabase.channel(`meeting-reactions-${meetingId}`);
    channel
      .on("broadcast", { event: "reaction" }, ({ payload }: any) => {
        if (payload?.userId !== userId) {
          addFloating(payload.emoji, payload.userName);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [meetingId, userId]);

  return (
    <>
      {/* Floating reactions overlay */}
      <div className="fixed inset-0 pointer-events-none z-[60]">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="absolute animate-float-up text-center"
            style={{ left: `${r.x}%`, bottom: "100px" }}
          >
            <span className="text-3xl">{r.emoji}</span>
            <p className="text-xs text-foreground/70 font-medium">{r.userName}</p>
          </div>
        ))}
      </div>

      {/* Reaction buttons inline in the control bar */}
      <div className="flex items-center gap-1 border rounded-full px-2 py-1 bg-card/50">
        {REACTIONS.map((r) => (
          <button
            key={r.emoji}
            onClick={() => sendReaction(r.emoji)}
            className="text-lg hover:scale-125 transition-transform px-1"
            title={r.label}
          >
            {r.emoji}
          </button>
        ))}
        <Button
          variant={handRaised ? "secondary" : "ghost"}
          size="icon"
          className={`h-8 w-8 rounded-full ${handRaised ? "ring-2 ring-yellow-500" : ""}`}
          onClick={onToggleHand}
          title={handRaised ? "Lower hand" : "Raise hand"}
        >
          <Hand className={`h-4 w-4 ${handRaised ? "text-yellow-500" : ""}`} />
        </Button>
      </div>
    </>
  );
}
