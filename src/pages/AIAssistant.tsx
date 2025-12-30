import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Building2,
  AlertCircle,
  Trash2,
  RefreshCw
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualTranscript, setManualTranscript] = useState("");
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
  const [selectedContactOverride, setSelectedContactOverride] = useState<string | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  
  const {
    isListening,
    isSupported,
    transcript: speechTranscript,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  useEffect(() => {
    if (user) {
      loadConversations();
      loadContacts();
      loadCompanies();
      loadSettings();
    }
  }, [user]);

  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

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

  const handleStartRecording = () => {
    resetTranscript();
    setManualTranscript("");
    setRecordingStartTime(Date.now());
    startListening();
    toast.info("Listening... Speak now");
  };

  const handleStopRecording = () => {
    stopListening();
    toast.success("Recording stopped");
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
          userOpenAIKey: useCustomKey ? openaiKey : null,
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
      const duration = recordingStartTime ? Math.round((Date.now() - recordingStartTime) / 1000) : 0;
      sessionStorage.setItem('pendingTranscript', transcriptText);
      sessionStorage.setItem('pendingDuration', String(duration));
      
      setShowContactConfirm(true);

    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to analyze transcript");
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmContactMatch = async (contactId: string | null, createNew: boolean = false) => {
    const transcriptText = sessionStorage.getItem('pendingTranscript') || getCurrentTranscript();
    const duration = parseInt(sessionStorage.getItem('pendingDuration') || '0');
    
    let finalContactId = contactId;

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
    setManualTranscript("");
    resetTranscript();
    setSelectedContactOverride(null);
    setRecordingStartTime(0);
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

  const deleteConversation = async (id: string) => {
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

  const displayTranscript = speechTranscript + (interimTranscript ? ` ${interimTranscript}` : '');

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

        {/* Browser Support Warning */}
        {!isSupported && (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Speech recognition not supported</p>
                <p className="text-sm text-muted-foreground">
                  Your browser doesn't support speech recognition. Please use Chrome, Edge, or Safari, or type your notes manually.
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
                <CardTitle>Record Conversation</CardTitle>
                <CardDescription>
                  Click the microphone to start recording, or type your notes manually below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Recording Button */}
                <div className="flex flex-col items-center space-y-4">
                  <Button
                    size="lg"
                    variant={isListening ? "destructive" : "default"}
                    className="h-24 w-24 rounded-full"
                    onClick={isListening ? handleStopRecording : handleStartRecording}
                    disabled={isProcessing || !isSupported}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-10 w-10 animate-spin" />
                    ) : isListening ? (
                      <MicOff className="h-10 w-10" />
                    ) : (
                      <Mic className="h-10 w-10" />
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {isProcessing ? "Processing..." : isListening ? "Listening... Click to stop" : isSupported ? "Click to start recording" : "Type notes below"}
                  </p>
                  {isListening && (
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                      </span>
                      <span className="text-sm text-destructive font-medium">Recording</span>
                    </div>
                  )}
                </div>

                {/* Live Transcript Display */}
                {(displayTranscript || isListening) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Live Transcript</Label>
                      {displayTranscript && (
                        <Button variant="ghost" size="sm" onClick={resetTranscript}>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="p-4 bg-muted rounded-lg min-h-[100px]">
                      <p className="text-foreground">
                        {speechTranscript}
                        {interimTranscript && (
                          <span className="text-muted-foreground italic"> {interimTranscript}</span>
                        )}
                        {!displayTranscript && isListening && (
                          <span className="text-muted-foreground italic">Waiting for speech...</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Manual Transcript Entry */}
                <div className="space-y-2">
                  <Label>Manual Notes (or edit transcript)</Label>
                  <Textarea 
                    value={manualTranscript || speechTranscript} 
                    onChange={(e) => setManualTranscript(e.target.value)}
                    rows={6}
                    placeholder="Type or paste your conversation notes here..."
                    className="resize-none"
                  />
                </div>

                {/* Analyze Button */}
                <Button 
                  onClick={() => analyzeTranscript(manualTranscript || speechTranscript)}
                  disabled={isProcessing || (!manualTranscript && !speechTranscript)}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
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
                                  onClick={() => deleteConversation(conv.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            
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

                            {conv.duration_seconds && conv.duration_seconds > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Duration: {Math.floor(conv.duration_seconds / 60)}m {conv.duration_seconds % 60}s
                              </p>
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
                          <p className="whitespace-pre-wrap">{msg.content}</p>
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

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Settings</DialogTitle>
            <DialogDescription>
              Configure your AI preferences. The default uses Lovable AI (free).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Use Custom OpenAI Key</Label>
                <p className="text-sm text-muted-foreground">
                  Optional: Use your own OpenAI key for analysis.
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

              <div className="flex flex-col gap-2">
                {selectedContactOverride ? (
                  <Button onClick={() => confirmContactMatch(selectedContactOverride)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Link to {getContactName(selectedContactOverride)}
                  </Button>
                ) : pendingAnalysis.matchedContactId && pendingAnalysis.matchConfidence !== 'no_match' ? (
                  <Button onClick={() => confirmContactMatch(pendingAnalysis.matchedContactId)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Match
                  </Button>
                ) : null}
                
                {pendingAnalysis.suggestedNewContact && !selectedContactOverride && (
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
