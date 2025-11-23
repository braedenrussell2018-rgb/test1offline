import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, PackagePlus } from "lucide-react";
import { InventoryItem, inventoryStorage } from "@/lib/inventory-storage";
import { useToast } from "@/hooks/use-toast";

interface ItemDetailDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemAdded?: () => void;
}

export const ItemDetailDialog = ({ item, open, onOpenChange, onItemAdded }: ItemDetailDialogProps) => {
  const [showAddQuantity, setShowAddQuantity] = useState(false);
  const [newSerialNumbers, setNewSerialNumbers] = useState<string[]>(['']);
  const { toast } = useToast();

  if (!item) return null;

  const handleAddSerialNumber = () => {
    setNewSerialNumbers([...newSerialNumbers, '']);
  };

  const handleRemoveSerialNumber = (index: number) => {
    if (newSerialNumbers.length > 1) {
      setNewSerialNumbers(newSerialNumbers.filter((_, i) => i !== index));
    }
  };

  const handleSerialNumberChange = (index: number, value: string) => {
    const updated = [...newSerialNumbers];
    updated[index] = value;
    setNewSerialNumbers(updated);
  };

  const handleAddMoreQuantity = () => {
    const nonEmptySerials = newSerialNumbers.filter(sn => sn.trim());
    
    if (nonEmptySerials.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one serial number",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate serial numbers
    const uniqueSerials = new Set(nonEmptySerials);
    if (nonEmptySerials.length !== uniqueSerials.size) {
      toast({
        title: "Error",
        description: "Duplicate serial numbers detected",
        variant: "destructive",
      });
      return;
    }

    // Check if serial numbers already exist
    const existingItems = inventoryStorage.getItems();
    const existingSerials = existingItems
      .filter(i => i.partNumber === item.partNumber && i.serialNumber)
      .map(i => i.serialNumber);
    
    const duplicates = nonEmptySerials.filter(sn => existingSerials.includes(sn));
    if (duplicates.length > 0) {
      toast({
        title: "Error",
        description: `Serial numbers already exist: ${duplicates.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    // Add new items with same specs but different serial numbers
    nonEmptySerials.forEach((serial) => {
      inventoryStorage.addItem({
        partNumber: item.partNumber,
        serialNumber: serial,
        description: item.description,
        salePrice: item.salePrice,
        cost: item.cost,
        weight: item.weight,
        volume: item.volume,
        warranty: item.warranty,
        minReorderLevel: item.minReorderLevel,
        maxReorderLevel: item.maxReorderLevel,
        status: 'available',
      });
    });

    toast({
      title: "Success",
      description: `Added ${nonEmptySerials.length} more item${nonEmptySerials.length > 1 ? 's' : ''} with part number ${item.partNumber}`,
    });

    setNewSerialNumbers(['']);
    setShowAddQuantity(false);
    onItemAdded?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{item.partNumber}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Badge variant={item.status === 'available' ? 'default' : 'secondary'} className="text-sm">
              {item.status}
            </Badge>
            {item.serialNumber && (
              <span className="text-muted-foreground">SN: {item.serialNumber}</span>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground">{item.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Pricing</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sale Price:</span>
                  <span className="font-medium">${item.salePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost:</span>
                  <span className="font-medium">${item.cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin:</span>
                  <span className="font-medium text-green-600">
                    ${(item.salePrice - item.cost).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Physical Details</h3>
              <div className="space-y-2">
                {item.weight && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weight:</span>
                    <span className="font-medium">{item.weight} lbs</span>
                  </div>
                )}
                {item.volume && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Volume:</span>
                    <span className="font-medium">{item.volume} cu ft</span>
                  </div>
                )}
                {item.warranty && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Warranty:</span>
                    <span className="font-medium">{item.warranty}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {(item.minReorderLevel !== undefined || item.maxReorderLevel !== undefined) && (
            <div>
              <h3 className="font-semibold mb-2">Reorder Levels</h3>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min - Max:</span>
                <span className="font-medium">
                  {item.minReorderLevel ?? '-'} - {item.maxReorderLevel ?? '-'}
                </span>
              </div>
            </div>
          )}

          {item.soldDate && (
            <div>
              <h3 className="font-semibold mb-2">Sale Information</h3>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sold Date:</span>
                <span className="font-medium">{new Date(item.soldDate).toLocaleDateString()}</span>
              </div>
              {item.invoiceId && (
                <div className="flex justify-between mt-2">
                  <span className="text-muted-foreground">Invoice ID:</span>
                  <span className="font-medium">{item.invoiceId}</span>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Added:</span>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* Add More Quantity Section */}
          {item.status === 'available' && (
            <div className="pt-4 border-t">
              {!showAddQuantity ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddQuantity(true)}
                >
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Add More Quantity with Different Serial Numbers
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">Add More Quantity</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddSerialNumber}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add Serial #
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {newSerialNumbers.map((serial, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={serial}
                          onChange={(e) => handleSerialNumberChange(index, e.target.value)}
                          placeholder={`New SN-${index + 1}`}
                        />
                        {newSerialNumbers.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleRemoveSerialNumber(index)}
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddQuantity(false);
                        setNewSerialNumbers(['']);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAddMoreQuantity}>
                      Add {newSerialNumbers.filter(sn => sn.trim()).length || 1} Item{newSerialNumbers.filter(sn => sn.trim()).length > 1 ? 's' : ''}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
