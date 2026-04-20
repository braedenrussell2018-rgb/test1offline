import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, InventoryItem, Quote } from "@/lib/inventory-storage";
import { InvoiceQuoteEditor, EditorSaveData } from "@/components/invoice-quote/InvoiceQuoteEditor";

interface EditQuoteDialogProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export const EditQuoteDialog = ({ quote, open, onOpenChange, onSaved }: EditQuoteDialogProps) => {
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      inventoryStorage.getItems().then((items) => {
        setAvailableItems(items.filter((i) => i.status === "available"));
      });
    }
  }, [open]);

  if (!quote) return null;

  const handleSave = async (data: EditorSaveData) => {
    setIsSubmitting(true);
    try {
      await inventoryStorage.updateQuote(quote.id, {
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        shipToAddress: data.shipToAddress,
        salesmanName: data.salesmanName,
        items: data.lineItems,
        subtotal: data.subtotal,
        discount: data.discount,
        shippingCost: data.shippingCost,
        tax: data.tax,
        notes: data.notes,
        total: data.total,
        status: data.isDraft ? "draft" : "pending",
      });

      toast({
        title: "Saved",
        description: `Quote ${quote.quoteNumber} updated`,
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating quote:", error);
      toast({
        title: "Error",
        description: "Failed to update quote",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Quote {quote.quoteNumber}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <InvoiceQuoteEditor
            documentType="quote"
            mode="edit"
            documentNumber={quote.quoteNumber}
            initialData={{
              customerName: quote.customerName,
              customerEmail: quote.customerEmail,
              customerPhone: quote.customerPhone,
              shipToAddress: quote.shipToAddress,
              salesmanName: quote.salesmanName,
              items: quote.items,
              discount: quote.discount,
              shippingCost: quote.shippingCost,
              tax: quote.tax,
              notes: quote.notes,
            }}
            availableInventory={availableItems}
            onBack={() => onOpenChange(false)}
            onSave={handleSave}
            isSubmitting={isSubmitting}
            showDraftButton={quote.status === "draft" || quote.status === "pending"}
            draftActionLabel="Save as Draft"
            primaryActionLabel="Save Changes"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
