import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileEdit, Trash2, CheckCircle, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, Invoice, InventoryItem } from "@/lib/inventory-storage";
import { EditDraftInvoiceDialog } from "@/components/EditDraftInvoiceDialog";
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

interface DraftInvoicesDialogProps {
  onInvoiceUpdated: () => void;
}

export const DraftInvoicesDialog = ({ onInvoiceUpdated }: DraftInvoicesDialogProps) => {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Invoice | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<Invoice | null>(null);
  const [finalizing, setFinalizing] = useState<string | null>(null);
  const { toast } = useToast();

  const loadDrafts = async () => {
    setLoading(true);
    try {
      const invoices = await inventoryStorage.getInvoices();
      const draftInvoices = invoices.filter(inv => inv.status === 'draft');
      setDrafts(draftInvoices);
    } catch (error) {
      console.error('Error loading drafts:', error);
      toast({
        title: "Error",
        description: "Failed to load draft invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadDrafts();
    }
  }, [open]);

  const handleFinalize = async (draft: Invoice) => {
    setFinalizing(draft.id);
    try {
      // Update invoice status to finalized
      await inventoryStorage.finalizeInvoice(draft.id);
      
      // Mark items as sold
      for (const item of draft.items) {
        await inventoryStorage.updateItem(item.itemId, {
          status: 'sold',
          soldDate: new Date().toISOString(),
          invoiceId: draft.id,
        });
      }

      toast({
        title: "Success",
        description: `Invoice ${draft.invoiceNumber} has been finalized`,
      });
      
      await loadDrafts();
      onInvoiceUpdated();
    } catch (error) {
      console.error('Error finalizing invoice:', error);
      toast({
        title: "Error",
        description: "Failed to finalize invoice",
        variant: "destructive",
      });
    } finally {
      setFinalizing(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!draftToDelete) return;
    
    try {
      await inventoryStorage.deleteInvoice(draftToDelete.id);
      toast({
        title: "Success",
        description: `Draft ${draftToDelete.invoiceNumber} has been deleted`,
      });
      await loadDrafts();
      onInvoiceUpdated();
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast({
        title: "Error",
        description: "Failed to delete draft",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmOpen(false);
      setDraftToDelete(null);
    }
  };

  const handleEdit = (draft: Invoice) => {
    setEditingDraft(draft);
    setEditDialogOpen(true);
  };

  const handleEditComplete = async () => {
    setEditDialogOpen(false);
    setEditingDraft(null);
    await loadDrafts();
    onInvoiceUpdated();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <FileEdit className="mr-2 h-4 w-4" />
            Draft Invoices
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="h-5 w-5" />
              Draft Invoices
              {drafts.length > 0 && (
                <Badge variant="secondary">{drafts.length}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : drafts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No draft invoices found
              </div>
            ) : (
              <div className="space-y-4 pr-4">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{draft.invoiceNumber}</span>
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Draft
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Created: {new Date(draft.createdAt).toLocaleDateString()}
                        </div>
                        {draft.customerName && (
                          <div className="text-sm mt-1">
                            Customer: {draft.customerName}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">${draft.total.toFixed(2)}</div>
                        <div className="text-sm text-muted-foreground">
                          {draft.items.length} {draft.items.length === 1 ? 'item' : 'items'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-1 border-t pt-3 mb-3">
                      {draft.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <div>
                            <span className="font-medium">{item.partNumber}</span>
                            {item.serialNumber && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({item.serialNumber})
                              </span>
                            )}
                          </div>
                          <span className="font-medium">${item.price.toFixed(2)}</span>
                        </div>
                      ))}
                      {draft.items.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{draft.items.length - 3} more items
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(draft)}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleFinalize(draft)}
                        disabled={finalizing === draft.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {finalizing === draft.id ? "Finalizing..." : "Finalize"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive ml-auto"
                        onClick={() => {
                          setDraftToDelete(draft);
                          setDeleteConfirmOpen(true);
                        }}
                      >
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

      {editingDraft && (
        <EditDraftInvoiceDialog
          invoice={editingDraft}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSave={handleEditComplete}
        />
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete draft {draftToDelete?.invoiceNumber}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
