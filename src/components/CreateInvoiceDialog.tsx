import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, InventoryItem } from "@/lib/inventory-storage";

interface CreateInvoiceDialogProps {
  onInvoiceCreated: () => void;
}

export const CreateInvoiceDialog = ({ onInvoiceCreated }: CreateInvoiceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const items = inventoryStorage.getItems().filter(item => item.status === 'available');
      setAvailableItems(items);
      setSelectedItems(new Map());
    }
  }, [open]);

  const handleToggleItem = (itemId: string, checked: boolean) => {
    const newSelected = new Map(selectedItems);
    if (checked) {
      const item = availableItems.find(i => i.id === itemId);
      if (item) {
        newSelected.set(itemId, item.cost);
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
      newSelected.set(itemId, priceNum);
      setSelectedItems(newSelected);
    }
  };

  const handleToggleItemWithSalePrice = (itemId: string, checked: boolean) => {
    const newSelected = new Map(selectedItems);
    if (checked) {
      const item = availableItems.find(i => i.id === itemId);
      if (item) {
        newSelected.set(itemId, item.salePrice);
      }
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
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

    const invoiceItems = Array.from(selectedItems.entries()).map(([itemId, price]) => {
      const item = availableItems.find(i => i.id === itemId)!;
      return {
        itemId,
        partNumber: item.partNumber,
        serialNumber: item.serialNumber,
        description: item.description,
        price,
      };
    });

    const invoice = inventoryStorage.createInvoice(invoiceItems);

    // Mark items as sold
    invoiceItems.forEach(({ itemId }) => {
      inventoryStorage.updateItem(itemId, {
        status: 'sold',
        soldDate: new Date().toISOString(),
        invoiceId: invoice.id,
      });
    });

    toast({
      title: "Success",
      description: `Invoice ${invoice.invoiceNumber} created`,
    });

    setOpen(false);
    onInvoiceCreated();
  };

  const total = Array.from(selectedItems.values()).reduce((sum, price) => sum + price, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {availableItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No available items in inventory
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {availableItems.map((item) => {
                  const isSelected = selectedItems.has(item.id);
                  const price = selectedItems.get(item.id) || item.cost;
                  
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
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <div className="space-y-1">
                            <Label htmlFor={`price-${item.id}`} className="text-xs">
                              Sell Price
                            </Label>
                            <Input
                              id={`price-${item.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={price}
                              onChange={(e) => handlePriceChange(item.id, e.target.value)}
                              className="w-24"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold">Total:</span>
                  <span className="text-xl font-bold">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-end gap-2">
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
