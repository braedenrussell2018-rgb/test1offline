import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Phone, MapPin, Briefcase, StickyNote, Plus } from "lucide-react";
import { Person, inventoryStorage, Note } from "@/lib/inventory-storage";
import { format } from "date-fns";

interface PersonDetailDialogProps {
  person: Person;
  companyName: string;
  onUpdate: () => void;
  children: React.ReactNode;
}

export const PersonDetailDialog = ({ person, companyName, onUpdate, children }: PersonDetailDialogProps) => {
  const [open, setOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  const handleAddNote = () => {
    if (newNote.trim()) {
      inventoryStorage.addNoteToPerson(person.id, newNote.trim());
      setNewNote("");
      setIsAddingNote(false);
      onUpdate();
    }
  };

  // Sort notes by timestamp, newest first
  const sortedNotes = [...person.notes].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <User className="h-6 w-6" />
            {person.firstName} {person.lastName}
          </DialogTitle>
          <DialogDescription>
            Contact information and notes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Business Card Photo */}
          {person.businessCardPhoto && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Business Card</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={person.businessCardPhoto}
                  alt="Business card"
                  className="w-full max-w-md rounded border"
                />
              </CardContent>
            </Card>
          )}

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
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
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
