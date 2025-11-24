import { useState, useEffect } from "react";
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
import { User, Mail, Phone, MapPin, Briefcase, StickyNote, Plus, Edit, X, Check, FileText, Receipt } from "lucide-react";
import { Person, inventoryStorage, Note, Quote, Invoice } from "@/lib/inventory-storage";
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedPerson, setEditedPerson] = useState<Person>(person);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    const fetchRelatedData = async () => {
      if (open) {
        const allQuotes = await inventoryStorage.getQuotes();
        const allInvoices = await inventoryStorage.getInvoices();

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
      }
    };

    fetchRelatedData();
  }, [open, person]);

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
      <DialogContent className="max-w-3xl max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <User className="h-6 w-6" />
                {person.name}
              </DialogTitle>
            </div>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            ) : (
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
                        <p className="font-medium">Invoice {invoice.invoiceNumber}</p>
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
