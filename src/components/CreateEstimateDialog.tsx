import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, InventoryItem } from "@/lib/inventory-storage";
import jsPDF from "jspdf";

interface CreateEstimateDialogProps {
  onEstimateCreated: () => void;
}

export const CreateEstimateDialog = ({ onEstimateCreated }: CreateEstimateDialogProps) => {
  const [open, setOpen] = useState(false);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Map<string, { price: number }>>(new Map());
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
      const loadItems = async () => {
        const items = await inventoryStorage.getItems();
        const availableItems = items.filter(item => item.status === 'available');
        setAvailableItems(availableItems);
        setFilteredItems(availableItems);
      };
      loadItems();
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
        newSelected.set(itemId, { price: item.salePrice });
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
        newSelected.set(itemId, { price: priceNum });
        setSelectedItems(newSelected);
      }
    }
  };

  const generatePDF = (estimate: any) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("ESTIMATE", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Estimate #: ${estimate.estimateNumber}`, 20, 35);
    doc.text(`Date: ${new Date(estimate.createdAt).toLocaleDateString()}`, 20, 40);
    
    // Customer Info
    if (estimate.customerName) {
      doc.setFontSize(12);
      doc.text("Bill To:", 20, 55);
      doc.setFontSize(10);
      doc.text(estimate.customerName, 20, 60);
      if (estimate.customerEmail) doc.text(estimate.customerEmail, 20, 65);
      if (estimate.customerPhone) doc.text(estimate.customerPhone, 20, 70);
    }
    
    // Ship To
    if (estimate.shipToAddress) {
      doc.setFontSize(12);
      doc.text("Ship To:", 120, 55);
      doc.setFontSize(10);
      doc.text(estimate.shipToAddress.street, 120, 60);
      doc.text(`${estimate.shipToAddress.city}, ${estimate.shipToAddress.state} ${estimate.shipToAddress.zip}`, 120, 65);
    }
    
    // Items Table
    let y = 90;
    doc.setFontSize(10);
    doc.text("Part Number", 20, y);
    doc.text("Description", 70, y);
    doc.text("Price", 170, y);
    
    y += 5;
    doc.line(20, y, 190, y);
    y += 7;
    
    estimate.items.forEach((item: any) => {
      doc.text(item.partNumber, 20, y);
      const description = item.description.length > 40 ? item.description.substring(0, 40) + "..." : item.description;
      doc.text(description, 70, y);
      doc.text(`$${item.price.toFixed(2)}`, 170, y);
      if (item.serialNumber) {
        y += 5;
        doc.setFontSize(8);
        doc.text(`SN: ${item.serialNumber}`, 70, y);
        doc.setFontSize(10);
      }
      y += 7;
    });
    
    // Totals
    y += 5;
    doc.line(140, y, 190, y);
    y += 7;
    
    doc.text("Subtotal:", 140, y);
    doc.text(`$${estimate.subtotal.toFixed(2)}`, 170, y);
    y += 7;
    
    if (estimate.discount > 0) {
      doc.text("Discount:", 140, y);
      doc.text(`-$${estimate.discount.toFixed(2)}`, 170, y);
      y += 7;
    }
    
    if (estimate.shippingCost > 0) {
      doc.text("Shipping:", 140, y);
      doc.text(`$${estimate.shippingCost.toFixed(2)}`, 170, y);
      y += 7;
    }
    
    doc.setFontSize(12);
    doc.text("Total:", 140, y);
    doc.text(`$${estimate.total.toFixed(2)}`, 170, y);
    
    // Footer
    doc.setFontSize(8);
    doc.text("This estimate is valid for 30 days from the date of issue.", 105, 280, { align: "center" });
    
    doc.save(`estimate-${estimate.estimateNumber}.pdf`);
  };

  const handleCreateEstimate = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one item",
        variant: "destructive",
      });
      return;
    }

    const estimateItems = Array.from(selectedItems.entries()).map(([itemId, data]) => {
      const item = availableItems.find(i => i.id === itemId)!;
      return {
        itemId,
        partNumber: item.partNumber,
        serialNumber: item.serialNumber,
        description: item.description,
        price: data.price,
      };
    });

    const subtotal = estimateItems.reduce((sum, item) => sum + item.price, 0);
    const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;
    const total = subtotal - discountAmount + shippingCost;

    const shipToAddressStr = (shipStreet || shipCity || shipState || shipZip) 
      ? `${shipStreet}, ${shipCity}, ${shipState} ${shipZip}`.trim()
      : undefined;

    const estimateNumber = `EST-${Date.now()}`;

    const estimate = await inventoryStorage.createEstimate({
      estimateNumber,
      items: estimateItems,
      customerName: customerName || undefined,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      shipToAddress: shipToAddressStr,
      discount: discountAmount,
      shippingCost,
      subtotal,
      total,
      status: 'pending',
    });

    generatePDF(estimate);

    toast({
      title: "Success",
      description: `Estimate ${estimate.estimateNumber} created and PDF downloaded`,
    });

    setOpen(false);
    onEstimateCreated();
  };

  const subtotal = Array.from(selectedItems.values()).reduce((sum, data) => sum + data.price, 0);
  const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;
  const total = subtotal - discountAmount + shippingCost;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Create Estimate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Estimate</DialogTitle>
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
                              <div className="space-y-1">
                                <Label htmlFor={`price-${item.id}`} className="text-xs">
                                  Price
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="discount">Discount</Label>
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
                    <Label htmlFor="discountType">Type</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={discountType === 'dollar' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDiscountType('dollar')}
                        className="flex-1"
                      >
                        $
                      </Button>
                      <Button
                        type="button"
                        variant={discountType === 'percent' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDiscountType('percent')}
                        className="flex-1"
                      >
                        %
                      </Button>
                    </div>
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
                    <span>-${discountAmount.toFixed(2)}</span>
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
                  <Button onClick={handleCreateEstimate} disabled={selectedItems.size === 0}>
                    Create Estimate & Download PDF
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
