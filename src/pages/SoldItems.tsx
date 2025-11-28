import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";
import { inventoryStorage, InventoryItem } from "@/lib/inventory-storage";
import { format, parseISO, startOfMonth } from "date-fns";

interface MonthGroup {
  month: string;
  monthKey: string;
  items: InventoryItem[];
  totalValue: number;
}

function SoldItemsContent() {
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);

  useEffect(() => {
    const loadSoldItems = async () => {
      const items = await inventoryStorage.getItems();
      const soldItems = items.filter(item => item.status === 'sold' && item.soldDate);

      // Group by month
      const grouped = new Map<string, InventoryItem[]>();
      soldItems.forEach(item => {
        if (item.soldDate) {
          const monthKey = format(startOfMonth(parseISO(item.soldDate)), 'yyyy-MM');
          if (!grouped.has(monthKey)) {
            grouped.set(monthKey, []);
          }
          grouped.get(monthKey)!.push(item);
        }
      });

      // Convert to array and sort by month (newest first)
      const groups: MonthGroup[] = Array.from(grouped.entries())
        .map(([monthKey, items]) => ({
          month: format(parseISO(monthKey + '-01'), 'MMMM yyyy'),
          monthKey,
          items,
          totalValue: items.reduce((sum, item) => sum + item.salePrice, 0),
        }))
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

      setMonthGroups(groups);
    };

    loadSoldItems();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Sold Items by Month</h1>
              <p className="text-muted-foreground mt-1">View items sold in previous months</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {monthGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">
                No sold items found.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {monthGroups.map((group) => (
              <Card key={group.monthKey}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl">{group.month}</CardTitle>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-muted-foreground">
                        {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                      </div>
                      <div className="text-xl font-bold">
                        ${group.totalValue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-4 border rounded-lg bg-card hover:bg-accent/10 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{item.partNumber}</span>
                            {item.serialNumber && (
                              <span className="text-sm text-muted-foreground">SN: {item.serialNumber}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <span className="text-muted-foreground">
                              Sale Price: <span className="font-medium text-foreground">${item.salePrice.toFixed(2)}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Cost: <span className="font-medium text-foreground">${item.cost.toFixed(2)}</span>
                            </span>
                            {item.soldDate && (
                              <span className="text-muted-foreground col-span-2">
                                Sold: {format(parseISO(item.soldDate), 'MMM dd, yyyy')}
                              </span>
                            )}
                            {item.invoiceId && (
                              <span className="text-muted-foreground col-span-2">
                                Invoice: <span className="font-medium text-foreground">{item.invoiceId}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SoldItems() {
  return (
    <ProtectedRoute>
      <SoldItemsContent />
    </ProtectedRoute>
  );
}
