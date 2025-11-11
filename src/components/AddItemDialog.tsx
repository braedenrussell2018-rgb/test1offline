import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage } from "@/lib/inventory-storage";

interface AddItemDialogProps {
  onItemAdded: () => void;
}

export const AddItemDialog = ({ onItemAdded }: AddItemDialogProps) => {
  const [open, setOpen] = useState(false);
  const [serialNumber, setSerialNumber] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serialNumber.trim() || !description.trim() || !cost) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const costNum = parseFloat(cost);
    if (isNaN(costNum) || costNum < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid cost",
        variant: "destructive",
      });
      return;
    }

    inventoryStorage.addItem({
      serialNumber: serialNumber.trim(),
      description: description.trim(),
      cost: costNum,
      status: 'available',
    });

    toast({
      title: "Success",
      description: "Item added to inventory",
    });

    setSerialNumber("");
    setDescription("");
    setCost("");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serialNumber">Serial Number</Label>
            <Input
              id="serialNumber"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="SN-12345"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Item description..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost">Cost ($)</Label>
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Item</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
