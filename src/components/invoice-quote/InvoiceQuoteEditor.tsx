import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Printer, Save, AlertTriangle, FileCheck } from "lucide-react";
import { DocLineItem, InventoryItem } from "@/lib/inventory-storage-adapter";
import { LineItemRow } from "./LineItemRow";
import { AddItemPicker } from "./AddItemPicker";
import { printDocument } from "@/lib/document-print";

export type DocumentType = "quote" | "invoice";
export type EditorMode = "create" | "edit";

export interface EditorSaveData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shipToAddress?: string;
  salesmanName?: string;
  lineItems: DocLineItem[];
  discount: number;
  discountType: "dollar" | "percent";
  shippingCost: number;
  tax: number;
  notes?: string;
  isDraft?: boolean;
  subtotal: number;
  total: number;
}

export interface EditorInitialData {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shipToAddress?: string;
  salesmanName?: string;
  items: DocLineItem[];
  discount?: number;
  shippingCost?: number;
  tax?: number;
  notes?: string;
}

interface InvoiceQuoteEditorProps {
  documentType: DocumentType;
  mode: EditorMode;
  documentNumber: string;
  initialData: EditorInitialData;
  availableInventory?: InventoryItem[];
  onBack?: () => void;
  onSave: (data: EditorSaveData) => Promise<void> | void;
  isSubmitting?: boolean;
  showDraftButton?: boolean;
  /** Show warning banner (e.g., editing a finalized invoice) */
  warningMessage?: string;
  /** Custom labels */
  primaryActionLabel?: string;
  draftActionLabel?: string;
}

