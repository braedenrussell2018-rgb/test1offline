import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { MessageSquare, Bot, Play, Pause, Clock, Volume2 } from "lucide-react";
import { format } from "date-fns";
import { EmptyState } from "@/components/EmptyState";

interface Conversation {
  id: string;
  transcript: string;
  summary: string | null;
  key_points: string[] | null;
  contact_id: string | null;
  created_at: string;
  duration_seconds: number | null;
  audio_url: string | null;
}

interface ConversationsTabProps {
  conversations: Conversation[];
  searchQuery: string;
  playingAudio: string | null;
  isPlaying: boolean;
  currentAudioTime: number;
  audioDuration: number;
  onPlayAudio: (audioPath: string) => void;
  onSeek: (value: number[]) => void;
  formatDuration: (seconds: number | null) => string;
}

export function ConversationsTab({
  conversations,
  searchQuery,
  playingAudio,
  isPlaying,
  currentAudioTime,
  audioDuration,
  onPlayAudio,
  onSeek,
  formatDuration,
}: ConversationsTabProps) {
  const [conversationDialogOpen, setConversationDialogOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  const filteredConversations = conversations.filter(conv =>
    conv.transcript.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Past Conversations & AI Interactions
          </CardTitle>
          <CardDescription>View all your recorded conversations and AI assistant interactions</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredConversations.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No conversations recorded yet" description="Your AI conversations and recordings will appear here" />
          ) : (
            <div className="h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-4">
                {filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => { setSelectedConversation(conv); setConversationDialogOpen(true); }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">
                            {format(new Date(conv.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          {conv.duration_seconds && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDuration(conv.duration_seconds)}
                            </Badge>
                          )}
                        </div>
                        {conv.summary && <p className="text-sm mb-2">{conv.summary}</p>}
                        {conv.key_points && conv.key_points.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {conv.key_points.map((point, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">{point}</Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-2">{conv.transcript}</p>
                      </div>
                      {conv.audio_url && (
                        <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); onPlayAudio(conv.audio_url!); }}>
                          {playingAudio === conv.audio_url ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={conversationDialogOpen} onOpenChange={setConversationDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation Details
            </DialogTitle>
          </DialogHeader>
          {selectedConversation && (
            <div className="space-y-6 mt-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-4">
                <span>{format(new Date(selectedConversation.created_at), "MMMM d, yyyy 'at' h:mm a")}</span>
                {selectedConversation.duration_seconds && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(selectedConversation.duration_seconds)}
                  </div>
                )}
              </div>
              {selectedConversation.summary && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Summary</h4>
                  <p className="text-sm border rounded-lg p-3 bg-muted/30">{selectedConversation.summary}</p>
                </div>
              )}
              {selectedConversation.key_points && selectedConversation.key_points.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Key Points</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedConversation.key_points.map((point, i) => (
                      <li key={i} className="text-sm">{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Full Transcript</h4>
                <div className="text-sm whitespace-pre-wrap border rounded-lg p-4 bg-muted/30 leading-relaxed max-h-[300px] overflow-y-auto">
                  {selectedConversation.transcript}
                </div>
              </div>
              {selectedConversation.audio_url && (
                <div className="border border-border rounded-lg p-4 bg-muted/20">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Audio Recording
                  </h4>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-full"
                      onClick={() => onPlayAudio(selectedConversation.audio_url!)}
                    >
                      {playingAudio === selectedConversation.audio_url && isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </Button>
                    <div className="flex-1 space-y-1.5">
                      <Slider
                        value={[playingAudio === selectedConversation.audio_url ? currentAudioTime : 0]}
                        min={0}
                        max={playingAudio === selectedConversation.audio_url ? audioDuration : (selectedConversation.duration_seconds || 100)}
                        step={1}
                        onValueChange={onSeek}
                        className="cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {playingAudio === selectedConversation.audio_url
                            ? formatDuration(currentAudioTime)
                            : "0:00"}
                        </span>
                        <span>{formatDuration(selectedConversation.duration_seconds || audioDuration)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
