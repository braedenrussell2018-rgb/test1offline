import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage } from "@/lib/inventory-storage";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddItemDialogProps {
  onItemAdded: () => void;
}

export const AddItemDialog = ({ onItemAdded }: AddItemDialogProps) => {
  const [open, setOpen] = useState(false);
  const [partNumber, setPartNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [description, setDescription] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [cost, setCost] = useState("");
  const [weight, setWeight] = useState("");
  const [volume, setVolume] = useState("");
  const [warranty, setWarranty] = useState("");
  const [minReorderLevel, setMinReorderLevel] = useState("");
  const [maxReorderLevel, setMaxReorderLevel] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!partNumber.trim() || !description.trim() || !salePrice || !cost) {
      toast({
        title: "Error",
        description: "Please fill in required fields (Part Number, Description, Sale Price, Cost)",
        variant: "destructive",
      });
      return;
    }

    const salePriceNum = parseFloat(salePrice);
    const costNum = parseFloat(cost);
    
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

    const weightNum = weight ? parseFloat(weight) : undefined;
    const volumeNum = volume ? parseFloat(volume) : undefined;
    const minNum = minReorderLevel ? parseInt(minReorderLevel) : undefined;
    const maxNum = maxReorderLevel ? parseInt(maxReorderLevel) : undefined;

    if (weight && (isNaN(weightNum!) || weightNum! < 0)) {
      toast({
        title: "Error",
        description: "Please enter a valid weight",
        variant: "destructive",
      });
      return;
    }

    if (volume && (isNaN(volumeNum!) || volumeNum! < 0)) {
      toast({
        title: "Error",
        description: "Please enter a valid volume",
        variant: "destructive",
      });
      return;
    }

    if (minReorderLevel && (isNaN(minNum!) || minNum! < 0)) {
      toast({
        title: "Error",
        description: "Please enter a valid min reorder level",
        variant: "destructive",
      });
      return;
    }

    if (maxReorderLevel && (isNaN(maxNum!) || maxNum! < 0)) {
      toast({
        title: "Error",
        description: "Please enter a valid max reorder level",
        variant: "destructive",
      });
      return;
    }

    inventoryStorage.addItem({
      partNumber: partNumber.trim(),
      serialNumber: serialNumber.trim() || undefined,
      description: description.trim(),
      salePrice: salePriceNum,
      cost: costNum,
      weight: weightNum,
      volume: volumeNum,
      warranty: warranty.trim() || undefined,
      minReorderLevel: minNum,
      maxReorderLevel: maxNum,
      status: 'available',
    });

    toast({
      title: "Success",
      description: "Item added to inventory",
    });

    setPartNumber("");
    setSerialNumber("");
    setDescription("");
    setSalePrice("");
    setCost("");
    setWeight("");
    setVolume("");
    setWarranty("");
    setMinReorderLevel("");
    setMaxReorderLevel("");
    setOpen(false);
    onItemAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partNumber">
                  Part Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="partNumber"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="PN-12345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="SN-12345 (Optional)"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Item description..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salePrice">
                  Sale Price ($) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="salePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">
                  Cost ($) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (lbs)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="volume">Volume (cu ft)</Label>
                <Input
                  id="volume"
                  type="number"
                  step="0.01"
                  min="0"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warranty">Warranty</Label>
              <Input
                id="warranty"
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                placeholder="e.g., 1 year, 90 days"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minReorderLevel">Min Reorder Level</Label>
                <Input
                  id="minReorderLevel"
                  type="number"
                  min="0"
                  value={minReorderLevel}
                  onChange={(e) => setMinReorderLevel(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxReorderLevel">Max Reorder Level</Label>
                <Input
                  id="maxReorderLevel"
                  type="number"
                  min="0"
                  value={maxReorderLevel}
                  onChange={(e) => setMaxReorderLevel(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Item</Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
