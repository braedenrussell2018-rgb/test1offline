import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Mail, Phone, MapPin, Briefcase, StickyNote, Plus, Edit, X, Check, FileText, Receipt, CreditCard, Tractor, GitBranch, MessageSquare, Play, Pause, Clock } from "lucide-react";
import { Person, Branch, inventoryStorage, Note, Quote, Invoice } from "@/lib/inventory-storage";
import { getExpensesByCustomerId, getCategoryLabel, type Expense } from "@/lib/expense-storage";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface PersonDetailDialogProps {
  person: Person;
  companyName: string;
  onUpdate: () => void;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const PersonDetailDialog = ({ person, companyName, onUpdate, children, open: controlledOpen, onOpenChange }: PersonDetailDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPerson, setEditedPerson] = useState<Person>(person);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [conversations, setConversations] = useState<{
    id: string;
    transcript: string;
    summary?: string;
    key_points?: string[];
    created_at: string;
    duration_seconds?: number;
    audio_url?: string;
  }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  // Excavator lines state for editing
  const [allExcavatorLines, setAllExcavatorLines] = useState<string[]>([]);
  const [excavatorInput, setExcavatorInput] = useState("");
  const [showExcavatorDropdown, setShowExcavatorDropdown] = useState(false);
  const excavatorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchRelatedData = async () => {
      if (open) {
        // Get current user to check ownership
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id || null);
        setIsOwner(user?.id === person.userId);

        const [allQuotes, allInvoices, personExpenses, excavatorLines, companyBranches, personConversations] = await Promise.all([
          inventoryStorage.getQuotes(),
          inventoryStorage.getInvoices(),
          getExpensesByCustomerId(person.id),
          inventoryStorage.getUniqueExcavatorLines(),
          person.companyId ? inventoryStorage.getBranchesByCompany(person.companyId) : Promise.resolve([]),
          supabase
            .from("ai_conversations")
            .select("id, transcript, summary, key_points, created_at, duration_seconds, audio_url")
            .eq("contact_id", person.id)
            .order("created_at", { ascending: false }),
        ]);
        
        setAllExcavatorLines(excavatorLines);
        setBranches(companyBranches);
        
        if (personConversations.data) {
          setConversations(personConversations.data.map(c => ({
            ...c,
            key_points: Array.isArray(c.key_points) ? c.key_points as string[] : [],
            summary: c.summary || undefined,
            duration_seconds: c.duration_seconds || undefined,
            audio_url: c.audio_url || undefined,
          })));
        }

        // Match by name (partial match), email, or phone
        const personQuotes = allQuotes.filter(
          (q) =>
            q.customerName.toLowerCase().includes(person.name.toLowerCase()) ||
            (person.email && q.customerEmail?.toLowerCase() === person.email.toLowerCase()) ||
            (person.phone && q.customerPhone === person.phone)
        );

        const personInvoices = allInvoices.filter(
          (inv) =>
            inv.customerName.toLowerCase().includes(person.name.toLowerCase()) ||
            (person.email && inv.customerEmail?.toLowerCase() === person.email.toLowerCase()) ||
            (person.phone && inv.customerPhone === person.phone)
        );

        setQuotes(personQuotes);
        setInvoices(personInvoices);
        setExpenses(personExpenses);
      }
    };

    fetchRelatedData();
  }, [open, person]);
  
  // Cleanup audio player on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const playAudio = (conversationId: string, audioUrl: string) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    if (playingAudioId === conversationId) {
      setPlayingAudioId(null);
      return;
    }

    const audio = new Audio(audioUrl);
    audioPlayerRef.current = audio;
    
    audio.onended = () => {
      setPlayingAudioId(null);
      audioPlayerRef.current = null;
    };
    
    audio.onerror = () => {
      setPlayingAudioId(null);
      audioPlayerRef.current = null;
    };

    audio.play();
    setPlayingAudioId(conversationId);
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      inventoryStorage.addNoteToPerson(person.id, newNote.trim());
      setNewNote("");
      setIsAddingNote(false);
      onUpdate();
    }
  };

  const handleSaveEdit = () => {
    inventoryStorage.updatePerson(editedPerson);
    setIsEditing(false);
    onUpdate();
  };

  const handleCancelEdit = () => {
    setEditedPerson(person);
    setIsEditing(false);
    setExcavatorInput("");
    setShowExcavatorDropdown(false);
  };

  // Excavator line handlers for editing
  const handleAddExcavatorLine = (line: string) => {
    const trimmedLine = line.trim().toLowerCase();
    const currentLines = editedPerson.excavatorLines || [];
    if (trimmedLine && !currentLines.includes(trimmedLine)) {
      setEditedPerson({ ...editedPerson, excavatorLines: [...currentLines, trimmedLine] });
      if (!allExcavatorLines.includes(trimmedLine)) {
        setAllExcavatorLines([...allExcavatorLines, trimmedLine].sort());
      }
    }
    setExcavatorInput("");
    setShowExcavatorDropdown(false);
  };

  const handleRemoveExcavatorLine = (line: string) => {
    const currentLines = editedPerson.excavatorLines || [];
    setEditedPerson({ ...editedPerson, excavatorLines: currentLines.filter(l => l !== line) });
  };

  const handleExcavatorInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (excavatorInput.trim()) {
        handleAddExcavatorLine(excavatorInput);
      }
    }
  };

  const filteredExcavatorLines = allExcavatorLines.filter(
    line => line.toLowerCase().includes(excavatorInput.toLowerCase()) && !(editedPerson.excavatorLines || []).includes(line)
  );

  // Sort notes by timestamp, newest first
  const sortedNotes = [...person.notes].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <User className="h-6 w-6" />
                {person.name}
              </DialogTitle>
            </div>
            {currentUserId && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            {currentUserId && isEditing && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            )}
          </div>
          <DialogDescription>
            Contact information and notes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      value={editedPerson.name}
                      onChange={(e) => setEditedPerson({ ...editedPerson, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-job-title">Job Title</Label>
                    <Input
                      id="edit-job-title"
                      value={editedPerson.jobTitle || ""}
                      onChange={(e) => setEditedPerson({ ...editedPerson, jobTitle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editedPerson.email || ""}
                      onChange={(e) => setEditedPerson({ ...editedPerson, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={editedPerson.phone || ""}
                      onChange={(e) => setEditedPerson({ ...editedPerson, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-address">Address</Label>
                    <Textarea
                      id="edit-address"
                      value={editedPerson.address || ""}
                      onChange={(e) => setEditedPerson({ ...editedPerson, address: e.target.value })}
                      rows={2}
                    />
                  </div>
                  {branches.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-branch">Branch</Label>
                      <Select
                        value={editedPerson.branchId || "none"}
                        onValueChange={(value) => setEditedPerson({ ...editedPerson, branchId: value === "none" ? undefined : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a branch" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No branch</SelectItem>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="edit-excavator-lines">Excavator Lines</Label>
                    <div className="relative">
                      <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[42px]">
                        {(editedPerson.excavatorLines || []).map((line) => (
                          <Badge 
                            key={line} 
                            variant="secondary" 
                            className="flex items-center gap-1"
                          >
                            {line}
                            <X 
                              className="h-3 w-3 cursor-pointer hover:text-destructive" 
                              onClick={() => handleRemoveExcavatorLine(line)}
                            />
                          </Badge>
                        ))}
                        <Input
                          ref={excavatorInputRef}
                          id="edit-excavator-lines"
                          value={excavatorInput}
                          onChange={(e) => {
                            setExcavatorInput(e.target.value);
                            setShowExcavatorDropdown(true);
                          }}
                          onFocus={() => setShowExcavatorDropdown(true)}
                          onBlur={() => {
                            setTimeout(() => setShowExcavatorDropdown(false), 200);
                          }}
                          onKeyDown={handleExcavatorInputKeyDown}
                          placeholder={(editedPerson.excavatorLines || []).length === 0 ? "Type and press Enter..." : "Add more..."}
                          className="border-0 shadow-none focus-visible:ring-0 flex-1 min-w-[120px] p-0 h-auto"
                        />
                      </div>
                      
                      {showExcavatorDropdown && (excavatorInput || filteredExcavatorLines.length > 0) && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[150px] overflow-y-auto">
                          {filteredExcavatorLines.map((line) => (
                            <div
                              key={line}
                              className="px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleAddExcavatorLine(line);
                              }}
                            >
                              {line}
                            </div>
                          ))}
                          {excavatorInput.trim() && !allExcavatorLines.includes(excavatorInput.trim().toLowerCase()) && (
                            <div
                              className="px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleAddExcavatorLine(excavatorInput);
                              }}
                            >
                              Add "{excavatorInput.trim()}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Company</span>
                      <p className="font-medium">{companyName}</p>
                    </div>
                    {person.jobTitle && (
                      <div>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          Job Title
                        </span>
                        <p className="font-medium">{person.jobTitle}</p>
                      </div>
                    )}
                  </div>
                  
                  {person.email && (
                    <div>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Email
                      </span>
                      <a href={`mailto:${person.email}`} className="text-primary hover:underline">
                        {person.email}
                      </a>
                    </div>
                  )}
                  
                  {person.phone && (
                    <div>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Phone
                      </span>
                      <a href={`tel:${person.phone}`} className="text-primary hover:underline">
                        {person.phone}
                      </a>
                    </div>
                  )}
                  
                  {person.address && (
                    <div>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Address
                      </span>
                      <p>{person.address}</p>
                    </div>
                  )}
                  
                  {person.branchId && branches.find(b => b.id === person.branchId) && (
                    <div>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        Branch
                      </span>
                      <p className="font-medium">{branches.find(b => b.id === person.branchId)?.name}</p>
                    </div>
                  )}
                  
                  {person.excavatorLines && person.excavatorLines.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Tractor className="h-3 w-3" />
                        Excavator Lines
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {person.excavatorLines.map((line) => (
                          <Badge key={line} variant="secondary">
                            {line}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="h-5 w-5" />
                Notes
              </CardTitle>
              {!isAddingNote && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsAddingNote(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Note
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Note Form */}
              {isAddingNote && (
                <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  <Textarea
                    placeholder="Enter your note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setIsAddingNote(false);
                        setNewNote("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                    >
                      Save Note
                    </Button>
                  </div>
                </div>
              )}

              {/* Notes List */}
              {sortedNotes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No notes yet. Add your first note above.
                </p>
              ) : (
                <div className="space-y-3">
                  {sortedNotes.map((note) => (
                    <div 
                      key={note.id} 
                      className="p-3 border rounded-lg bg-card space-y-1"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm flex-1">{note.text}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(note.timestamp), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Conversations Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Recorded Conversations
                <Badge variant="secondary" className="ml-2">
                  {conversations.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No recorded conversations with this contact.
                </p>
              ) : (
                <div className="space-y-3">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-3 border rounded-lg bg-card space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {format(new Date(conv.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                          {conv.duration_seconds && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDuration(conv.duration_seconds)}
                            </Badge>
                          )}
                        </div>
                        {conv.audio_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => playAudio(conv.id, conv.audio_url!)}
                          >
                            {playingAudioId === conv.id ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      
                      {conv.summary && (
                        <div>
                          <p className="text-xs text-muted-foreground">Summary</p>
                          <p className="text-sm">{conv.summary}</p>
                        </div>
                      )}
                      
                      {conv.key_points && conv.key_points.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">Key Points</p>
                          <ul className="text-sm list-disc list-inside">
                            {conv.key_points.map((point, i) => (
                              <li key={i} className="text-muted-foreground">{point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View transcript
                        </summary>
                        <p className="mt-2 p-2 bg-muted/50 rounded text-xs whitespace-pre-wrap">
                          {conv.transcript}
                        </p>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expenses Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Expenses
                <Badge variant="secondary" className="ml-2">
                  {expenses.length}
                </Badge>
                {expenses.length > 0 && (
                  <Badge variant="outline" className="ml-auto">
                    Total: ${totalExpenses.toFixed(2)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No expenses assigned to this contact.
                </p>
              ) : (
                <div className="space-y-2">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-card"
                    >
                      <div>
                        <p className="font-medium">{getCategoryLabel(expense.category)}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(expense.expenseDate), 'MMM d, yyyy')} • {expense.employeeName}
                        </p>
                        {expense.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {expense.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${expense.amount.toFixed(2)}</p>
                        {expense.creditCardLast4 && (
                          <p className="text-xs text-muted-foreground">
                            •••• {expense.creditCardLast4}
                          </p>
                        )}
                        {expense.receiptUrl && (
                          <a 
                            href={expense.receiptUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View Receipt
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quotes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quotes
                <Badge variant="secondary" className="ml-2">
                  {quotes.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No quotes for this contact yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {quotes.map((quote) => (
                    <div
                      key={quote.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-card"
                    >
                      <div>
                        <p className="font-medium">Quote {quote.quoteNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(quote.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${quote.total.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {quote.items.length} {quote.items.length === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoices Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Invoices
                <Badge variant="secondary" className="ml-2">
                  {invoices.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No invoices for this contact yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-card"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Invoice {invoice.invoiceNumber}</p>
                          {invoice.paid ? (
                            <Badge variant="default" className="bg-green-500 text-xs">Paid</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Unpaid</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(invoice.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${invoice.total.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.items.length} {invoice.items.length === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timestamps */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-muted-foreground pt-2 border-t">
          {person.createdAt && (
            <span>Created: {format(new Date(person.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
          )}
          {person.updatedAt && (
            <span>Last edited: {format(new Date(person.updatedAt), "MMM d, yyyy 'at' h:mm a")}</span>
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-background">
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};