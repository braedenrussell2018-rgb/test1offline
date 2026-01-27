import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Trash2, Printer } from "lucide-react";
import { InventoryItem } from "@/lib/inventory-storage";

export interface QuoteLineItem {
  itemId: string;
  partNumber: string;
  serialNumber?: string;
  description: string;
  price: number;
  cost: number;
}

interface QuotePreviewEditorProps {
  items: InventoryItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  salesmanName: string;
  shipToAddress: string;
  quoteNumber: string;
  onBack: () => void;
  onCreateQuote: (data: {
    lineItems: QuoteLineItem[];
    discount: number;
    discountType: 'dollar' | 'percent';
    shippingCost: number;
  }) => void;
  isSubmitting?: boolean;
}

export const QuotePreviewEditor = ({
  items,
  customerName,
  customerEmail,
  customerPhone,
  salesmanName,
  shipToAddress,
  quoteNumber,
  onBack,
  onCreateQuote,
  isSubmitting = false,
}: QuotePreviewEditorProps) => {
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'dollar' | 'percent'>('dollar');
  const [shippingCost, setShippingCost] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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

  const updateLineItem = (index: number, field: keyof QuoteLineItem, value: string | number) => {
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
    onCreateQuote({
      lineItems,
      discount,
      discountType,
      shippingCost,
    });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quote ${quoteNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            .quote-header { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .quote-title { font-size: 28px; font-weight: bold; color: #2563eb; }
            .quote-meta { font-size: 12px; color: #666; margin-top: 5px; }
            .section { margin-bottom: 25px; }
            .section-title { font-weight: bold; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; color: #666; }
            .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
            .customer-info p { font-size: 13px; margin: 3px 0; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .items-table th { text-align: left; font-size: 11px; color: #666; padding: 8px 0; border-bottom: 2px solid #e5e5e5; }
            .items-table td { padding: 12px 0; border-bottom: 1px solid #e5e5e5; font-size: 13px; vertical-align: top; }
            .items-table .price { text-align: right; }
            .totals { margin-top: 20px; margin-left: auto; width: 250px; }
            .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
            .totals-row.total { border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; font-size: 16px; font-weight: bold; }
            .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #666; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="quote-header">
            <div>
              <div class="quote-title">QUOTE</div>
              <div class="quote-meta">#${quoteNumber}</div>
              <div class="quote-meta">Date: ${new Date().toLocaleDateString()}</div>
            </div>
            ${salesmanName ? `<div class="quote-meta">Salesman: ${salesmanName}</div>` : ''}
          </div>
          
          <div class="customer-grid section">
            <div>
              <div class="section-title">Bill To</div>
              <div class="customer-info">
                <p><strong>${customerName || '—'}</strong></p>
                ${customerEmail ? `<p>${customerEmail}</p>` : ''}
                ${customerPhone ? `<p>${customerPhone}</p>` : ''}
              </div>
            </div>
            <div>
              <div class="section-title">Ship To</div>
              <div class="customer-info">
                <p>${shipToAddress || '—'}</p>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Items</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 20%">Part #</th>
                  <th style="width: 40%">Description</th>
                  <th style="width: 25%">Serial #</th>
                  <th style="width: 15%" class="price">Price</th>
                </tr>
              </thead>
              <tbody>
                ${lineItems.map(item => `
                  <tr>
                    <td>${item.partNumber}</td>
                    <td>${item.description}</td>
                    <td>${item.serialNumber || '—'}</td>
                    <td class="price">$${item.price.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="totals">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            ${discountAmount > 0 ? `
              <div class="totals-row">
                <span>Discount:</span>
                <span>-$${discountAmount.toFixed(2)}</span>
              </div>
            ` : ''}
            ${shippingCost > 0 ? `
              <div class="totals-row">
                <span>Shipping:</span>
                <span>$${shippingCost.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="totals-row total">
              <span>Total:</span>
              <span>$${total.toFixed(2)}</span>
            </div>
          </div>
          
          <div class="footer">
            This quote is valid for 30 days from the date of issue.
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">Quote Preview</h2>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <ScrollArea className="flex-1 pr-4">
        {/* PDF-like Quote Preview */}
        <div ref={printRef} className="bg-white dark:bg-card border rounded-lg shadow-sm p-6 my-4 space-y-6">
          {/* Quote Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-primary">QUOTE</h1>
              <p className="text-sm text-muted-foreground mt-1">#{quoteNumber}</p>
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
              <div className="col-span-4">Description</div>
              <div className="col-span-3">Serial #</div>
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
                  <div className="col-span-4">
                    <Textarea
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      className="min-h-[60px] text-sm resize-none"
                      placeholder="Item description..."
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      value={item.serialNumber || ""}
                      onChange={(e) => updateLineItem(index, 'serialNumber', e.target.value)}
                      className="text-sm"
                      placeholder="Enter serial #..."
                    />
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

              {/* Valid for note */}
              <p className="text-xs text-muted-foreground text-center pt-2">
                This quote is valid for 30 days from the date of issue.
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          Back to Selection
        </Button>
        <Button 
          onClick={handleCreate} 
          disabled={lineItems.length === 0 || isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create Quote"}
        </Button>
      </div>
    </div>
  );
};
