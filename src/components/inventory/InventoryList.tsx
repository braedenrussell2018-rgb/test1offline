import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/LoadingState";
import { InventoryItem } from "@/lib/inventory-storage";
import { Package } from "lucide-react";

interface GroupedItem {
  partNumber: string;
  description: string;
  salePrice: number;
  cost: number;
  weight?: number;
  volume?: number;
  warranty?: string;
  minReorderLevel?: number;
  maxReorderLevel?: number;
  shelfLocation?: string;
  quantity: number;
  availableCount: number;
  soldCount: number;
  totalValue: number;
  items: InventoryItem[];
}

interface InventoryListProps {
  items: InventoryItem[];
  loading?: boolean;
  emptyMessage?: string;
  onItemClick: (item: InventoryItem) => void;
  groupByPartNumber?: boolean;
}

export function InventoryList({
  items,
  loading = false,
  emptyMessage = "No items found.",
  onItemClick,
  groupByPartNumber = true,
}: InventoryListProps) {
  // Group items by part number
  const groupedItems = useMemo(() => {
    if (!groupByPartNumber) return null;

    const groups = items.reduce((acc, item) => {
      const key = item.partNumber;
      if (!acc[key]) {
        acc[key] = {
          partNumber: item.partNumber,
          description: item.description,
          salePrice: item.salePrice,
          cost: item.cost,
          weight: item.weight,
          volume: item.volume,
          warranty: item.warranty,
          minReorderLevel: item.minReorderLevel,
          maxReorderLevel: item.maxReorderLevel,
          shelfLocation: item.shelfLocation,
          quantity: 0,
          availableCount: 0,
          soldCount: 0,
          totalValue: 0,
          items: [],
        };
      }
      acc[key].quantity += 1;
      acc[key].totalValue += item.cost || 0;
      acc[key].items.push(item);
      if (item.status === 'available') {
        acc[key].availableCount += 1;
      } else {
        acc[key].soldCount += 1;
      }
      return acc;
    }, {} as Record<string, GroupedItem>);

    return Object.values(groups);
  }, [items, groupByPartNumber]);

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

  // Render grouped view
  if (groupByPartNumber && groupedItems) {
    return (
      <div className="space-y-3">
        {groupedItems.map((group) => (
          <div
            key={group.partNumber}
            onClick={() => onItemClick(group.items[0])}
            className="flex items-start justify-between p-4 border rounded-lg bg-card hover:bg-accent/10 transition-colors cursor-pointer"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{group.partNumber}</span>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 rounded-full">
                  <Package className="h-3 w-3 text-primary" />
                  <span className="text-sm font-medium text-primary">{group.quantity}</span>
                </div>
                {group.availableCount > 0 && (
                  <Badge variant="default" className="text-xs">
                    {group.availableCount} available
                  </Badge>
                )}
                {group.soldCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {group.soldCount} sold
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">{group.description}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                  Sale: <span className="font-medium text-foreground">${group.salePrice.toFixed(2)}</span>
                </span>
                <span className="text-muted-foreground">
                  Cost: <span className="font-medium text-foreground">${group.cost.toFixed(2)}</span>
                </span>
                <span className="text-muted-foreground">
                  Total Value: <span className="font-medium text-foreground">${group.totalValue.toFixed(2)}</span>
                </span>
                {group.weight && (
                  <span className="text-muted-foreground">
                    Weight: <span className="font-medium text-foreground">{group.weight} lbs</span>
                  </span>
                )}
                {group.volume && (
                  <span className="text-muted-foreground">
                    Volume: <span className="font-medium text-foreground">{group.volume} cu yd</span>
                  </span>
                )}
                {group.warranty && (
                  <span className="text-muted-foreground">
                    Warranty: <span className="font-medium text-foreground">{group.warranty}</span>
                  </span>
                )}
                {(group.minReorderLevel !== undefined || group.maxReorderLevel !== undefined) && (
                  <span className="text-muted-foreground">
                    Reorder: <span className="font-medium text-foreground">
                      {group.minReorderLevel ?? '-'} - {group.maxReorderLevel ?? '-'}
                    </span>
                  </span>
                )}
                {group.shelfLocation && (
                  <span className="text-muted-foreground">
                    Location: <span className="font-medium text-foreground">{group.shelfLocation}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Render individual items (ungrouped)
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