export const InvoiceQuoteEditor = ({
  documentType,
  mode,
  documentNumber,
  initialData,
  availableInventory = [],
  onBack,
  onSave,
  isSubmitting = false,
  showDraftButton = true,
  warningMessage,
  primaryActionLabel,
  draftActionLabel = "Save as Draft",
}: InvoiceQuoteEditorProps) => {
  const isInvoice = documentType === "invoice";

  const [customerName, setCustomerName] = useState(initialData.customerName || "");
  const [customerEmail, setCustomerEmail] = useState(initialData.customerEmail || "");
  const [customerPhone, setCustomerPhone] = useState(initialData.customerPhone || "");
  const [shipToAddress, setShipToAddress] = useState(initialData.shipToAddress || "");
  const [salesmanName, setSalesmanName] = useState(initialData.salesmanName || "");
  const [notes, setNotes] = useState(initialData.notes || "");

  const [lineItems, setLineItems] = useState<DocLineItem[]>(
    initialData.items.map((i) => ({ ...i, quantity: i.quantity || 1 }))
  );
  const [discount, setDiscount] = useState(initialData.discount || 0);
  const [discountType, setDiscountType] = useState<"dollar" | "percent">("dollar");
  const [shippingCost, setShippingCost] = useState(initialData.shippingCost || 0);
  const [tax, setTax] = useState(initialData.tax || 0);

  // Re-sync if initialData changes (e.g., switching docs)
  useEffect(() => {
    setLineItems(initialData.items.map((i) => ({ ...i, quantity: i.quantity || 1 })));
  }, [initialData.items]);

  const subtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + (item.quantity || 1) * (item.price || 0), 0),
    [lineItems]
  );
  const discountAmount = discountType === "percent" ? (subtotal * discount) / 100 : discount;
  const total = Math.max(0, subtotal - discountAmount + shippingCost + tax);

  const updateLineItem = (index: number, field: keyof DocLineItem, value: string | number) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addInventoryItem = (item: InventoryItem) => {
    setLineItems((prev) => [
      ...prev,
      {
        itemId: item.id,
        partNumber: item.partNumber,
        serialNumber: item.serialNumber,
        description: item.description,
        price: item.salePrice,
        quantity: 1,
      },
    ]);
  };

  const handleSave = (isDraft = false) => {
    onSave({
      customerName,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      shipToAddress: shipToAddress || undefined,
      salesmanName: salesmanName || undefined,
      lineItems,
      discount: discountAmount,
      discountType,
      shippingCost,
      tax,
      notes: notes || undefined,
      isDraft,
      subtotal,
      total,
    });
  };

  const handlePrint = () => {
    printDocument({
      type: documentType,
      number: documentNumber,
      isDraft: false,
      customerName,
      customerEmail,
      customerPhone,
      shipToAddress,
      salesmanName,
      items: lineItems,
      subtotal,
      discount: discountAmount,
      shippingCost,
      tax,
      total,
      notes,
    });
  };

  const docTitle = isInvoice ? "INVOICE" : "QUOTE";
  const defaultPrimaryLabel = isInvoice
    ? mode === "edit"
      ? "Save Changes"
      : "Finalize Invoice"
    : mode === "edit"
    ? "Save Changes"
    : "Create Quote";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-lg font-semibold">
            {mode === "edit" ? `Edit ${docTitle}` : `${docTitle} Preview`}
          </h2>
        </div>
        <div className="flex gap-2">
          {availableInventory.length > 0 && (
            <AddItemPicker
              availableItems={availableInventory}
              onAdd={addInventoryItem}
              excludedIds={lineItems.map((l) => l.itemId)}
            />
          )}
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {warningMessage && (
        <Alert variant="destructive" className="mt-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{warningMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex-1 overflow-y-auto pr-2">
        <div className="bg-white dark:bg-card border rounded-lg shadow-sm p-6 my-4 space-y-6">
          {/* Doc Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-primary">{docTitle}</h1>
              <p className="text-sm text-muted-foreground mt-1">#{documentNumber}</p>
              <p className="text-sm text-muted-foreground">
                Date: {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="text-right text-sm space-y-1">
              <Label className="text-xs text-muted-foreground">Salesman</Label>
              <Input
                value={salesmanName}
                onChange={(e) => setSalesmanName(e.target.value)}
                className="text-sm h-8 w-48"
                placeholder="Salesman name"
              />
            </div>
          </div>

          <Separator />

          {/* Customer info */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Bill To</h3>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name *"
                className="text-sm"
              />
              <Input
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Email"
                type="email"
                className="text-sm"
              />
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Ship To</h3>
              <Textarea
                value={shipToAddress}
                onChange={(e) => setShipToAddress(e.target.value)}
                placeholder="Shipping address"
                className="text-sm min-h-[100px]"
              />
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Items</h3>
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
              <div className="col-span-2">Part #</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-2">Serial #</div>
              <div className="col-span-1 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1"></div>
            </div>

            {lineItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                No items. Use "Add Item" to insert from inventory.
              </p>
            ) : (
              lineItems.map((item, index) => (
                <LineItemRow
                  key={`${item.itemId}-${index}`}
                  item={item}
                  index={index}
                  onUpdate={updateLineItem}
                  onRemove={removeLineItem}
                />
              ))
            )}
          </div>

          <Separator />

          {/* Notes & Totals */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-sm mb-2">Notes / Terms</h3>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes, payment terms, or special instructions..."
                className="text-sm min-h-[120px]"
              />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>

              {/* Discount */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">Discount:</span>
                <div className="flex items-center gap-2">
                  <div className="flex border rounded-md overflow-hidden">
                    <Button
                      type="button"
                      variant={discountType === "dollar" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDiscountType("dollar")}
                      className="h-8 px-2 rounded-none"
                    >
                      $
                    </Button>
                    <Button
                      type="button"
                      variant={discountType === "percent" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDiscountType("percent")}
                      className="h-8 px-2 rounded-none"
                    >
                      %
                    </Button>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-24 text-right"
                  />
                </div>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span></span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}

              {/* Shipping */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">Shipping:</span>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                    className="pl-6 text-right"
                  />
                </div>
              </div>

              {/* Tax */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">Tax:</span>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tax}
                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                    className="pl-6 text-right"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-2xl font-bold text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-4 border-t">
        {onBack ? (
          <Button variant="outline" onClick={onBack}>
            {mode === "edit" ? "Cancel" : "Back"}
          </Button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          {showDraftButton && (
            <Button
              variant="secondary"
              onClick={() => handleSave(true)}
              disabled={lineItems.length === 0 || isSubmitting || !customerName.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              {draftActionLabel}
            </Button>
          )}
          <Button
            onClick={() => handleSave(false)}
            disabled={lineItems.length === 0 || isSubmitting || !customerName.trim()}
          >
            <FileCheck className="h-4 w-4 mr-2" />
            {isSubmitting ? "Saving..." : primaryActionLabel || defaultPrimaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
