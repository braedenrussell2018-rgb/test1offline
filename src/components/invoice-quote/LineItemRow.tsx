import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { DocLineItem } from "@/lib/inventory-storage-adapter";

interface LineItemRowProps {
  item: DocLineItem;
  index: number;
  onUpdate: (index: number, field: keyof DocLineItem, value: string | number) => void;
  onRemove: (index: number) => void;
}

export const LineItemRow = ({ item, index, onUpdate, onRemove }: LineItemRowProps) => {
  const qty = item.quantity || 1;
  const lineTotal = qty * (item.price || 0);

  return (
    <div className="grid grid-cols-12 gap-2 items-start py-2 border-b border-dashed">
      <div className="col-span-2">
        <Input
          value={item.partNumber}
          onChange={(e) => onUpdate(index, "partNumber", e.target.value)}
          className="text-sm font-medium"
          placeholder="Part #"
        />
      </div>
      <div className="col-span-3">
        <Textarea
          value={item.description}
          onChange={(e) => onUpdate(index, "description", e.target.value)}
          className="min-h-[60px] text-sm resize-none"
          placeholder="Description..."
        />
      </div>
      <div className="col-span-2">
        <Input
          value={item.serialNumber || ""}
          onChange={(e) => onUpdate(index, "serialNumber", e.target.value)}
          className="text-sm"
          placeholder="Serial #"
        />
      </div>
      <div className="col-span-1">
        <Input
          type="number"
          min="1"
          step="1"
          value={qty}
          onChange={(e) => onUpdate(index, "quantity", parseInt(e.target.value) || 1)}
          className="text-right"
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
            onChange={(e) => onUpdate(index, "price", parseFloat(e.target.value) || 0)}
            className="pl-6 text-right"
          />
        </div>
      </div>
      <div className="col-span-1 text-right text-sm font-medium pt-2">
        ${lineTotal.toFixed(2)}
      </div>
      <div className="col-span-1 flex justify-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
