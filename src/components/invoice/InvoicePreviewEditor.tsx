import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Trash2 } from "lucide-react";
import { InventoryItem } from "@/lib/inventory-storage";

export interface InvoiceLineItem {
  itemId: string;
  partNumber: string;
  serialNumber?: string;
  description: string;
  price: number;
  cost: number;
}

interface InvoicePreviewEditorProps {
  items: InventoryItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  salesmanName: string;
  shipToAddress: string;
  invoiceNumber: string;
  onBack: () => void;
  onCreateInvoice: (data: {
    lineItems: InvoiceLineItem[];
    discount: number;
    discountType: 'dollar' | 'percent';
    shippingCost: number;
  }) => void;
  isSubmitting?: boolean;
}

export const InvoicePreviewEditor = ({
  items,
  customerName,
  customerEmail,
  customerPhone,
  salesmanName,
  shipToAddress,
  invoiceNumber,
  onBack,
  onCreateInvoice,
  isSubmitting = false,
}: InvoicePreviewEditorProps) => {
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'dollar' | 'percent'>('dollar');
  const [shippingCost, setShippingCost] = useState(0);

  useEffect(() => {
    // Initialize line items from selected inventory items
    setLineItems(
      items.map((item) => ({
        itemId: item.id,
        partNumber: item.partNumber,
        serialNumber: item.serialNumber,
        description: item.description,
        price: item.salePrice,
        cost: item.cost,
      }))
    );
  }, [items]);

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.price, 0);
  const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;
  const total = subtotal - discountAmount + shippingCost;

  const handleCreate = () => {
    onCreateInvoice({
      lineItems,
      discount,
      discountType,
      shippingCost,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">Invoice Preview</h2>
      </div>

      <ScrollArea className="flex-1 pr-4">
        {/* PDF-like Invoice Preview */}
        <div className="bg-white dark:bg-card border rounded-lg shadow-sm p-6 my-4 space-y-6">
          {/* Invoice Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-primary">INVOICE</h1>
              <p className="text-sm text-muted-foreground mt-1">#{invoiceNumber}</p>
              <p className="text-sm text-muted-foreground">
                Date: {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="text-right text-sm">
              {salesmanName && (
                <p className="text-muted-foreground">Salesman: {salesmanName}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-sm mb-2">Bill To:</h3>
              <div className="text-sm space-y-1">
                <p className="font-medium">{customerName || "—"}</p>
                {customerEmail && <p className="text-muted-foreground">{customerEmail}</p>}
                {customerPhone && <p className="text-muted-foreground">{customerPhone}</p>}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">Ship To:</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {shipToAddress || "—"}
              </p>
            </div>
          </div>

          <Separator />

          {/* Line Items Table */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Items</h3>
            
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
              <div className="col-span-2">Part #</div>
              <div className="col-span-5">Description</div>
              <div className="col-span-2">Serial #</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-1"></div>
            </div>

            {/* Line Items */}
            {lineItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No items added</p>
            ) : (
              lineItems.map((item, index) => (
                <div
                  key={item.itemId}
                  className="grid grid-cols-12 gap-2 items-start py-2 border-b border-dashed"
                >
                  <div className="col-span-2">
                    <p className="text-sm font-medium">{item.partNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      Cost: ${item.cost.toFixed(2)}
                    </p>
                  </div>
                  <div className="col-span-5">
                    <Textarea
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      className="min-h-[60px] text-sm resize-none"
                      placeholder="Item description..."
                    />
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">
                      {item.serialNumber || "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) =>
                          updateLineItem(index, 'price', parseFloat(e.target.value) || 0)
                        }
                        className="pl-6 text-right"
                      />
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <Separator />

          {/* Totals Section */}
          <div className="flex justify-end">
            <div className="w-80 space-y-3">
              {/* Subtotal */}
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
                      variant={discountType === 'dollar' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDiscountType('dollar')}
                      className="h-8 px-2 rounded-none"
                    >
                      $
                    </Button>
                    <Button
                      type="button"
                      variant={discountType === 'percent' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDiscountType('percent')}
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
                <div className="relative w-24">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    $
                  </span>
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

              <Separator />

              {/* Total */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-2xl font-bold text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          Back to Selection
        </Button>
        <Button 
          onClick={handleCreate} 
          disabled={lineItems.length === 0 || isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create Invoice"}
        </Button>
      </div>
    </div>
  );
};
