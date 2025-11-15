import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, InventoryItem } from "@/lib/inventory-storage";

interface CreateInvoiceDialogProps {
  onInvoiceCreated: () => void;
}

export const CreateInvoiceDialog = ({ onInvoiceCreated }: CreateInvoiceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Map<string, { price: number; quantity: number; serialNumbers: string[] }>>(new Map());
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shipStreet, setShipStreet] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipState, setShipState] = useState("");
  const [shipZip, setShipZip] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'dollar' | 'percent'>('dollar');
  const [shippingCost, setShippingCost] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const items = inventoryStorage.getItems().filter(item => item.status === 'available');
      setAvailableItems(items);
      setFilteredItems(items);
      setSelectedItems(new Map());
      setSearchQuery("");
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setShipStreet("");
      setShipCity("");
      setShipState("");
      setShipZip("");
      setDiscount(0);
      setShippingCost(0);
    }
  }, [open]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(availableItems);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = availableItems.filter(item => 
      item.partNumber.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.serialNumber?.toLowerCase().includes(query)
    );
    setFilteredItems(filtered);
  }, [searchQuery, availableItems]);

  const handleToggleItemWithSalePrice = (itemId: string, checked: boolean) => {
    const newSelected = new Map(selectedItems);
    if (checked) {
      const item = availableItems.find(i => i.id === itemId);
      if (item) {
        newSelected.set(itemId, { price: item.salePrice, quantity: 1, serialNumbers: [''] });
      }
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handlePriceChange = (itemId: string, price: string) => {
    const priceNum = parseFloat(price);
    if (!isNaN(priceNum) && priceNum >= 0) {
      const newSelected = new Map(selectedItems);
      const current = newSelected.get(itemId);
      if (current) {
        newSelected.set(itemId, { ...current, price: priceNum });
        setSelectedItems(newSelected);
      }
    }
  };

  const handleQuantityChange = (itemId: string, quantity: string) => {
    const qtyNum = parseInt(quantity);
    if (!isNaN(qtyNum) && qtyNum > 0) {
      const newSelected = new Map(selectedItems);
      const current = newSelected.get(itemId);
      if (current) {
        const newSerialNumbers = Array(qtyNum).fill('').map((_, i) => current.serialNumbers[i] || '');
        newSelected.set(itemId, { ...current, quantity: qtyNum, serialNumbers: newSerialNumbers });
        setSelectedItems(newSelected);
      }
    }
  };

  const handleSerialNumberChange = (itemId: string, index: number, serialNumber: string) => {
    const newSelected = new Map(selectedItems);
    const current = newSelected.get(itemId);
    if (current) {
      const newSerialNumbers = [...current.serialNumbers];
      newSerialNumbers[index] = serialNumber;
      newSelected.set(itemId, { ...current, serialNumbers: newSerialNumbers });
      setSelectedItems(newSelected);
    }
  };

  const handleCreateInvoice = () => {
    if (selectedItems.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one item",
        variant: "destructive",
      });
      return;
    }

    // Validate serial numbers
    for (const [itemId, data] of selectedItems.entries()) {
      if (data.quantity > 1) {
        const hasEmptySerials = data.serialNumbers.some(sn => !sn.trim());
        if (hasEmptySerials) {
          const item = availableItems.find(i => i.id === itemId);
          toast({
            title: "Error",
            description: `Please enter all serial numbers for ${item?.partNumber}`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const invoiceItems = Array.from(selectedItems.entries()).flatMap(([itemId, data]) => {
      const item = availableItems.find(i => i.id === itemId)!;
      return Array(data.quantity).fill(null).map((_, idx) => ({
        itemId,
        partNumber: item.partNumber,
        serialNumber: data.quantity > 1 ? data.serialNumbers[idx] : item.serialNumber,
        description: item.description,
        price: data.price,
      }));
    });

    const subtotal = invoiceItems.reduce((sum, item) => sum + item.price, 0);
    const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;

    const invoice = inventoryStorage.createInvoice({
      items: invoiceItems,
      customerName: customerName || undefined,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      shipToAddress: (shipStreet || shipCity || shipState || shipZip) ? {
        street: shipStreet,
        city: shipCity,
        state: shipState,
        zip: shipZip,
      } : undefined,
      discount: discountAmount,
      shippingCost,
    });

    // Mark items as sold
    selectedItems.forEach((data, itemId) => {
      inventoryStorage.updateItem(itemId, {
        status: 'sold',
        soldDate: new Date().toISOString(),
        invoiceId: invoice.id,
      });
    });

    toast({
      title: "Success",
      description: `Invoice ${invoice.invoiceNumber} created successfully`,
    });

    setOpen(false);
    onInvoiceCreated();
  };

  const subtotal = Array.from(selectedItems.values()).reduce((sum, data) => sum + (data.price * data.quantity), 0);
  const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;
  const total = subtotal - discountAmount + shippingCost;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {availableItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No available items in inventory
            </p>
          ) : (
            <>
              {/* Customer Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="customerEmail">Email</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="customerPhone">Phone</Label>
                    <Input
                      id="customerPhone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Ship To Address</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="shipStreet">Street Address</Label>
                    <Input
                      id="shipStreet"
                      value={shipStreet}
                      onChange={(e) => setShipStreet(e.target.value)}
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="shipCity">City</Label>
                      <Input
                        id="shipCity"
                        value={shipCity}
                        onChange={(e) => setShipCity(e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="shipState">State</Label>
                      <Input
                        id="shipState"
                        value={shipState}
                        onChange={(e) => setShipState(e.target.value)}
                        placeholder="State"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="shipZip">ZIP Code</Label>
                      <Input
                        id="shipZip"
                        value={shipZip}
                        onChange={(e) => setShipZip(e.target.value)}
                        placeholder="12345"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Selection with Search */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Select Items</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by part number, description, or serial number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredItems.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No items found</p>
                  ) : (
                    filteredItems.map((item) => {
                      const itemData = selectedItems.get(item.id);
                      const isSelected = selectedItems.has(item.id);
                      
                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 border rounded-lg bg-card"
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleToggleItemWithSalePrice(item.id, checked as boolean)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{item.partNumber}</div>
                            {item.serialNumber && (
                              <div className="text-xs text-muted-foreground">SN: {item.serialNumber}</div>
                            )}
                            <div className="text-sm text-muted-foreground truncate">
                              {item.description}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Cost: ${item.cost.toFixed(2)} | Sale: ${item.salePrice.toFixed(2)}
                            </div>
                          </div>
                          {isSelected && itemData && (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label htmlFor={`price-${item.id}`} className="text-xs">
                                    Sell Price
                                  </Label>
                                  <Input
                                    id={`price-${item.id}`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={itemData.price}
                                    onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                    className="w-24"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`qty-${item.id}`} className="text-xs">
                                    Qty
                                  </Label>
                                  <Input
                                    id={`qty-${item.id}`}
                                    type="number"
                                    min="1"
                                    value={itemData.quantity}
                                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                    className="w-20"
                                  />
                                </div>
                              </div>
                              {itemData.quantity > 1 && (
                                <div className="space-y-1">
                                  <Label className="text-xs">Serial Numbers</Label>
                                  {Array.from({ length: itemData.quantity }).map((_, idx) => (
                                    <Input
                                      key={idx}
                                      placeholder={`SN #${idx + 1}`}
                                      value={itemData.serialNumbers[idx] || ''}
                                      onChange={(e) => handleSerialNumberChange(item.id, idx, e.target.value)}
                                      className="text-xs"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Pricing Summary */}
              <div className="border-t pt-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="discount">Discount Amount</Label>
                    <Input
                      id="discount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="shippingCost">Shipping Cost</Label>
                    <Input
                      id="shippingCost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Discount:</span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Shipping:</span>
                    <span>${shippingCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="font-semibold">Total:</span>
                    <span className="text-xl font-bold">${total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateInvoice} disabled={selectedItems.size === 0}>
                    Create Invoice
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
