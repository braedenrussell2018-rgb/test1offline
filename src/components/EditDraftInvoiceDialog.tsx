import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Save, CheckCircle, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, Invoice, InventoryItem } from "@/lib/inventory-storage";

interface EditDraftInvoiceDialogProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

interface LineItem {
  itemId: string;
  partNumber: string;
  serialNumber?: string;
  description: string;
  price: number;
}

export const EditDraftInvoiceDialog = ({
  invoice,
  open,
  onOpenChange,
  onSave,
}: EditDraftInvoiceDialogProps) => {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [salesmanName, setSalesmanName] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'dollar' | 'percent'>('dollar');
  const [shippingCost, setShippingCost] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && invoice) {
      setLineItems(
        invoice.items.map((item) => ({
          itemId: item.itemId,
          partNumber: item.partNumber,
          serialNumber: item.serialNumber,
          description: item.description,
          price: item.price,
        }))
      );
      setCustomerName(invoice.customerName || "");
      setCustomerEmail(invoice.customerEmail || "");
      setCustomerPhone(invoice.customerPhone || "");
      setShipToAddress(invoice.shipToAddress || "");
      setSalesmanName(invoice.salesmanName || "");
      setDiscount(invoice.discount || 0);
      setShippingCost(invoice.shippingCost || 0);
      
      // Load available items for adding
      loadAvailableItems();
    }
  }, [open, invoice]);

  const loadAvailableItems = async () => {
    try {
      const items = await inventoryStorage.getItems();
      setAvailableItems(items.filter(item => item.status === 'available'));
    } catch (error) {
      console.error('Error loading available items:', error);
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItemToInvoice = (item: InventoryItem) => {
    setLineItems((prev) => [
      ...prev,
      {
        itemId: item.id,
        partNumber: item.partNumber,
        serialNumber: item.serialNumber,
        description: item.description,
        price: item.salePrice,
      },
    ]);
    setShowAddItem(false);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.price, 0);
  const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;
  const total = subtotal - discountAmount + shippingCost;

  const handleSave = async (finalize: boolean = false) => {
    if (lineItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await inventoryStorage.updateInvoice(invoice.id, {
        customerName,
        customerEmail,
        customerPhone,
        shipToAddress,
        salesmanName,
        items: lineItems,
        subtotal,
        discount: discountAmount,
        shippingCost,
        total,
        status: finalize ? 'finalized' : 'draft',
      });

      // If finalizing, mark items as sold
      if (finalize) {
        for (const item of lineItems) {
          await inventoryStorage.updateItem(item.itemId, {
            status: 'sold',
            soldDate: new Date().toISOString(),
            invoiceId: invoice.id,
          });
        }
      }

      toast({
        title: "Success",
        description: finalize 
          ? `Invoice ${invoice.invoiceNumber} has been finalized`
          : `Draft ${invoice.invoiceNumber} has been saved`,
      });
      
      onOpenChange(false);
      onSave();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast({
        title: "Error",
        description: "Failed to save invoice",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            .invoice-header { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .invoice-title { font-size: 28px; font-weight: bold; color: #2563eb; }
            .invoice-meta { font-size: 12px; color: #666; margin-top: 5px; }
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
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            <div>
              <div class="invoice-title">INVOICE (DRAFT)</div>
              <div class="invoice-meta">#${invoice.invoiceNumber}</div>
              <div class="invoice-meta">Date: ${new Date().toLocaleDateString()}</div>
            </div>
            ${salesmanName ? `<div class="invoice-meta">Salesman: ${salesmanName}</div>` : ''}
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

  // Filter out items already in the invoice
  const itemsAlreadyInInvoice = new Set(lineItems.map(li => li.itemId));
  const itemsToAdd = availableItems.filter(item => !itemsAlreadyInInvoice.has(item.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Edit Draft - {invoice.invoiceNumber}</span>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div className="space-y-2">
                <Label>Salesman</Label>
                <Input
                  value={salesmanName}
                  onChange={(e) => setSalesmanName(e.target.value)}
                  placeholder="Salesman name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Ship To Address</Label>
                <Textarea
                  value={shipToAddress}
                  onChange={(e) => setShipToAddress(e.target.value)}
                  placeholder="Shipping address"
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Line Items</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddItem(!showAddItem)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {showAddItem && itemsToAdd.length > 0 && (
                <div className="border rounded-lg p-3 bg-muted/50 max-h-48 overflow-auto">
                  <p className="text-sm text-muted-foreground mb-2">Select an item to add:</p>
                  <div className="space-y-2">
                    {itemsToAdd.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 bg-background rounded border cursor-pointer hover:bg-accent/50"
                        onClick={() => addItemToInvoice(item)}
                      >
                        <div>
                          <span className="font-medium">{item.partNumber}</span>
                          <span className="text-sm text-muted-foreground ml-2">{item.description}</span>
                        </div>
                        <span className="text-sm font-medium">${item.salePrice.toFixed(2)}</span>
                      </div>
                    ))}
                    {itemsToAdd.length > 10 && (
                      <p className="text-xs text-muted-foreground">+{itemsToAdd.length - 10} more items</p>
                    )}
                  </div>
                </div>
              )}

              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                <div className="col-span-2">Part #</div>
                <div className="col-span-4">Description</div>
                <div className="col-span-3">Serial #</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-1"></div>
              </div>

              {lineItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No items added</p>
              ) : (
                lineItems.map((item, index) => (
                  <div
                    key={item.itemId + index}
                    className="grid grid-cols-12 gap-2 items-start py-2 border-b border-dashed"
                  >
                    <div className="col-span-2">
                      <p className="text-sm font-medium">{item.partNumber}</p>
                    </div>
                    <div className="col-span-4">
                      <Textarea
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        className="min-h-[60px] text-sm resize-none"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        value={item.serialNumber || ""}
                        onChange={(e) => updateLineItem(index, 'serialNumber', e.target.value)}
                        className="text-sm"
                        placeholder="Serial #"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={(e) => updateLineItem(index, 'price', parseFloat(e.target.value) || 0)}
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

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-80 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>

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

                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">Shipping:</span>
                  <div className="relative w-24">
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

                <Separator />

                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-semibold">Total:</span>
                  <span className="text-2xl font-bold text-primary">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-between gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => handleSave(false)}
              disabled={lineItems.length === 0 || isSubmitting}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={lineItems.length === 0 || isSubmitting}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isSubmitting ? "Saving..." : "Finalize Invoice"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
