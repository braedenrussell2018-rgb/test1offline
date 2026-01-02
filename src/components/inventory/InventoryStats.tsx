import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FileText, DollarSign, TrendingUp } from "lucide-react";
import { StatsCardSkeleton } from "@/components/LoadingState";

interface InventoryStatsProps {
  totalItems: number;
  availableCount: number;
  soldCount: number;
  totalInventoryValue: number;
  totalRevenue: number;
  invoiceCount: number;
  loading?: boolean;
  onItemsClick: () => void;
  onAvailableClick: () => void;
  onSoldClick: () => void;
  onInvoicesClick: () => void;
}

export function InventoryStats({
  totalItems,
  availableCount,
  soldCount,
  totalInventoryValue,
  totalRevenue,
  invoiceCount,
  loading = false,
  onItemsClick,
  onAvailableClick,
  onSoldClick,
  onInvoicesClick,
}: InventoryStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StatsCardSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={onItemsClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalItems}</div>
          <p className="text-xs text-muted-foreground">
            {availableCount} available, {soldCount} sold
          </p>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={onAvailableClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalInventoryValue.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Available items cost</p>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={onSoldClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">From {invoiceCount} invoices</p>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={onInvoicesClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Invoices</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{invoiceCount}</div>
          <p className="text-xs text-muted-foreground">Total sales</p>
        </CardContent>
      </Card>
    </div>
  );
}
