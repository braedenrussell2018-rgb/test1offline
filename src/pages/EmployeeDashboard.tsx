import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, StickyNote, Calendar, RefreshCw, Search, Shield, CalendarDays,
} from "lucide-react";
import { MeetingLobby } from "@/components/video/MeetingLobby";
import { VideoMeetingRoom } from "@/components/video/VideoMeetingRoom";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { EmployeeSelector } from "@/components/admin/EmployeeSelector";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { ConversationsTab } from "@/components/employee-dashboard/ConversationsTab";
import { NotesTab } from "@/components/employee-dashboard/NotesTab";
import { MeetingsTab } from "@/components/employee-dashboard/MeetingsTab";
import { CalendarTab } from "@/components/employee-dashboard/CalendarTab";

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

function DashboardSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
    </div>
  );
}

function EmployeeDashboardContent() {
  const { user } = useAuth();
  const { hasOwnerAccess } = useUserRole();
  const [activeTab, setActiveTab] = useState("conversations");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [meetings, setMeetings] = useState<CompanyMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userName, setUserNameLocal] = useState("Unknown");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);

  const [activeVideoMeeting, setActiveVideoMeeting] = useState<{ id: string; title: string; isHost: boolean } | null>(null);
  const [pendingMeeting, setPendingMeeting] = useState<{ id: string; title: string; isHost: boolean; code?: string } | null>(null);
  const [videoMeetings, setVideoMeetings] = useState<any[]>([]);

  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const effectiveUserId = selectedUserId || user?.id;
  const isViewingOther = selectedUserId && selectedUserId !== user?.id;

  useEffect(() => {
    if (user?.id) {
      supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => { if (data?.full_name) setUserNameLocal(data.full_name); });
    }
  }, [user?.id]);

  useEffect(() => {
    if (effectiveUserId) loadData();
  }, [effectiveUserId]);

  useEffect(() => {
    if (selectedUserId && selectedUserId !== user?.id) {
      supabase.from("profiles").select("full_name").eq("user_id", selectedUserId).maybeSingle()
        .then(({ data }) => setSelectedUserName(data?.full_name || "Unknown User"));
    } else {
      setSelectedUserName(null);
    }
  }, [selectedUserId, user?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadConversations(), loadNotes(), loadMeetings(), loadVideoMeetings()]);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("ai_conversations").select("*").eq("user_id", effectiveUserId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    setConversations((data || []).map(conv => ({ ...conv, key_points: conv.key_points as string[] | null })));
  };

  const loadNotes = async () => {
    const { data, error } = await supabase
      .from("internal_notes").select("*").eq("user_id", effectiveUserId)
      .order("is_pinned", { ascending: false }).order("updated_at", { ascending: false });
    if (error) throw error;
    setNotes(data || []);
  };

  const loadMeetings = async () => {
    const { data, error } = await supabase
      .from("company_meetings").select("*").eq("created_by", effectiveUserId)
      .order("meeting_date", { ascending: false });
    if (error) throw error;
    setMeetings(data || []);
  };

  const loadVideoMeetings = async () => {
    const { data, error } = await (supabase as any)
      .from("video_meetings").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    setVideoMeetings(data || []);
  };

  const getSignedAudioUrl = async (audioPath: string): Promise<string | null> => {
    try {
      if (audioPath.startsWith('http')) return audioPath;
      const { data, error } = await supabase.storage.from('audio-recordings').createSignedUrl(audioPath, 3600);
      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error("Failed to get signed URL:", error);
      return null;
    }
  };

  const handlePlayAudio = async (audioPath: string) => {
    if (playingAudio === audioPath) {
      if (audioRef.current?.paused) { audioRef.current.play(); setIsPlaying(true); }
      else { audioRef.current?.pause(); setIsPlaying(false); }
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      const signedUrl = await getSignedAudioUrl(audioPath);
      if (!signedUrl) { toast.error("Failed to load audio"); return; }
      audioRef.current.src = signedUrl;
      try { await audioRef.current.play(); setPlayingAudio(audioPath); setIsPlaying(true); }
      catch (e) { console.error("Playback error", e); toast.error("Failed to play audio"); }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentAudioTime(audioRef.current.currentTime);
      setAudioDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) { audioRef.current.currentTime = value[0]; setCurrentAudioTime(value[0]); }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleJoinVideoMeeting = (meetingId: string, title: string, isHost: boolean, code?: string) => {
    setPendingMeeting({ id: meetingId, title, isHost, code });
  };

  if (pendingMeeting) {
    return (
      <MeetingLobby
        meetingTitle={pendingMeeting.title}
        meetingCode={pendingMeeting.code}
        displayName={userName}
        onJoin={() => { setActiveVideoMeeting(pendingMeeting); setPendingMeeting(null); }}
        onCancel={() => setPendingMeeting(null)}
      />
    );
  }

  if (activeVideoMeeting) {
    return (
      <VideoMeetingRoom
        meetingId={activeVideoMeeting.id}
        meetingTitle={activeVideoMeeting.title}
        isHost={activeVideoMeeting.isHost}
        onLeave={() => { setActiveVideoMeeting(null); loadVideoMeetings(); }}
      />
    );
  }

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <audio
        ref={audioRef}
        onEnded={() => { setPlayingAudio(null); setIsPlaying(false); setCurrentAudioTime(0); }}
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
            {isViewingOther ? `Viewing ${selectedUserName}'s workspace and activity` : "Your personal workspace and activity overview"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {hasOwnerAccess() && (
            <EmployeeSelector selectedUserId={selectedUserId} onSelectUser={setSelectedUserId} />
          )}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
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
              <div className="p-2 rounded-lg bg-blue-500/10"><MessageSquare className="h-5 w-5 text-blue-500" /></div>
              <div><p className="text-2xl font-bold">{conversations.length}</p><p className="text-xs text-muted-foreground">Conversations</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><StickyNote className="h-5 w-5 text-green-500" /></div>
              <div><p className="text-2xl font-bold">{notes.length}</p><p className="text-xs text-muted-foreground">Notes</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10"><Calendar className="h-5 w-5 text-purple-500" /></div>
              <div><p className="text-2xl font-bold">{meetings.length}</p><p className="text-xs text-muted-foreground">Meetings</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10"><CalendarDays className="h-5 w-5 text-orange-500" /></div>
              <div><p className="text-2xl font-bold">Schedule</p><p className="text-xs text-muted-foreground">Calendar</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="conversations" className="gap-2">
            <MessageSquare className="h-4 w-4 hidden sm:block" /> Conversations
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <StickyNote className="h-4 w-4 hidden sm:block" /> Notes
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-2">
            <Calendar className="h-4 w-4 hidden sm:block" /> Meetings
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="h-4 w-4 hidden sm:block" /> Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations">
          <ConversationsTab
            conversations={conversations}
            searchQuery={searchQuery}
            playingAudio={playingAudio}
            isPlaying={isPlaying}
            currentAudioTime={currentAudioTime}
            audioDuration={audioDuration}
            onPlayAudio={handlePlayAudio}
            onSeek={handleSeek}
            formatDuration={formatDuration}
          />
        </TabsContent>

        <TabsContent value="notes">
          <NotesTab
            notes={notes}
            searchQuery={searchQuery}
            userId={user?.id}
            onRefresh={loadNotes}
          />
        </TabsContent>

        <TabsContent value="meetings">
          <MeetingsTab
            meetings={meetings}
            videoMeetings={videoMeetings}
            searchQuery={searchQuery}
            userId={user?.id}
            playingAudio={playingAudio}
            onPlayAudio={handlePlayAudio}
            onRefreshMeetings={loadMeetings}
            onRefreshVideoMeetings={loadVideoMeetings}
            onJoinVideoMeeting={handleJoinVideoMeeting}
          />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarTab onJoinVideoMeeting={handleJoinVideoMeeting} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function EmployeeDashboard() {
  return (
    <ErrorBoundary>
      <EmployeeDashboardContent />
    </ErrorBoundary>
  );
}
