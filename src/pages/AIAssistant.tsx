import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Mic, 
  MicOff, 
  Send, 
  Settings, 
  User, 
  Clock, 
  MessageSquare,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  Building2
} from "lucide-react";

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
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [useCustomKey, setUseCustomKey] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<AIAnalysis | null>(null);
  const [showContactConfirm, setShowContactConfirm] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadContacts();
      loadCompanies();
      loadSettings();
    }
  }, [user]);

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

  const loadSettings = async () => {
    const { data } = await supabase
      .from("user_ai_settings")
      .select("*")
      .single();

    if (data) {
      setOpenaiKey(data.openai_api_key || "");
      setUseCustomKey(data.preferred_model === "openai");
    }
  };

  const saveSettings = async () => {
    const { error } = await supabase
      .from("user_ai_settings")
      .upsert({
        user_id: user?.id,
        openai_api_key: openaiKey,
        preferred_model: useCustomKey ? "openai" : "lovable",
      });

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Settings saved");
      setShowSettings(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      audioChunksRef.current = [];
      recordingStartRef.current = Date.now();
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
        stream.getTracks().forEach(track => track.stop());
        await processRecording(audioBlob, duration);
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      toast.info("Recording started...");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processRecording = async (audioBlob: Blob, duration: number) => {
    setIsProcessing(true);
    
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      // Transcribe audio
      const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke(
        'transcribe-audio',
        { body: { audio: base64Audio, userOpenAIKey: useCustomKey ? openaiKey : null } }
      );

      if (transcribeError || transcribeData?.error) {
        if (transcribeData?.needsApiKey) {
          toast.error("Voice transcription requires an OpenAI API key. Add it in Settings.");
          setShowSettings(true);
          return;
        }
        throw new Error(transcribeData?.error || "Transcription failed");
      }

      const transcriptText = transcribeData.text;
      setTranscript(transcriptText);
      
      // Analyze transcript and match to contacts
      await analyzeTranscript(transcriptText, duration);

    } catch (error) {
      console.error("Processing error:", error);
      toast.error("Failed to process recording");
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeTranscript = async (transcriptText: string, duration?: number) => {
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
          userOpenAIKey: useCustomKey ? openaiKey : null,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || "Analysis failed");
      }

      const analysis: AIAnalysis = data;
      setPendingAnalysis(analysis);
      
      // Store pending data for contact confirmation
      sessionStorage.setItem('pendingTranscript', transcriptText);
      sessionStorage.setItem('pendingDuration', String(duration || 0));
      
      setShowContactConfirm(true);

    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze transcript");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmContactMatch = async (contactId: string | null, createNew: boolean = false) => {
    const transcriptText = sessionStorage.getItem('pendingTranscript') || transcript;
    const duration = parseInt(sessionStorage.getItem('pendingDuration') || '0');
    
    let finalContactId = contactId;

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
      });

    if (error) {
      toast.error("Failed to save conversation");
    } else {
      toast.success("Conversation saved!");
      loadConversations();
    }

    setShowContactConfirm(false);
    setPendingAnalysis(null);
    setTranscript("");
    sessionStorage.removeItem('pendingTranscript');
    sessionStorage.removeItem('pendingDuration');
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
          userOpenAIKey: useCustomKey ? openaiKey : null,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || "Failed to get answer");
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: data.answer }]);

    } catch (error) {
      console.error("Question error:", error);
      toast.error("Failed to get answer");
    } finally {
      setIsAsking(false);
    }
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Assistant</h1>
            <p className="text-muted-foreground">Voice-powered note taking for sales calls</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setShowSettings(true)}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>

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
                <CardTitle>Record Conversation</CardTitle>
                <CardDescription>
                  Click the microphone to start recording your sales call. The AI will transcribe and analyze it.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-6">
                <Button
                  size="lg"
                  variant={isRecording ? "destructive" : "default"}
                  className="h-24 w-24 rounded-full"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-10 w-10 animate-spin" />
                  ) : isRecording ? (
                    <MicOff className="h-10 w-10" />
                  ) : (
                    <Mic className="h-10 w-10" />
                  )}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {isProcessing ? "Processing..." : isRecording ? "Recording... Click to stop" : "Click to start recording"}
                </p>

                {transcript && (
                  <div className="w-full space-y-2">
                    <Label>Transcript</Label>
                    <Textarea 
                      value={transcript} 
                      onChange={(e) => setTranscript(e.target.value)}
                      rows={6}
                      className="resize-none"
                    />
                    <Button 
                      onClick={() => analyzeTranscript(transcript)}
                      disabled={isProcessing || !transcript.trim()}
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Analyze & Save
                    </Button>
                  </div>
                )}
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
                              <span className="text-xs text-muted-foreground">
                                {new Date(conv.created_at).toLocaleString()}
                              </span>
                            </div>
                            
                            {conv.summary && (
                              <p className="text-sm text-foreground">{conv.summary}</p>
                            )}
                            
                            {conv.key_points && conv.key_points.length > 0 && (
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
                              <p className="mt-2 p-2 bg-muted rounded text-foreground">
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
                  Ask questions about your recorded conversations
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ScrollArea className="flex-1 mb-4">
                  <div className="space-y-4">
                    {chatHistory.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Ask me anything about your past conversations!
                      </p>
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
                          {msg.content}
                        </div>
                      ))
                    )}
                    {isAsking && (
                      <div className="flex items-center gap-2 text-muted-foreground">
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

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Settings</DialogTitle>
            <DialogDescription>
              Configure your AI preferences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Use Custom OpenAI Key</Label>
                <p className="text-sm text-muted-foreground">
                  Required for voice transcription. Optional for text analysis.
                </p>
              </div>
              <Switch checked={useCustomKey} onCheckedChange={setUseCustomKey} />
            </div>
            
            {useCustomKey && (
              <div className="space-y-2">
                <Label>OpenAI API Key</Label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your key is stored securely and only used for your requests.
                </p>
              </div>
            )}

            <Button onClick={saveSettings} className="w-full">
              Save Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Confirmation Dialog */}
      <Dialog open={showContactConfirm} onOpenChange={setShowContactConfirm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link to Contact</DialogTitle>
            <DialogDescription>
              Review the AI analysis and confirm the contact
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

              <div className="flex flex-col gap-2">
                {pendingAnalysis.matchedContactId && pendingAnalysis.matchConfidence !== 'no_match' && (
                  <Button onClick={() => confirmContactMatch(pendingAnalysis.matchedContactId)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Match
                  </Button>
                )}
                
                {pendingAnalysis.suggestedNewContact && (
                  <Button 
                    variant="outline" 
                    onClick={() => confirmContactMatch(null, true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Contact
                  </Button>
                )}
                
                <Button variant="ghost" onClick={() => confirmContactMatch(null)}>
                  Save Without Contact
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
