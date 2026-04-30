import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileEdit, Trash2, Edit2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, Quote } from "@/lib/inventory-storage";
import { EditQuoteDialog } from "@/components/EditQuoteDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QuoteDraftsDialogProps {
  onQuoteUpdated: () => void;
}

export const QuoteDraftsDialog = ({ onQuoteUpdated }: QuoteDraftsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Quote | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const { toast } = useToast();

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const quotes = await inventoryStorage.getQuotes();
      setDrafts(quotes.filter(q => q.status === 'draft'));
    } catch (error) {
      console.error('Error loading draft quotes:', error);
      toast({ title: "Error", description: "Failed to load draft quotes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) loadDrafts(); }, [open]);

  const handleSubmit = async (draft: Quote) => {
    setSubmitting(draft.id);
    try {
      await inventoryStorage.updateQuote(draft.id, { status: 'pending' });
      toast({ title: "Submitted", description: `Quote ${draft.quoteNumber} is now pending` });
      await loadDrafts();
      onQuoteUpdated();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to submit quote", variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!draftToDelete) return;
    try {
      await inventoryStorage.deleteQuote(draftToDelete.id);
      toast({ title: "Deleted", description: `Draft ${draftToDelete.quoteNumber} removed` });
      await loadDrafts();
      onQuoteUpdated();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete draft", variant: "destructive" });
    } finally {
      setDeleteConfirmOpen(false);
      setDraftToDelete(null);
    }
  };

  const handleEditComplete = async () => {
    setEditDialogOpen(false);
    setEditingDraft(null);
    await loadDrafts();
    onQuoteUpdated();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <FileEdit className="mr-2 h-4 w-4" />
            Quote Drafts
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="h-5 w-5" />
              Quote Drafts
              {drafts.length > 0 && <Badge variant="secondary">{drafts.length}</Badge>}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : drafts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No draft quotes found</div>
            ) : (
              <div className="space-y-4 pr-4">
                {drafts.map((draft) => (
                  <div key={draft.id} className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{draft.quoteNumber}</span>
                          <Badge variant="outline" className="text-amber-600 border-amber-600">Draft</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Created: {new Date(draft.createdAt).toLocaleDateString()}
                        </div>
                        {draft.customerName && <div className="text-sm mt-1">Customer: {draft.customerName}</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">${draft.total.toFixed(2)}</div>
                        <div className="text-sm text-muted-foreground">
                          {draft.items.length} {draft.items.length === 1 ? 'item' : 'items'}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" onClick={() => { setEditingDraft(draft); setEditDialogOpen(true); }}>
                        <Edit2 className="h-4 w-4 mr-1" />Edit
                      </Button>
                      <Button size="sm" onClick={() => handleSubmit(draft)} disabled={submitting === draft.id}>
                        <Send className="h-4 w-4 mr-1" />
                        {submitting === draft.id ? "Submitting..." : "Submit for Approval"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto"
                        onClick={() => { setDraftToDelete(draft); setDeleteConfirmOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <EditQuoteDialog
        quote={editingDraft}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={handleEditComplete}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft Quote?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete draft {draftToDelete?.quoteNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
