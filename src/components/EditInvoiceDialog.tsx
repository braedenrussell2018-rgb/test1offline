import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, InventoryItem, Invoice } from "@/lib/inventory-storage";
import { supabase } from "@/integrations/supabase/client";
import { InvoiceQuoteEditor, EditorSaveData } from "@/components/invoice-quote/InvoiceQuoteEditor";
import { useUserRole } from "@/hooks/useUserRole";

interface EditInvoiceDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export const EditInvoiceDialog = ({ invoice, open, onOpenChange, onSaved }: EditInvoiceDialogProps) => {
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { hasOwnerAccess } = useUserRole();

  useEffect(() => {
    if (open) {
      inventoryStorage.getItems().then((items) => {
        setAvailableItems(items.filter((i) => i.status === "available"));
      });
    }
  }, [open]);

  if (!invoice) return null;

  const isFinalized = invoice.status === "finalized" || !invoice.status;
  const wasDraft = invoice.status === "draft";

  const handleSave = async (data: EditorSaveData) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newStatus: "draft" | "finalized" = data.isDraft ? "draft" : "finalized";

      // Diff items if editing finalized invoice (for inventory sync + audit)
      const previousItemIds = new Set(invoice.items.map((i) => i.itemId));
      const newItemIds = new Set(data.lineItems.map((i) => i.itemId));
      const removedItemIds = [...previousItemIds].filter((id) => !newItemIds.has(id));
      const addedItemIds = [...newItemIds].filter((id) => !previousItemIds.has(id));

      await inventoryStorage.updateInvoice(invoice.id, {
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
        status: newStatus,
        lastEditedAt: new Date().toISOString(),
        lastEditedBy: user?.id,
      });

      // Inventory sync when finalizing
      if (newStatus === "finalized") {
        for (const removedId of removedItemIds) {
          await inventoryStorage.updateItem(removedId, {
            status: "available",
            soldDate: undefined,
            invoiceId: undefined,
          });
        }
        for (const addedId of addedItemIds) {
          await inventoryStorage.updateItem(addedId, {
            status: "sold",
            soldDate: new Date().toISOString(),
            invoiceId: invoice.id,
          });
        }
        // Mark items new to a draft-being-finalized
        if (wasDraft) {
          for (const item of data.lineItems) {
            if (!removedItemIds.includes(item.itemId)) {
              await inventoryStorage.updateItem(item.itemId, {
                status: "sold",
                soldDate: new Date().toISOString(),
                invoiceId: invoice.id,
              });
            }
          }
        }
      }

      // Audit log for finalized invoice edits
      if (isFinalized && !wasDraft) {
        try {
          await supabase.from("audit_logs").insert({
            action: "invoice_edited",
            action_category: "financial",
            actor_id: user?.id,
            actor_email: user?.email,
            target_id: invoice.id,
            target_name: invoice.invoiceNumber,
            target_type: "invoice",
            risk_level: "medium",
            metadata: {
              before: {
                total: invoice.total,
                itemCount: invoice.items.length,
              },
              after: {
                total: data.total,
                itemCount: data.lineItems.length,
              },
              removedItems: removedItemIds,
              addedItems: addedItemIds,
            },
          });
        } catch (err) {
          console.warn("Audit log failed:", err);
        }
      }

      toast({
        title: "Saved",
        description: `Invoice ${invoice.invoiceNumber} updated`,
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast({
        title: "Error",
        description: "Failed to update invoice",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Block editing finalized invoices unless admin
  const canEdit = wasDraft || hasOwnerAccess();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Edit Invoice {invoice.invoiceNumber}
            {wasDraft && <span className="ml-2 text-sm text-muted-foreground">(Draft)</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {!canEdit ? (
            <p className="text-center text-muted-foreground py-12">
              Only owners and developers can edit finalized invoices.
            </p>
          ) : (
            <InvoiceQuoteEditor
              documentType="invoice"
              mode="edit"
              documentNumber={invoice.invoiceNumber}
              initialData={{
                customerName: invoice.customerName,
                customerEmail: invoice.customerEmail,
                customerPhone: invoice.customerPhone,
                shipToAddress: invoice.shipToAddress,
                salesmanName: invoice.salesmanName,
                items: invoice.items,
                discount: invoice.discount,
                shippingCost: invoice.shippingCost,
                tax: invoice.tax,
                notes: invoice.notes,
              }}
              availableInventory={availableItems}
              onBack={() => onOpenChange(false)}
              onSave={handleSave}
              isSubmitting={isSubmitting}
              showDraftButton={wasDraft}
              warningMessage={
                isFinalized && !wasDraft
                  ? "Editing a finalized invoice — changes will be logged for audit."
                  : undefined
              }
              primaryActionLabel={wasDraft ? "Finalize Invoice" : "Save Changes"}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
