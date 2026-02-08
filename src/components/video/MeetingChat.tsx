import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

interface MeetingChatProps {
  meetingId: string;
  userId: string;
  userName: string;
  onClose: () => void;
  onNewMessage?: () => void;
}

export function MeetingChat({ meetingId, userId, userName, onClose, onNewMessage }: MeetingChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const loadedRef = useRef(false);

  // Load persisted messages on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      const { data } = await (supabase as any)
        .from("meeting_chat_messages")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        setMessages(
          data.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            userName: row.user_name,
            text: row.text,
            timestamp: row.created_at,
          }))
        );
      }
    })();
  }, [meetingId]);

  // Subscribe to broadcast for real-time messages
  useEffect(() => {
    const channel = supabase.channel(`meeting-chat-${meetingId}`);

    channel
      .on("broadcast", { event: "chat-message" }, ({ payload }) => {
        const msg = payload as ChatMessage;
        // Only add if not from self (we add locally on send)
        if (msg.userId !== userId) {
          setMessages((prev) => [...prev, msg]);
          onNewMessage?.();
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, userId, onNewMessage]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !channelRef.current) return;

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      userId,
      userName,
      text,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to other participants
    channelRef.current.send({
      type: "broadcast",
      event: "chat-message",
      payload: msg,
    });

    // Add locally
    setMessages((prev) => [...prev, msg]);
    setInput("");

    // Persist to database
    await (supabase as any).from("meeting_chat_messages").insert({
      id: msg.id,
      meeting_id: meetingId,
      user_id: userId,
      user_name: userName,
      text: msg.text,
    });
  }, [input, userId, userName, meetingId]);

  return (
    <div className="w-80 border-l bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">Meeting Chat</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center pt-8">
              No messages yet. Start the conversation!
            </p>
          )}
          {messages.map((msg) => {
            const isOwn = msg.userId === userId;
            return (
              <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-muted-foreground mb-0.5">
                  {isOwn ? "You" : msg.userName}
                </span>
                <div
                  className={`rounded-lg px-3 py-1.5 text-sm max-w-[85%] ${
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          className="text-sm h-9"
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendMessage} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
