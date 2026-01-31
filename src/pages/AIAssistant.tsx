import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useLocalWhisper } from "@/hooks/useLocalWhisper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Mic, 
  MicOff, 
  Send, 
  User, 
  Clock, 
  MessageSquare,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  Building2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  Users,
  Cpu,
  Zap
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Contact {
  id: string;
  name: string;
  company_id?: string;
  email?: string;
  phone?: string;
}

interface Company {
  id: string;
  name: string;
}

interface Conversation {
  id: string;
  transcript: string;
  summary?: string;
  key_points?: string[];
  contact_id?: string;
  created_at: string;
  duration_seconds?: number;
  audio_url?: string;
}

interface AIAnalysis {
  matchedContactId: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'no_match';
  suggestedNewContact: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
  } | null;
  summary: string;
  keyPoints: string[];
}

export default function AIAssistant() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("record");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [manualTranscript, setManualTranscript] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<AIAnalysis | null>(null);
  const [showContactConfirm, setShowContactConfirm] = useState(false);
  const [selectedContactOverride, setSelectedContactOverride] = useState<string | null>(null);
  const [pendingAudioBlob, setPendingAudioBlob] = useState<Blob | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [saveAsType, setSaveAsType] = useState<"contact" | "internal_meeting">("contact");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [slowDeviceMode, setSlowDeviceMode] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('ai-assistant-slow-device');
    return saved === 'true';
  });
  
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  const {
    isListening,
    isSupported: speechSupported,
    transcript: speechTranscript,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const {
    isRecording: isAudioRecording,
    audioBlob,
    audioUrl: localAudioUrl,
    duration: recordingDuration,
    error: audioError,
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    resetRecording,
  } = useAudioRecorder();

  const {
    isLoading: isWhisperLoading,
    isModelLoaded: isWhisperLoaded,
    loadProgress: whisperLoadProgress,
    transcript: whisperTranscript,
    isTranscribing,
    error: whisperError,
    loadModel: loadWhisperModel,
    transcribeAudio,
    resetTranscript: resetWhisperTranscript,
  } = useLocalWhisper();

  // Load whisper model on mount if not in slow device mode
  useEffect(() => {
    if (!slowDeviceMode) {
      loadWhisperModel();
    }
  }, [slowDeviceMode, loadWhisperModel]);

  // Save slow device preference
  useEffect(() => {
    localStorage.setItem('ai-assistant-slow-device', String(slowDeviceMode));
  }, [slowDeviceMode]);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadContacts();
      loadCompanies();
    }
  }, [user]);

  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  useEffect(() => {
    if (audioError) {
      toast.error(audioError);
    }
  }, [audioError]);

  // Cleanup audio player on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setConversations(data as Conversation[]);
    }
  };

  const loadContacts = async () => {
    const { data, error } = await supabase
      .from("people")
      .select("id, name, company_id, email, phone");

    if (!error && data) {
      setContacts(data);
    }
  };

  const loadCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name");

    if (!error && data) {
      setCompanies(data);
    }
  };

  const handleStartRecording = async () => {
    resetTranscript();
    resetWhisperTranscript();
    resetRecording();
    setManualTranscript("");
    
    // In slow device mode, use Web Speech API for real-time transcription
    // Otherwise, we'll transcribe with Whisper after recording stops
    if (slowDeviceMode && speechSupported) {
      startListening();
    }
    
    await startAudioRecording();
    toast.info("Recording started...");
  };

  const handleStopRecording = async () => {
    stopListening();
    stopAudioRecording();
    toast.success("Recording stopped");
    
    // If not in slow device mode, transcribe with local Whisper
    if (!slowDeviceMode && isWhisperLoaded && audioBlob) {
      toast.info("Transcribing with local AI...");
      try {
        await transcribeAudio(audioBlob);
        toast.success("Transcription complete");
      } catch (err) {
        console.error("Whisper transcription failed:", err);
        toast.error("Transcription failed. You can type notes manually.");
      }
    }
  };

  // Transcribe when audio blob is ready and not in slow mode
  useEffect(() => {
    if (!slowDeviceMode && isWhisperLoaded && audioBlob && !isAudioRecording && !isTranscribing) {
      transcribeAudio(audioBlob).catch(console.error);
    }
  }, [audioBlob, isAudioRecording, slowDeviceMode, isWhisperLoaded]);

  const uploadAudio = async (blob: Blob): Promise<string | null> => {
    if (!user) return null;
    
    setIsUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}.webm`;
      
      const { data, error } = await supabase.storage
        .from('audio-recordings')
        .upload(fileName, blob, {
          contentType: 'audio/webm',
          upsert: false,
        });

      if (error) {
        console.error("Upload error:", error);
        throw error;
      }

      // Store the file path for later signed URL generation
      // We store just the path, not a public URL, since bucket is now private
      return fileName;
    } catch (error) {
      console.error("Audio upload failed:", error);
      toast.error("Failed to upload audio");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Get a signed URL for audio playback (1 hour expiration)
  const getSignedAudioUrl = async (audioPath: string): Promise<string | null> => {
    try {
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

  const getCurrentTranscript = () => {
    return manualTranscript || speechTranscript || "";
  };

  const analyzeTranscript = async (transcriptText: string) => {
    if (!transcriptText.trim()) {
      toast.error("Please record or enter a transcript first");
      return;
    }

    setIsProcessing(true);
    
    try {
      const contactsForAI = contacts.map(c => ({
        id: c.id,
        name: c.name,
        company: companies.find(co => co.id === c.company_id)?.name,
        email: c.email,
        phone: c.phone,
      }));

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'analyze_transcript',
          transcript: transcriptText,
          contacts: contactsForAI,
        },
      });

      if (error) {
        console.error("Function error:", error);
        throw new Error("Failed to call AI assistant");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const analysis: AIAnalysis = data;
      setPendingAnalysis(analysis);
      
      // Store pending data for contact confirmation
      sessionStorage.setItem('pendingTranscript', transcriptText);
      sessionStorage.setItem('pendingDuration', String(recordingDuration || 0));
      
      // Store audio blob for upload after confirmation
      if (audioBlob) {
        setPendingAudioBlob(audioBlob);
      }
      
      setShowContactConfirm(true);

    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to analyze transcript");
    } finally {
      setIsProcessing(false);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  
  const confirmContactMatch = async (contactId: string | null, createNew: boolean = false) => {
    // Prevent duplicate saves
    if (isSaving) return;
    setIsSaving(true);
    
    const transcriptText = sessionStorage.getItem('pendingTranscript') || getCurrentTranscript();
    const duration = parseInt(sessionStorage.getItem('pendingDuration') || '0');
    
    let finalContactId = contactId;
    let audioUrl: string | null = null;

    // Upload audio if available
    if (pendingAudioBlob) {
      audioUrl = await uploadAudio(pendingAudioBlob);
    }

    // Use override if selected
    if (selectedContactOverride) {
      finalContactId = selectedContactOverride;
    }

    // Create new contact if requested
    if (createNew && pendingAnalysis?.suggestedNewContact) {
      const { name, company, email, phone } = pendingAnalysis.suggestedNewContact;
      
      // Find or create company
      let companyId = null;
      if (company) {
        const existingCompany = companies.find(c => 
          c.name.toLowerCase() === company.toLowerCase()
        );
        
        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          const { data: newCompany } = await supabase
            .from("companies")
            .insert({ name: company })
            .select()
            .single();
          
          if (newCompany) {
            companyId = newCompany.id;
            setCompanies([...companies, newCompany]);
          }
        }
      }

      const { data: newContact, error } = await supabase
        .from("people")
        .insert({
          name,
          company_id: companyId,
          email,
          phone,
          user_id: user?.id,
        })
        .select()
        .single();

      if (!error && newContact) {
        finalContactId = newContact.id;
        setContacts([...contacts, newContact]);
        toast.success(`Created new contact: ${name}`);
      }
    }

    // Save conversation
    const { error } = await supabase
      .from("ai_conversations")
      .insert({
        user_id: user?.id,
        contact_id: finalContactId,
        transcript: transcriptText,
        summary: pendingAnalysis?.summary,
        key_points: pendingAnalysis?.keyPoints,
        duration_seconds: duration,
        audio_url: audioUrl,
      });

    if (error) {
      toast.error("Failed to save conversation");
    } else {
      toast.success("Conversation saved!");
      loadConversations();
    }

    // Cleanup
    setShowContactConfirm(false);
    setPendingAnalysis(null);
    setPendingAudioBlob(null);
    setManualTranscript("");
    resetTranscript();
    resetRecording();
    setSelectedContactOverride(null);
    setSaveAsType("contact");
    setMeetingTitle("");
    sessionStorage.removeItem('pendingTranscript');
    sessionStorage.removeItem('pendingDuration');
    setIsSaving(false);
  };

  const saveAsInternalMeeting = async () => {
    if (isSaving) return;
    if (!meetingTitle.trim()) {
      toast.error("Please enter a meeting title");
      return;
    }
    
    setIsSaving(true);
    
    const transcriptText = sessionStorage.getItem('pendingTranscript') || getCurrentTranscript();
    const duration = parseInt(sessionStorage.getItem('pendingDuration') || '0');
    
    let audioUrl: string | null = null;

    // Upload audio if available
    if (pendingAudioBlob) {
      audioUrl = await uploadAudio(pendingAudioBlob);
    }

    // Save as company meeting
    const { error } = await supabase
      .from("company_meetings")
      .insert({
        created_by: user?.id,
        title: meetingTitle,
        description: pendingAnalysis?.summary || null,
        meeting_date: new Date().toISOString(),
        duration_minutes: Math.ceil(duration / 60),
        meeting_type: "internal",
        notes: transcriptText,
        audio_url: audioUrl,
      });

    if (error) {
      console.error("Error saving meeting:", error);
      toast.error("Failed to save internal meeting");
    } else {
      toast.success("Internal meeting saved to dashboard!");
    }

    // Cleanup
    setShowContactConfirm(false);
    setPendingAnalysis(null);
    setPendingAudioBlob(null);
    setManualTranscript("");
    resetTranscript();
    resetRecording();
    setSelectedContactOverride(null);
    setSaveAsType("contact");
    setMeetingTitle("");
    sessionStorage.removeItem('pendingTranscript');
    sessionStorage.removeItem('pendingDuration');
    setIsSaving(false);
  };

  const askQuestion = async () => {
    if (!question.trim()) return;

    const userQuestion = question;
    setQuestion("");
    setChatHistory(prev => [...prev, { role: 'user', content: userQuestion }]);
    setIsAsking(true);

    try {
      const conversationIds = conversations.map(c => c.id);

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'ask_question',
          question: userQuestion,
          conversationIds,
        },
      });

      if (error) {
        throw new Error("Failed to call AI assistant");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: data.answer }]);

    } catch (error) {
      console.error("Question error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to get answer");
      setChatHistory(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't process that question. Please try again." }]);
    } finally {
      setIsAsking(false);
    }
  };

  const deleteConversation = async (id: string, audioUrl?: string) => {
    // Delete audio file if exists
    if (audioUrl && user) {
      try {
        const urlParts = audioUrl.split('/');
        const filePath = `${user.id}/${urlParts[urlParts.length - 1]}`;
        await supabase.storage.from('audio-recordings').remove([filePath]);
      } catch (e) {
        console.error("Failed to delete audio file:", e);
      }
    }

    const { error } = await supabase
      .from("ai_conversations")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete conversation");
    } else {
      toast.success("Conversation deleted");
      setConversations(prev => prev.filter(c => c.id !== id));
    }
  };

  const playAudio = async (conversationId: string, audioPath: string) => {
    // Stop current audio if playing
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    if (playingAudioId === conversationId) {
      setPlayingAudioId(null);
      return;
    }

    // Get signed URL for private audio file
    const signedUrl = await getSignedAudioUrl(audioPath);
    if (!signedUrl) {
      toast.error("Failed to load audio");
      return;
    }

    const audio = new Audio(signedUrl);
    audioPlayerRef.current = audio;
    
    audio.onended = () => {
      setPlayingAudioId(null);
      audioPlayerRef.current = null;
    };

    audio.onerror = () => {
      toast.error("Failed to play audio");
      setPlayingAudioId(null);
      audioPlayerRef.current = null;
    };

    audio.play();
    setPlayingAudioId(conversationId);
  };

  const getContactName = (contactId?: string) => {
    if (!contactId) return "Unassigned";
    const contact = contacts.find(c => c.id === contactId);
    return contact?.name || "Unknown";
  };

  const getCompanyName = (contactId?: string) => {
    if (!contactId) return "";
    const contact = contacts.find(c => c.id === contactId);
    if (!contact?.company_id) return "";
    const company = companies.find(c => c.id === contact.company_id);
    return company?.name || "";
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayTranscript = slowDeviceMode 
    ? speechTranscript + (interimTranscript ? ` ${interimTranscript}` : '')
    : whisperTranscript || speechTranscript + (interimTranscript ? ` ${interimTranscript}` : '');
  const isRecording = isAudioRecording || isListening;
  const activeTranscript = slowDeviceMode ? speechTranscript : (whisperTranscript || speechTranscript);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Assistant</h1>
            <p className="text-muted-foreground">Voice-powered note taking for sales calls</p>
          </div>
        </div>

        {/* Browser Support Warning */}
        {!speechSupported && (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Speech recognition not supported</p>
                <p className="text-sm text-muted-foreground">
                  Live transcription unavailable. Audio will still be recorded and you can type notes manually.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="record">
              <Mic className="h-4 w-4 mr-2" />
              Record
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="ask">
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask AI
            </TabsTrigger>
          </TabsList>

          {/* Record Tab */}
          <TabsContent value="record" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Record Conversation</CardTitle>
                    <CardDescription>
                      {slowDeviceMode 
                        ? "Using Web Speech API for real-time transcription"
                        : "Using local Whisper AI for high-quality transcription"
                      }
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">Local AI</span>
                    </div>
                    <Switch
                      checked={slowDeviceMode}
                      onCheckedChange={setSlowDeviceMode}
                      aria-label="Toggle slow device mode"
                    />
                    <div className="flex items-center gap-2 text-sm">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Slow Device</span>
                    </div>
                  </div>
                </div>
                
                {/* Whisper Loading Progress */}
                {!slowDeviceMode && isWhisperLoading && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading AI model... {whisperLoadProgress}%</span>
                    </div>
                    <Progress value={whisperLoadProgress} className="h-2" />
                  </div>
                )}
                
                {/* Whisper Error */}
                {whisperError && !slowDeviceMode && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>{whisperError}</span>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Recording Button */}
                <div className="flex flex-col items-center space-y-4">
                  <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    className="h-24 w-24 rounded-full"
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    disabled={isProcessing || isUploading || isTranscribing || (!slowDeviceMode && isWhisperLoading)}
                  >
                    {isProcessing || isUploading || isTranscribing ? (
                      <Loader2 className="h-10 w-10 animate-spin" />
                    ) : isRecording ? (
                      <MicOff className="h-10 w-10" />
                    ) : (
                      <Mic className="h-10 w-10" />
                    )}
                  </Button>
                  
                  <p className="text-sm text-muted-foreground">
                    {isProcessing ? "Processing..." 
                      : isUploading ? "Uploading..." 
                      : isTranscribing ? "Transcribing audio..."
                      : (!slowDeviceMode && isWhisperLoading) ? "Loading AI model..."
                      : isRecording ? "Recording... Click to stop" 
                      : "Click to start recording"}
                  </p>
                  
                  {isRecording && (
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                      </span>
                      <span className="text-lg font-mono font-medium text-destructive">
                        {formatDuration(recordingDuration)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Audio Preview */}
                {localAudioUrl && !isRecording && (
                  <div className="flex items-center justify-center gap-4 p-4 bg-muted rounded-lg">
                    <Volume2 className="h-5 w-5 text-muted-foreground" />
                    <audio src={localAudioUrl} controls className="flex-1 max-w-md" />
                    <Button variant="ghost" size="sm" onClick={resetRecording}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Live Transcript Display */}
                {(displayTranscript || isRecording || isTranscribing) && (slowDeviceMode ? speechSupported : true) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label>
                          {slowDeviceMode ? "Live Transcript" : "Transcript"}
                        </Label>
                        {isTranscribing && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Transcribing...
                          </Badge>
                        )}
                      </div>
                      {displayTranscript && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            resetTranscript();
                            resetWhisperTranscript();
                          }}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="p-4 bg-muted rounded-lg min-h-[100px]">
                      <p className="text-foreground">
                        {slowDeviceMode ? (
                          <>
                            {speechTranscript}
                            {interimTranscript && (
                              <span className="text-muted-foreground italic"> {interimTranscript}</span>
                            )}
                          </>
                        ) : (
                          whisperTranscript || speechTranscript
                        )}
                        {!displayTranscript && isRecording && (
                          <span className="text-muted-foreground italic">
                            {slowDeviceMode ? "Waiting for speech..." : "Recording... transcript will appear when stopped"}
                          </span>
                        )}
                        {!displayTranscript && isTranscribing && (
                          <span className="text-muted-foreground italic">Processing audio with local AI...</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Manual Transcript Entry */}
                <div className="space-y-2">
                  <Label>Notes {(speechSupported || isWhisperLoaded) ? "(or edit transcript)" : ""}</Label>
                  <Textarea 
                    value={manualTranscript || activeTranscript} 
                    onChange={(e) => setManualTranscript(e.target.value)}
                    rows={6}
                    placeholder="Type or paste your conversation notes here..."
                    className="resize-none"
                  />
                </div>

                {/* Analyze Button */}
                <Button 
                  onClick={() => analyzeTranscript(manualTranscript || activeTranscript)}
                  disabled={isProcessing || isUploading || isTranscribing || (!manualTranscript && !activeTranscript)}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading Audio...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Analyze & Save Conversation
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Conversation History</CardTitle>
                <CardDescription>
                  {conversations.length} recorded conversation{conversations.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {conversations.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No conversations yet. Start by recording one!
                      </p>
                    ) : (
                      conversations.map((conv) => (
                        <Card key={conv.id} className="border">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{getContactName(conv.contact_id)}</span>
                                {getCompanyName(conv.contact_id) && (
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {getCompanyName(conv.contact_id)}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(conv.created_at).toLocaleString()}
                                </span>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => deleteConversation(conv.id, conv.audio_url)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Audio Player */}
                            {conv.audio_url && (
                              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => playAudio(conv.id, conv.audio_url!)}
                                  className="gap-2"
                                >
                                  {playingAudioId === conv.id ? (
                                    <>
                                      <Pause className="h-4 w-4" />
                                      Pause
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-4 w-4" />
                                      Play Audio
                                    </>
                                  )}
                                </Button>
                                {conv.duration_seconds && conv.duration_seconds > 0 && (
                                  <span className="text-sm text-muted-foreground">
                                    {formatDuration(conv.duration_seconds)}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {conv.summary && (
                              <p className="text-sm text-foreground">{conv.summary}</p>
                            )}
                            
                            {conv.key_points && Array.isArray(conv.key_points) && conv.key_points.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {(conv.key_points as string[]).map((point, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {point}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <details className="text-sm">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                View full transcript
                              </summary>
                              <p className="mt-2 p-2 bg-muted rounded text-foreground whitespace-pre-wrap">
                                {conv.transcript}
                              </p>
                            </details>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ask AI Tab */}
          <TabsContent value="ask" className="space-y-4">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle>Ask About Conversations</CardTitle>
                <CardDescription>
                  Ask questions about your {conversations.length} recorded conversation{conversations.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ScrollArea className="flex-1 mb-4">
                  <div className="space-y-4">
                    {chatHistory.length === 0 ? (
                      <div className="text-center py-8 space-y-4">
                        <p className="text-muted-foreground">
                          Ask me anything about your past conversations!
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuestion("What are the main topics discussed across all my conversations?")}
                          >
                            Main topics discussed?
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuestion("Which contacts mentioned pricing or budget?")}
                          >
                            Who mentioned budget?
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuestion("What follow-up actions were mentioned?")}
                          >
                            Follow-up actions?
                          </Button>
                        </div>
                      </div>
                    ) : (
                      chatHistory.map((msg, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground ml-8'
                              : 'bg-muted mr-8'
                          }`}
                        >
                          {msg.role === 'assistant' ? (
                            <div className="whitespace-pre-wrap">
                              {msg.content.split('\n').map((line, lineIdx) => {
                                // Render source indicators with styling
                                if (line.includes('**Source:')) {
                                  const sourceMatch = line.match(/\*\*Source: (.+?)\*\*/);
                                  if (sourceMatch) {
                                    const emoji = line.startsWith('📁🌐') ? '📁🌐' : line.startsWith('📁') ? '📁' : '🌐';
                                    return (
                                      <div key={lineIdx} className="font-semibold text-primary mb-2 pb-2 border-b border-border">
                                        {emoji} Source: {sourceMatch[1]}
                                      </div>
                                    );
                                  }
                                }
                                // Render regular lines
                                return <span key={lineIdx}>{line}{lineIdx < msg.content.split('\n').length - 1 ? '\n' : ''}</span>;
                              })}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      ))
                    )}
                    {isAsking && (
                      <div className="flex items-center gap-2 text-muted-foreground mr-8 p-3 bg-muted rounded-lg">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking...
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask a question about your conversations..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && askQuestion()}
                    disabled={isAsking}
                  />
                  <Button onClick={askQuestion} disabled={isAsking || !question.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Contact Confirmation Dialog */}
      <Dialog open={showContactConfirm} onOpenChange={setShowContactConfirm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Save Recording</DialogTitle>
            <DialogDescription>
              Choose how to save this recording
            </DialogDescription>
          </DialogHeader>
          
          {pendingAnalysis && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground">Summary</Label>
                <p className="text-sm">{pendingAnalysis.summary}</p>
              </div>

              {pendingAnalysis.keyPoints?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Key Points</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pendingAnalysis.keyPoints.map((point, i) => (
                      <Badge key={i} variant="secondary">{point}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Type Selection */}
              <div className="border rounded-lg p-4 space-y-3">
                <Label className="text-sm font-medium">Save as:</Label>
                <RadioGroup 
                  value={saveAsType} 
                  onValueChange={(value) => setSaveAsType(value as "contact" | "internal_meeting")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="contact" id="save-contact" />
                    <Label htmlFor="save-contact" className="flex items-center gap-2 cursor-pointer">
                      <User className="h-4 w-4" />
                      Contact Conversation
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="internal_meeting" id="save-meeting" />
                    <Label htmlFor="save-meeting" className="flex items-center gap-2 cursor-pointer">
                      <Users className="h-4 w-4" />
                      Internal Meeting
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Internal Meeting Form */}
              {saveAsType === "internal_meeting" && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="meeting-title">Meeting Title *</Label>
                    <Input
                      id="meeting-title"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      placeholder="e.g., Team Standup, Sales Strategy Meeting"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This recording will be saved to the Employee Dashboard under Meetings.
                  </p>
                </div>
              )}

              {/* Contact Selection (only shown when saveAsType is contact) */}
              {saveAsType === "contact" && (
                <div className="border rounded-lg p-4 space-y-3">
                  {pendingAnalysis.matchedContactId && pendingAnalysis.matchConfidence !== 'no_match' ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">
                          Matched: {getContactName(pendingAnalysis.matchedContactId)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Confidence: {pendingAnalysis.matchConfidence}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-yellow-500" />
                      <p>No matching contact found</p>
                    </div>
                  )}

                  {/* Manual Contact Override */}
                  <div className="border-t pt-3">
                    <Label className="text-sm">Or select a different contact:</Label>
                    <Select value={selectedContactOverride || ""} onValueChange={setSelectedContactOverride}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose existing contact..." />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} {c.company_id ? `(${companies.find(co => co.id === c.company_id)?.name})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {pendingAnalysis.suggestedNewContact && (
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium mb-2">Suggested New Contact:</p>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p>Name: {pendingAnalysis.suggestedNewContact.name}</p>
                        {pendingAnalysis.suggestedNewContact.company && (
                          <p>Company: {pendingAnalysis.suggestedNewContact.company}</p>
                        )}
                        {pendingAnalysis.suggestedNewContact.email && (
                          <p>Email: {pendingAnalysis.suggestedNewContact.email}</p>
                        )}
                        {pendingAnalysis.suggestedNewContact.phone && (
                          <p>Phone: {pendingAnalysis.suggestedNewContact.phone}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {saveAsType === "internal_meeting" ? (
                  <Button onClick={saveAsInternalMeeting} disabled={!meetingTitle.trim() || isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Users className="h-4 w-4 mr-2" />
                        Save as Internal Meeting
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    {selectedContactOverride ? (
                      <Button onClick={() => confirmContactMatch(selectedContactOverride)} disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Link to {getContactName(selectedContactOverride)}
                          </>
                        )}
                      </Button>
                    ) : pendingAnalysis.matchedContactId && pendingAnalysis.matchConfidence !== 'no_match' ? (
                      <Button onClick={() => confirmContactMatch(pendingAnalysis.matchedContactId)} disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Confirm Match
                          </>
                        )}
                      </Button>
                    ) : null}
                    
                    {pendingAnalysis.suggestedNewContact && !selectedContactOverride && (
                      <Button 
                        variant="outline" 
                        onClick={() => confirmContactMatch(null, true)}
                        disabled={isSaving}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Contact
                      </Button>
                    )}
                    
                    <Button variant="ghost" onClick={() => confirmContactMatch(null)} disabled={isSaving}>
                      Save Without Contact
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
