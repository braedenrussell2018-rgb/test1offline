import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Search } from "lucide-react";
import { InventoryItem } from "@/lib/inventory-storage";

interface AddItemPickerProps {
  availableItems: InventoryItem[];
  onAdd: (item: InventoryItem) => void;
  excludedIds?: string[];
}

export const AddItemPicker = ({ availableItems, onAdd, excludedIds = [] }: AddItemPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const excluded = new Set(excludedIds);
    const q = search.toLowerCase().trim();
    return availableItems
      .filter((i) => !excluded.has(i.id))
      .filter(
        (i) =>
          !q ||
          i.partNumber.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.serialNumber || "").toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [availableItems, excludedIds, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-0" align="end">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search part #, description, serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No items found</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onAdd(item);
                  setOpen(false);
                  setSearch("");
                }}
                className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.partNumber}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    {item.serialNumber && (
                      <p className="text-xs text-muted-foreground">SN: {item.serialNumber}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    ${item.salePrice.toFixed(2)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
