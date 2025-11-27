import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage } from "@/lib/inventory-storage";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddItemDialogProps {
  onItemAdded: () => void;
}

const WARRANTY_OPTIONS = [
  { value: "12", label: "1 Year" },
  { value: "6", label: "6 Months" },
  { value: "0", label: "No Warranty" },
];

export const AddItemDialog = ({ onItemAdded }: AddItemDialogProps) => {
  const [open, setOpen] = useState(false);
  const [partNumber, setPartNumber] = useState("");
  const [serialNumbers, setSerialNumbers] = useState<string[]>(['']);
  const [description, setDescription] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [cost, setCost] = useState("");
  const [weight, setWeight] = useState("");
  const [volume, setVolume] = useState("");
  const [warranty, setWarranty] = useState("");
  const [minReorderLevel, setMinReorderLevel] = useState("");
  const [maxReorderLevel, setMaxReorderLevel] = useState("");
  const [shelfLocation, setShelfLocation] = useState("");
  const [shelfLocations, setShelfLocations] = useState<string[]>([]);
  const [showShelfSuggestions, setShowShelfSuggestions] = useState(false);
  const shelfInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadShelfLocations();
    }
  }, [open]);

  const loadShelfLocations = async () => {
    try {
      const locations = await inventoryStorage.getUniqueShelfLocations();
      setShelfLocations(locations);
    } catch (error) {
      console.error("Error loading shelf locations:", error);
    }
  };

  const handleAddSerialNumber = () => {
    setSerialNumbers([...serialNumbers, '']);
  };

  const handleRemoveSerialNumber = (index: number) => {
    if (serialNumbers.length > 1) {
      setSerialNumbers(serialNumbers.filter((_, i) => i !== index));
    }
  };

  const handleSerialNumberChange = (index: number, value: string) => {
    const updated = [...serialNumbers];
    updated[index] = value;
    setSerialNumbers(updated);
  };

  const handleShelfKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" && shelfLocations.length > 0) {
      e.preventDefault();
      setShowShelfSuggestions(true);
    }
  };

  const handleShelfSuggestionClick = (location: string) => {
    setShelfLocation(location);
    setShowShelfSuggestions(false);
  };

  const filteredShelfLocations = shelfLocations.filter(loc =>
    loc.toLowerCase().includes(shelfLocation.toLowerCase())
  );

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

    // Check for duplicate serial numbers
    const nonEmptySerials = serialNumbers.filter(sn => sn.trim());
    const uniqueSerials = new Set(nonEmptySerials);
    if (nonEmptySerials.length !== uniqueSerials.size) {
      toast({
        title: "Error",
        description: "Duplicate serial numbers detected",
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

    // Add an item for each serial number (or one item if no serial numbers)
    const serialsToAdd = nonEmptySerials.length > 0 ? nonEmptySerials : [''];
    let addedCount = 0;

    const warrantyValue = warranty && warranty !== "0" ? `${warranty} months` : undefined;

    serialsToAdd.forEach((serial) => {
      inventoryStorage.addItem({
        partNumber: partNumber.trim(),
        serialNumber: serial || undefined,
        description: description.trim(),
        salePrice: salePriceNum,
        cost: costNum,
        weight: weightNum,
        volume: volumeNum,
        warranty: warrantyValue,
        minReorderLevel: minNum,
        maxReorderLevel: maxNum,
        status: 'available',
        shelfLocation: shelfLocation.trim() || undefined,
      });
      addedCount++;
    });

    toast({
      title: "Success",
      description: `${addedCount} item${addedCount > 1 ? 's' : ''} added to inventory`,
    });

    setPartNumber("");
    setSerialNumbers(['']);
    setDescription("");
    setSalePrice("");
    setCost("");
    setWeight("");
    setVolume("");
    setWarranty("");
    setMinReorderLevel("");
    setMaxReorderLevel("");
    setShelfLocation("");
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
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Serial Numbers (Optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSerialNumber}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add additional item
                </Button>
              </div>
              <div className="space-y-2">
                {serialNumbers.map((serial, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={serial}
                      onChange={(e) => handleSerialNumberChange(index, e.target.value)}
                      placeholder={`SN-${index + 1}`}
                    />
                    {serialNumbers.length > 1 && (
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
                <Label htmlFor="volume">Volume (cu yd)</Label>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warranty">Warranty</Label>
                <Select value={warranty} onValueChange={setWarranty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select warranty" />
                  </SelectTrigger>
                  <SelectContent>
                    {WARRANTY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 relative">
                <Label htmlFor="shelfLocation">Shelf Location</Label>
                <Input
                  ref={shelfInputRef}
                  id="shelfLocation"
                  value={shelfLocation}
                  onChange={(e) => {
                    setShelfLocation(e.target.value);
                    setShowShelfSuggestions(true);
                  }}
                  onKeyDown={handleShelfKeyDown}
                  onFocus={() => setShowShelfSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowShelfSuggestions(false), 200)}
                  placeholder="e.g., A1-01"
                />
                {showShelfSuggestions && filteredShelfLocations.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filteredShelfLocations.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={() => handleShelfSuggestionClick(loc)}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
