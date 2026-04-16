import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StickyNote, Plus, Trash2, Edit, Pin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

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

interface NotesTabProps {
  notes: InternalNote[];
  searchQuery: string;
  userId: string | undefined;
  onRefresh: () => void;
}

export function NotesTab({ notes, searchQuery, userId, onRefresh }: NotesTabProps) {
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<InternalNote | null>(null);
  const [noteForm, setNoteForm] = useState({ title: "", content: "", category: "general" });

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveNote = async () => {
    if (!noteForm.title.trim() || !noteForm.content.trim()) {
      toast.error("Please fill in title and content");
      return;
    }
    try {
      if (editingNote) {
        const { error } = await supabase
          .from("internal_notes")
          .update({ title: noteForm.title, content: noteForm.content, category: noteForm.category })
          .eq("id", editingNote.id);
        if (error) throw error;
        toast.success("Note updated");
      } else {
        const { error } = await supabase
          .from("internal_notes")
          .insert({ user_id: userId, title: noteForm.title, content: noteForm.content, category: noteForm.category });
        if (error) throw error;
        toast.success("Note created");
      }
      setNoteDialogOpen(false);
      setEditingNote(null);
      setNoteForm({ title: "", content: "", category: "general" });
      onRefresh();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Failed to save note");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase.from("internal_notes").delete().eq("id", noteId);
      if (error) throw error;
      toast.success("Note deleted");
      onRefresh();
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
      onRefresh();
    } catch (error) {
      console.error("Error toggling pin:", error);
    }
  };

  const handleEditNote = (note: InternalNote) => {
    setEditingNote(note);
    setNoteForm({ title: note.title, content: note.content, category: note.category });
    setNoteDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Internal Notes
            </CardTitle>
            <CardDescription>Your personal notes and reminders</CardDescription>
          </div>
          <Dialog open={noteDialogOpen} onOpenChange={(open) => {
            setNoteDialogOpen(open);
            if (!open) { setEditingNote(null); setNoteForm({ title: "", content: "", category: "general" }); }
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Note</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingNote ? "Edit Note" : "Create Note"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Title</Label>
                  <Input value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} placeholder="Note title..." />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={noteForm.category} onValueChange={(value) => setNoteForm({ ...noteForm, category: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Textarea value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })} placeholder="Write your note..." rows={6} />
                </div>
                <Button onClick={handleSaveNote} className="w-full">{editingNote ? "Update Note" : "Save Note"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {filteredNotes.length === 0 ? (
            <EmptyState icon={StickyNote} title="No notes yet" description="Create your first note to get started" actionLabel="New Note" onAction={() => setNoteDialogOpen(true)} />
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
                    <p className="text-sm text-muted-foreground line-clamp-4 mb-3">{note.content}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{format(new Date(note.updated_at), "MMM d, yyyy")}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTogglePin(note)}>
                          <Pin className={`h-4 w-4 ${note.is_pinned ? "text-primary" : ""}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditNote(note)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteNote(note.id)}>
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
    </div>
  );
}
