import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare,
  Bot,
  Activity,
  StickyNote,
  Calendar,
  Play,
  Pause,
  Plus,
  Trash2,
  Edit,
  Pin,
  Clock,
  User,
  MapPin,
  Users,
  RefreshCw,
  Search,
  Volume2,
  Shield
} from "lucide-react";
import { Link } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { EmployeeSelector } from "@/components/admin/EmployeeSelector";
import { format } from "date-fns";
import { toast } from "sonner";

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

interface InternalNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

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

interface AuditLog {
  id: string;
  action: string;
  action_category: string;
  target_type: string | null;
  target_name: string | null;
  timestamp: string;
  result: string;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { hasOwnerAccess } = useUserRole();
  const [activeTab, setActiveTab] = useState("conversations");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [meetings, setMeetings] = useState<CompanyMeeting[]>([]);
  const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Selected user for viewing (owner/developer can view other employees)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);

  // Note dialog state
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<InternalNote | null>(null);
  const [noteForm, setNoteForm] = useState({ title: "", content: "", category: "general" });

  // Meeting dialog state
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<CompanyMeeting | null>(null);
  const [meetingForm, setMeetingForm] = useState({
    title: "",
    description: "",
    meeting_date: "",
    duration_minutes: "",
    location: "",
    meeting_type: "general",
    notes: "",
    attendees: ""
  });

  // Conversation detail dialog state
  const [conversationDialogOpen, setConversationDialogOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // The effective user ID to load data for
  const effectiveUserId = selectedUserId || user?.id;
  const isViewingOther = selectedUserId && selectedUserId !== user?.id;

  useEffect(() => {
    if (effectiveUserId) {
      loadData();
    }
  }, [effectiveUserId]);

  // Load selected user's name
  useEffect(() => {
    if (selectedUserId && selectedUserId !== user?.id) {
      loadSelectedUserName(selectedUserId);
    } else {
      setSelectedUserName(null);
    }
  }, [selectedUserId, user?.id]);

  const loadSelectedUserName = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle();

    setSelectedUserName(data?.full_name || "Unknown User");
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadConversations(),
        loadNotes(),
        loadMeetings(),
        loadActivityLogs()
      ]);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("user_id", effectiveUserId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Parse key_points from Json to string[]
    const parsed = (data || []).map(conv => ({
      ...conv,
      key_points: conv.key_points as string[] | null
    }));
    setConversations(parsed);
  };

  const loadNotes = async () => {
    const { data, error } = await supabase
      .from("internal_notes")
      .select("*")
      .eq("user_id", effectiveUserId)
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) throw error;
    setNotes(data || []);
  };

  const loadMeetings = async () => {
    const { data, error } = await supabase
      .from("company_meetings")
      .select("*")
      .eq("created_by", effectiveUserId)
      .order("meeting_date", { ascending: false });

    if (error) throw error;
    setMeetings(data || []);
  };

  const loadActivityLogs = async () => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, action_category, target_type, target_name, timestamp, result")
      .eq("actor_id", effectiveUserId)
      .order("timestamp", { ascending: false })
      .limit(100);

    if (error) throw error;
    setActivityLogs(data || []);
  };



  const getSignedAudioUrl = async (audioPath: string): Promise<string | null> => {
    try {
      // If it's already a public URL (e.g. legacy or other bucket), just return it
      if (audioPath.startsWith('http')) return audioPath;

      const { data, error } = await supabase.storage
        .from('audio-recordings')
        .createSignedUrl(audioPath, 3600); // 1 hour

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error("Failed to get signed URL:", error);
      return null;
    }
  };

  const handlePlayAudio = async (audioPath: string) => {
    // If clicking the same audio that is playing, toggle it
    if (playingAudio === audioPath) {
      if (audioRef.current?.paused) {
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        audioRef.current?.pause();
        setIsPlaying(false);
      }
      return;
    }

    // Playing a new file
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);

      const signedUrl = await getSignedAudioUrl(audioPath);
      if (!signedUrl) {
        toast.error("Failed to load audio");
        return;
      }

      audioRef.current.src = signedUrl;

      // Attempt to play
      try {
        await audioRef.current.play();
        setPlayingAudio(audioPath);
        setIsPlaying(true);
      } catch (e) {
        console.error("Playback error", e);
        toast.error("Failed to play audio");
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentAudioTime(audioRef.current.currentTime);
      setAudioDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentAudioTime(value[0]);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Note CRUD operations
  const handleSaveNote = async () => {
    if (!noteForm.title.trim() || !noteForm.content.trim()) {
      toast.error("Please fill in title and content");
      return;
    }

    try {
      if (editingNote) {
        const { error } = await supabase
          .from("internal_notes")
          .update({
            title: noteForm.title,
            content: noteForm.content,
            category: noteForm.category
          })
          .eq("id", editingNote.id);

        if (error) throw error;
        toast.success("Note updated");
      } else {
        const { error } = await supabase
          .from("internal_notes")
          .insert({
            user_id: user?.id,
            title: noteForm.title,
            content: noteForm.content,
            category: noteForm.category
          });

        if (error) throw error;
        toast.success("Note created");
      }

      setNoteDialogOpen(false);
      setEditingNote(null);
      setNoteForm({ title: "", content: "", category: "general" });
      loadNotes();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("internal_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      toast.success("Note deleted");
      loadNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Failed to delete note");
    }
  };

  const handleTogglePin = async (note: InternalNote) => {
    try {
      const { error } = await supabase
        .from("internal_notes")
        .update({ is_pinned: !note.is_pinned })
        .eq("id", note.id);

      if (error) throw error;
      loadNotes();
    } catch (error) {
      console.error("Error toggling pin:", error);
    }
  };

  const handleEditNote = (note: InternalNote) => {
    setEditingNote(note);
    setNoteForm({
      title: note.title,
      content: note.content,
      category: note.category
    });
    setNoteDialogOpen(true);
  };

  // Meeting CRUD operations
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
        const { error } = await supabase
          .from("company_meetings")
          .update(meetingData)
          .eq("id", editingMeeting.id);

        if (error) throw error;
        toast.success("Meeting updated");
      } else {
        const { error } = await supabase
          .from("company_meetings")
          .insert({
            ...meetingData,
            created_by: user?.id
          });

        if (error) throw error;
        toast.success("Meeting created");
      }

      setMeetingDialogOpen(false);
      setEditingMeeting(null);
      setMeetingForm({
        title: "",
        description: "",
        meeting_date: "",
        duration_minutes: "",
        location: "",
        meeting_type: "general",
        notes: "",
        attendees: ""
      });
      loadMeetings();
    } catch (error) {
      console.error("Error saving meeting:", error);
      toast.error("Failed to save meeting");
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from("company_meetings")
        .delete()
        .eq("id", meetingId);

      if (error) throw error;
      toast.success("Meeting deleted");
      loadMeetings();
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

  const filteredConversations = conversations.filter(conv =>
    conv.transcript.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMeetings = meetings.filter(meeting =>
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meeting.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLogs = activityLogs.filter(log =>
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.target_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <audio
        ref={audioRef}
        onEnded={() => {
          setPlayingAudio(null);
          setIsPlaying(false);
          setCurrentAudioTime(0);
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        className="hidden"
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {isViewingOther ? `${selectedUserName}'s Dashboard` : "Employee Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            {isViewingOther
              ? `Viewing ${selectedUserName}'s workspace and activity`
              : "Your personal workspace and activity overview"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {hasOwnerAccess() && (
            <EmployeeSelector
              selectedUserId={selectedUserId}
              onSelectUser={setSelectedUserId}
            />
          )}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Link to="/warranty">
            <Button variant="outline" size="sm" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Warranties</span>
            </Button>
          </Link>
          <Button variant="outline" size="icon" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{conversations.length}</p>
                <p className="text-xs text-muted-foreground">Conversations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <StickyNote className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{notes.length}</p>
                <p className="text-xs text-muted-foreground">Notes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{meetings.length}</p>
                <p className="text-xs text-muted-foreground">Meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Activity className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activityLogs.length}</p>
                <p className="text-xs text-muted-foreground">Activities</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="conversations" className="gap-2">
            <MessageSquare className="h-4 w-4 hidden sm:block" />
            Conversations
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <StickyNote className="h-4 w-4 hidden sm:block" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-2">
            <Calendar className="h-4 w-4 hidden sm:block" />
            Meetings
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4 hidden sm:block" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Conversations Tab */}
        <TabsContent value="conversations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Past Conversations & AI Interactions
              </CardTitle>
              <CardDescription>
                View all your recorded conversations and AI assistant interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredConversations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No conversations recorded yet</p>
              ) : (
                <div className="h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-4">
                    {filteredConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => {
                          setSelectedConversation(conv);
                          setConversationDialogOpen(true);
                        }}
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
                            {conv.summary && (
                              <p className="text-sm mb-2">{conv.summary}</p>
                            )}
                            {conv.key_points && conv.key_points.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {conv.key_points.map((point, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {point}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {conv.transcript}
                            </p>
                          </div>
                          {conv.audio_url && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlayAudio(conv.audio_url!);
                              }}
                            >
                              {playingAudio === conv.audio_url ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
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
                      <p className="text-sm border rounded-lg p-3 bg-muted/30">
                        {selectedConversation.summary}
                      </p>
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
                          onClick={() => handlePlayAudio(selectedConversation.audio_url!)}
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
                            onValueChange={handleSeek}
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
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <StickyNote className="h-5 w-5" />
                  Internal Notes
                </CardTitle>
                <CardDescription>
                  Your personal notes and reminders
                </CardDescription>
              </div>
              <Dialog open={noteDialogOpen} onOpenChange={(open) => {
                setNoteDialogOpen(open);
                if (!open) {
                  setEditingNote(null);
                  setNoteForm({ title: "", content: "", category: "general" });
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Note
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingNote ? "Edit Note" : "Create Note"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={noteForm.title}
                        onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                        placeholder="Note title..."
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={noteForm.category}
                        onValueChange={(value) => setNoteForm({ ...noteForm, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="todo">To-Do</SelectItem>
                          <SelectItem value="idea">Idea</SelectItem>
                          <SelectItem value="reminder">Reminder</SelectItem>
                          <SelectItem value="important">Important</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Content</Label>
                      <Textarea
                        value={noteForm.content}
                        onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                        placeholder="Write your note..."
                        rows={6}
                      />
                    </div>
                    <Button onClick={handleSaveNote} className="w-full">
                      {editingNote ? "Update Note" : "Save Note"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {filteredNotes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No notes yet. Create your first note!</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredNotes.map((note) => (
                    <Card key={note.id} className={note.is_pinned ? "border-primary" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {note.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                            <CardTitle className="text-base">{note.title}</CardTitle>
                          </div>
                          <Badge variant="outline" className="text-xs">{note.category}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-4 mb-3">
                          {note.content}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(note.updated_at), "MMM d, yyyy")}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleTogglePin(note)}
                            >
                              <Pin className={`h-4 w-4 ${note.is_pinned ? "text-primary" : ""}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditNote(note)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDeleteNote(note.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Company Meetings
                </CardTitle>
                <CardDescription>
                  View and manage company meeting records
                </CardDescription>
              </div>
              <Dialog open={meetingDialogOpen} onOpenChange={(open) => {
                setMeetingDialogOpen(open);
                if (!open) {
                  setEditingMeeting(null);
                  setMeetingForm({
                    title: "",
                    description: "",
                    meeting_date: "",
                    duration_minutes: "",
                    location: "",
                    meeting_type: "general",
                    notes: "",
                    attendees: ""
                  });
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Meeting
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingMeeting ? "Edit Meeting" : "Create Meeting"}</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[70vh]">
                    <div className="space-y-4 pt-4 pr-4">
                      <div>
                        <Label>Title *</Label>
                        <Input
                          value={meetingForm.title}
                          onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                          placeholder="Meeting title..."
                        />
                      </div>
                      <div>
                        <Label>Date & Time *</Label>
                        <Input
                          type="datetime-local"
                          value={meetingForm.meeting_date}
                          onChange={(e) => setMeetingForm({ ...meetingForm, meeting_date: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Duration (minutes)</Label>
                          <Input
                            type="number"
                            value={meetingForm.duration_minutes}
                            onChange={(e) => setMeetingForm({ ...meetingForm, duration_minutes: e.target.value })}
                            placeholder="60"
                          />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <Select
                            value={meetingForm.meeting_type}
                            onValueChange={(value) => setMeetingForm({ ...meetingForm, meeting_type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
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
                        <Input
                          value={meetingForm.location}
                          onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                          placeholder="Conference Room A / Zoom link..."
                        />
                      </div>
                      <div>
                        <Label>Attendees (comma-separated)</Label>
                        <Input
                          value={meetingForm.attendees}
                          onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
                          placeholder="John, Jane, Bob..."
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={meetingForm.description}
                          onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
                          placeholder="Meeting agenda..."
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label>Notes</Label>
                        <Textarea
                          value={meetingForm.notes}
                          onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                          placeholder="Meeting notes..."
                          rows={4}
                        />
                      </div>
                      <Button onClick={handleSaveMeeting} className="w-full">
                        {editingMeeting ? "Update Meeting" : "Save Meeting"}
                      </Button>
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {filteredMeetings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No meetings recorded yet</p>
              ) : (
                <ScrollArea className="h-[500px]">
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
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handlePlayAudio(meeting.audio_url!)}
                              >
                                {playingAudio === meeting.audio_url ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditMeeting(meeting)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => handleDeleteMeeting(meeting.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Your Activity Log
              </CardTitle>
              <CardDescription>
                Track your edits and actions in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No activity recorded yet</p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {filteredLogs.map((log) => (
                      <div key={log.id} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${log.result === 'success' ? 'bg-green-500' :
                          log.result === 'failure' ? 'bg-red-500' : 'bg-yellow-500'
                          }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{log.action}</span>
                            <Badge variant="outline" className="text-xs">{log.action_category}</Badge>
                          </div>
                          {log.target_name && (
                            <p className="text-sm text-muted-foreground truncate">
                              {log.target_type}: {log.target_name}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.timestamp), "MMM d, h:mm a")}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
