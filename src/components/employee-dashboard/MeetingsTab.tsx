import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar, Play, Pause, Plus, Trash2, Edit, Clock, MapPin, Users, Video,
} from "lucide-react";
import { CreateMeetingDropdown } from "@/components/video/CreateMeetingDropdown";
import { LiveMeetingsBanner } from "@/components/video/LiveMeetingsBanner";
import { MeetingRecordingPlayer } from "@/components/video/MeetingRecordingPlayer";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

interface CompanyMeeting {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  duration_minutes: number | null;
  location: string | null;
  meeting_type: string;
  notes: string | null;
  audio_url: string | null;
  attendees: string[] | null;
  created_by: string;
  created_at: string;
}

interface MeetingsTabProps {
  meetings: CompanyMeeting[];
  videoMeetings: any[];
  searchQuery: string;
  userId: string | undefined;
  playingAudio: string | null;
  onPlayAudio: (audioPath: string) => void;
  onRefreshMeetings: () => void;
  onRefreshVideoMeetings: () => void;
  onJoinVideoMeeting: (meetingId: string, title: string, isHost: boolean, code?: string) => void;
}

export function MeetingsTab({
  meetings,
  videoMeetings,
  searchQuery,
  userId,
  playingAudio,
  onPlayAudio,
  onRefreshMeetings,
  onRefreshVideoMeetings,
  onJoinVideoMeeting,
}: MeetingsTabProps) {
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<CompanyMeeting | null>(null);
  const [meetingForm, setMeetingForm] = useState({
    title: "", description: "", meeting_date: "", duration_minutes: "",
    location: "", meeting_type: "general", notes: "", attendees: ""
  });

  const filteredMeetings = meetings.filter(meeting =>
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meeting.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveMeeting = async () => {
    if (!meetingForm.title.trim() || !meetingForm.meeting_date) {
      toast.error("Please fill in title and date");
      return;
    }
    try {
      const meetingData = {
        title: meetingForm.title,
        description: meetingForm.description || null,
        meeting_date: meetingForm.meeting_date,
        duration_minutes: meetingForm.duration_minutes ? parseInt(meetingForm.duration_minutes) : null,
        location: meetingForm.location || null,
        meeting_type: meetingForm.meeting_type,
        notes: meetingForm.notes || null,
        attendees: meetingForm.attendees ? meetingForm.attendees.split(',').map(a => a.trim()) : null
      };

      if (editingMeeting) {
        const { error } = await supabase.from("company_meetings").update(meetingData).eq("id", editingMeeting.id);
        if (error) throw error;
        toast.success("Meeting updated");
      } else {
        const { error } = await supabase.from("company_meetings").insert({ ...meetingData, created_by: userId });
        if (error) throw error;
        toast.success("Meeting created");
      }

      setMeetingDialogOpen(false);
      setEditingMeeting(null);
      setMeetingForm({ title: "", description: "", meeting_date: "", duration_minutes: "", location: "", meeting_type: "general", notes: "", attendees: "" });
      onRefreshMeetings();
    } catch (error) {
      console.error("Error saving meeting:", error);
      toast.error("Failed to save meeting");
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase.from("company_meetings").delete().eq("id", meetingId);
      if (error) throw error;
      toast.success("Meeting deleted");
      onRefreshMeetings();
    } catch (error) {
      console.error("Error deleting meeting:", error);
      toast.error("Failed to delete meeting");
    }
  };

  const handleEditMeeting = (meeting: CompanyMeeting) => {
    setEditingMeeting(meeting);
    setMeetingForm({
      title: meeting.title,
      description: meeting.description || "",
      meeting_date: meeting.meeting_date.slice(0, 16),
      duration_minutes: meeting.duration_minutes?.toString() || "",
      location: meeting.location || "",
      meeting_type: meeting.meeting_type,
      notes: meeting.notes || "",
      attendees: meeting.attendees?.join(", ") || ""
    });
    setMeetingDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <LiveMeetingsBanner
        onJoinMeeting={async (meetingId, title) => {
          const { data } = await (supabase as any).from("video_meetings").select("meeting_code").eq("id", meetingId).maybeSingle();
          onJoinVideoMeeting(meetingId, title, false, data?.meeting_code);
        }}
      />

      {/* Video Meetings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video Meetings
            </CardTitle>
            <CardDescription>Create, join, and rewatch video meetings with AI notes</CardDescription>
          </div>
          <CreateMeetingDropdown
            onMeetingCreated={async (meetingId, title) => {
              const { data } = await (supabase as any).from("video_meetings").select("meeting_code").eq("id", meetingId).maybeSingle();
              onJoinVideoMeeting(meetingId, title, true, data?.meeting_code);
            }}
          />
        </CardHeader>
        <CardContent>
          <MeetingRecordingPlayer meetings={videoMeetings} onRefresh={onRefreshVideoMeetings} />
        </CardContent>
      </Card>

      {/* Company Meetings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Company Meetings
            </CardTitle>
            <CardDescription>View and manage company meeting records</CardDescription>
          </div>
          <Dialog open={meetingDialogOpen} onOpenChange={(open) => {
            setMeetingDialogOpen(open);
            if (!open) {
              setEditingMeeting(null);
              setMeetingForm({ title: "", description: "", meeting_date: "", duration_minutes: "", location: "", meeting_type: "general", notes: "", attendees: "" });
            }
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Meeting</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingMeeting ? "Edit Meeting" : "Create Meeting"}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh]">
                <div className="space-y-4 pt-4 pr-4">
                  <div>
                    <Label>Title *</Label>
                    <Input value={meetingForm.title} onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })} placeholder="Meeting title..." />
                  </div>
                  <div>
                    <Label>Date & Time *</Label>
                    <Input type="datetime-local" value={meetingForm.meeting_date} onChange={(e) => setMeetingForm({ ...meetingForm, meeting_date: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Duration (minutes)</Label>
                      <Input type="number" value={meetingForm.duration_minutes} onChange={(e) => setMeetingForm({ ...meetingForm, duration_minutes: e.target.value })} placeholder="60" />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={meetingForm.meeting_type} onValueChange={(value) => setMeetingForm({ ...meetingForm, meeting_type: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="standup">Standup</SelectItem>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="training">Training</SelectItem>
                          <SelectItem value="one-on-one">One-on-One</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input value={meetingForm.location} onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })} placeholder="Conference Room A / Zoom link..." />
                  </div>
                  <div>
                    <Label>Attendees (comma-separated)</Label>
                    <Input value={meetingForm.attendees} onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })} placeholder="John, Jane, Bob..." />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={meetingForm.description} onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })} placeholder="Meeting agenda..." rows={3} />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={meetingForm.notes} onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })} placeholder="Meeting notes..." rows={4} />
                  </div>
                  <Button onClick={handleSaveMeeting} className="w-full">{editingMeeting ? "Update Meeting" : "Save Meeting"}</Button>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {filteredMeetings.length === 0 ? (
            <EmptyState icon={Calendar} title="No meetings recorded yet" description="Create a meeting to track company discussions" />
          ) : (
            <div className="h-[500px] overflow-y-auto">
              <div className="space-y-4">
                {filteredMeetings.map((meeting) => (
                  <div key={meeting.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{meeting.title}</h3>
                          <Badge variant="outline">{meeting.meeting_type}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(meeting.meeting_date), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          {meeting.duration_minutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {meeting.duration_minutes} min
                            </span>
                          )}
                          {meeting.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {meeting.location}
                            </span>
                          )}
                        </div>
                        {meeting.attendees && meeting.attendees.length > 0 && (
                          <div className="flex items-center gap-1 text-sm">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {meeting.attendees.join(", ")}
                          </div>
                        )}
                        {meeting.description && (
                          <p className="text-sm text-muted-foreground">{meeting.description}</p>
                        )}
                        {meeting.notes && (
                          <div className="bg-muted/50 p-3 rounded text-sm mt-2">
                            <p className="font-medium mb-1">Notes:</p>
                            <p className="text-muted-foreground">{meeting.notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {meeting.audio_url && (
                          <Button variant="outline" size="icon" onClick={() => onPlayAudio(meeting.audio_url!)}>
                            {playingAudio === meeting.audio_url ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleEditMeeting(meeting)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMeeting(meeting.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
