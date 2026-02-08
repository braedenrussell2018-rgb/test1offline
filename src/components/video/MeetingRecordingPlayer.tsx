import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  FileText,
  ListTodo,
  Lightbulb,
  Video,
  Calendar,
  Clock,
  Users,
  MessageSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ChatMessage {
  id: string;
  user_name: string;
  text: string;
  created_at: string;
}

interface VideoMeeting {
  id: string;
  title: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  recording_url: string | null;
  ai_summary: string | null;
  ai_key_points: string[] | null;
  ai_todo_list: { assignee: string; task: string; completed: boolean }[] | null;
}

interface MeetingRecordingPlayerProps {
  meetings: VideoMeeting[];
  onRefresh: () => void;
}

export function MeetingRecordingPlayer({
  meetings,
  onRefresh,
}: MeetingRecordingPlayerProps) {
  const [selectedMeeting, setSelectedMeeting] = useState<VideoMeeting | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const loadVideoUrl = async (recordingPath: string) => {
    const { data, error } = await supabase.storage
      .from("meeting-recordings")
      .createSignedUrl(recordingPath, 3600);

    if (error) {
      console.error("Failed to get signed URL:", error);
      return;
    }
    setVideoUrl(data.signedUrl);
  };

  const handleOpenMeeting = async (meeting: VideoMeeting) => {
    setSelectedMeeting(meeting);
    setChatMessages([]);
    if (meeting.recording_url) {
      loadVideoUrl(meeting.recording_url);
    } else {
      setVideoUrl(null);
    }

    // Load chat history
    const { data } = await (supabase as any)
      .from("meeting_chat_messages")
      .select("id, user_name, text, created_at")
      .eq("meeting_id", meeting.id)
      .order("created_at", { ascending: true });

    if (data) setChatMessages(data);
  };

  const endedMeetings = meetings.filter((m) => m.status === "ended");

  if (endedMeetings.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-6">
        No past video meetings yet
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {endedMeetings.map((meeting) => (
          <div
            key={meeting.id}
            className="border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => handleOpenMeeting(meeting)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{meeting.title}</h3>
                  {meeting.recording_url && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Play className="h-3 w-3" />
                      Recording
                    </Badge>
                  )}
                  {meeting.ai_summary && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <FileText className="h-3 w-3" />
                      AI Notes
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(meeting.created_at), "MMM d, yyyy")}
                  </span>
                  {meeting.ended_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(meeting.ended_at), "h:mm a")}
                    </span>
                  )}
                </div>
                {meeting.ai_summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {meeting.ai_summary}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" className="gap-1">
                <Play className="h-3 w-3" />
                View
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={!!selectedMeeting}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMeeting(null);
            setVideoUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              {selectedMeeting?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedMeeting && (
            <div className="space-y-6 mt-2">
              {/* Video Player */}
              {videoUrl && (
                <div className="rounded-lg overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    className="w-full max-h-[400px]"
                  />
                </div>
              )}

              {!videoUrl && !selectedMeeting.recording_url && (
                <div className="flex items-center justify-center py-8 bg-muted rounded-lg">
                  <p className="text-muted-foreground">No recording available</p>
                </div>
              )}

              {/* AI Summary */}
              {selectedMeeting.ai_summary && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Meeting Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">
                      {selectedMeeting.ai_summary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Key Points */}
              {selectedMeeting.ai_key_points &&
                selectedMeeting.ai_key_points.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Key Points
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-5 space-y-1">
                        {selectedMeeting.ai_key_points.map((point, i) => (
                          <li key={i} className="text-sm">
                            {point}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

              {/* To-Do List */}
              {selectedMeeting.ai_todo_list &&
                selectedMeeting.ai_todo_list.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ListTodo className="h-4 w-4" />
                        Action Items
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedMeeting.ai_todo_list.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 p-2 rounded hover:bg-muted/50"
                          >
                            <Checkbox checked={item.completed} disabled />
                            <div className="flex-1">
                              <p className="text-sm">{item.task}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {item.assignee}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

              {/* Chat History */}
              {chatMessages.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Chat History ({chatMessages.length} messages)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[300px]">
                      <div className="space-y-2">
                        {chatMessages.map((msg) => (
                          <div key={msg.id} className="flex gap-2 text-sm">
                            <span className="text-muted-foreground text-xs whitespace-nowrap pt-0.5">
                              {format(new Date(msg.created_at), "h:mm a")}
                            </span>
                            <div>
                              <span className="font-medium">{msg.user_name}: </span>
                              <span>{msg.text}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {selectedMeeting.recording_url &&
                !selectedMeeting.ai_summary && (
                  <Card className="border-dashed">
                    <CardContent className="py-4 text-center text-sm text-muted-foreground">
                      AI is still processing this meeting recording. Check back shortly.
                    </CardContent>
                  </Card>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
