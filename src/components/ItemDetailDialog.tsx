import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, PackagePlus, Pencil, X, Save } from "lucide-react";
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
  const [isEditing, setIsEditing] = useState(false);
  
  // Editable fields
  const [editPartNumber, setEditPartNumber] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editVolume, setEditVolume] = useState("");
  const [editWarranty, setEditWarranty] = useState("");
  const [editMinReorderLevel, setEditMinReorderLevel] = useState("");
  const [editMaxReorderLevel, setEditMaxReorderLevel] = useState("");
  
  const { toast } = useToast();

  // Initialize edit fields when item changes or edit mode is toggled
  useEffect(() => {
    if (item && isEditing) {
      setEditPartNumber(item.partNumber);
      setEditSerialNumber(item.serialNumber || "");
      setEditDescription(item.description);
      setEditSalePrice(item.salePrice.toString());
      setEditCost(item.cost.toString());
      setEditWeight(item.weight?.toString() || "");
      setEditVolume(item.volume?.toString() || "");
      setEditWarranty(item.warranty || "");
      setEditMinReorderLevel(item.minReorderLevel?.toString() || "");
      setEditMaxReorderLevel(item.maxReorderLevel?.toString() || "");
    }
  }, [item, isEditing]);

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

  const handleAddMoreQuantity = async () => {
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
    const existingItems = await inventoryStorage.getItems();
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

  const handleSaveEdit = async () => {
    if (!editPartNumber.trim() || !editDescription.trim() || !editSalePrice || !editCost) {
      toast({
        title: "Error",
        description: "Part Number, Description, Sale Price, and Cost are required",
        variant: "destructive",
      });
      return;
    }

    const salePriceNum = parseFloat(editSalePrice);
    const costNum = parseFloat(editCost);
    
    if (isNaN(salePriceNum) || salePriceNum < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid sale price",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(costNum) || costNum < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid cost",
        variant: "destructive",
      });
      return;
    }

    const weightNum = editWeight ? parseFloat(editWeight) : undefined;
    const volumeNum = editVolume ? parseFloat(editVolume) : undefined;
    const minNum = editMinReorderLevel ? parseInt(editMinReorderLevel) : undefined;
    const maxNum = editMaxReorderLevel ? parseInt(editMaxReorderLevel) : undefined;

    if (editWeight && (isNaN(weightNum!) || weightNum! < 0)) {
      toast({
        title: "Error",
        description: "Please enter a valid weight",
        variant: "destructive",
      });
      return;
    }

    if (editVolume && (isNaN(volumeNum!) || volumeNum! < 0)) {
      toast({
        title: "Error",
        description: "Please enter a valid volume",
        variant: "destructive",
      });
      return;
    }

    await inventoryStorage.updateItem(item.id, {
      partNumber: editPartNumber.trim(),
      serialNumber: editSerialNumber.trim() || undefined,
      description: editDescription.trim(),
      salePrice: salePriceNum,
      cost: costNum,
      weight: weightNum,
      volume: volumeNum,
      warranty: editWarranty.trim() || undefined,
      minReorderLevel: minNum,
      maxReorderLevel: maxNum,
    });

    toast({
      title: "Success",
      description: "Item updated successfully",
    });

    setIsEditing(false);
    onItemAdded?.();
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">
              {isEditing ? "Edit Item" : item.partNumber}
            </DialogTitle>
            {!isEditing && item.status === 'available' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          {!isEditing ? (
            <>
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
            </>
          ) : (
            /* Edit Mode */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-partNumber">
                    Part Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-partNumber"
                    value={editPartNumber}
                    onChange={(e) => setEditPartNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-serialNumber">Serial Number</Label>
                  <Input
                    id="edit-serialNumber"
                    value={editSerialNumber}
                    onChange={(e) => setEditSerialNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-salePrice">
                    Sale Price ($) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-salePrice"
                    type="number"
                    step="0.01"
                    value={editSalePrice}
                    onChange={(e) => setEditSalePrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cost">
                    Cost ($) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-cost"
                    type="number"
                    step="0.01"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-weight">Weight (lbs)</Label>
                  <Input
                    id="edit-weight"
                    type="number"
                    step="0.01"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-volume">Volume (cu ft)</Label>
                  <Input
                    id="edit-volume"
                    type="number"
                    step="0.01"
                    value={editVolume}
                    onChange={(e) => setEditVolume(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-warranty">Warranty</Label>
                <Input
                  id="edit-warranty"
                  value={editWarranty}
                  onChange={(e) => setEditWarranty(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-minReorderLevel">Min Reorder Level</Label>
                  <Input
                    id="edit-minReorderLevel"
                    type="number"
                    value={editMinReorderLevel}
                    onChange={(e) => setEditMinReorderLevel(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-maxReorderLevel">Max Reorder Level</Label>
                  <Input
                    id="edit-maxReorderLevel"
                    type="number"
                    value={editMaxReorderLevel}
                    onChange={(e) => setEditMaxReorderLevel(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          )}

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
