import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { InventoryItem } from "@/lib/inventory-storage";

interface ItemDetailDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ItemDetailDialog = ({ item, open, onOpenChange }: ItemDetailDialogProps) => {
  if (!item) return null;

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
        </div>
      </DialogContent>
    </Dialog>
  );
};
