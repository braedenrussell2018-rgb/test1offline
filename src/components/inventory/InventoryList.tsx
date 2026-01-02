import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/LoadingState";
import { InventoryItem } from "@/lib/inventory-storage";

interface InventoryListProps {
  items: InventoryItem[];
  loading?: boolean;
  emptyMessage?: string;
  onItemClick: (item: InventoryItem) => void;
}

export function InventoryList({
  items,
  loading = false,
  emptyMessage = "No items found.",
  onItemClick,
}: InventoryListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <CardSkeleton count={5} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onItemClick(item)}
          className="flex items-start justify-between p-4 border rounded-lg bg-card hover:bg-accent/10 transition-colors cursor-pointer"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">{item.partNumber}</span>
              {item.serialNumber && (
                <span className="text-sm text-muted-foreground">SN: {item.serialNumber}</span>
              )}
              <Badge
                variant={item.status === 'available' ? 'default' : 'secondary'}
              >
                {item.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                Sale: <span className="font-medium text-foreground">${item.salePrice.toFixed(2)}</span>
              </span>
              <span className="text-muted-foreground">
                Cost: <span className="font-medium text-foreground">${item.cost.toFixed(2)}</span>
              </span>
              <span className="text-muted-foreground">
                Value: <span className="font-medium text-foreground">${item.cost.toFixed(2)}</span>
              </span>
              {item.weight && (
                <span className="text-muted-foreground">
                  Weight: <span className="font-medium text-foreground">{item.weight} lbs</span>
                </span>
              )}
              {item.volume && (
                <span className="text-muted-foreground">
                  Volume: <span className="font-medium text-foreground">{item.volume} cu yd</span>
                </span>
              )}
              {item.warranty && (
                <span className="text-muted-foreground">
                  Warranty: <span className="font-medium text-foreground">{item.warranty}</span>
                </span>
              )}
              {(item.minReorderLevel !== undefined || item.maxReorderLevel !== undefined) && (
                <span className="text-muted-foreground">
                  Reorder: <span className="font-medium text-foreground">
                    {item.minReorderLevel ?? '-'} - {item.maxReorderLevel ?? '-'}
                  </span>
                </span>
              )}
              {item.soldDate && (
                <span className="text-muted-foreground col-span-2">
                  Sold: {new Date(item.soldDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
