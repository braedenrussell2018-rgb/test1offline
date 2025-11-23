import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Package, FileText, Calculator } from "lucide-react";
import { inventoryStorage, InventoryItem, Invoice, Estimate } from "@/lib/inventory-storage";

const Accounting = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);

  useEffect(() => {
    setItems(inventoryStorage.getItems());
    setInvoices(inventoryStorage.getInvoices());
    setEstimates(inventoryStorage.getEstimates());
  }, []);

  const soldItems = items.filter(item => item.status === 'sold');
  const availableItems = items.filter(item => item.status === 'available');
  
  // COGS - Cost of Goods Sold (total cost of sold items)
  const totalCOGS = soldItems.reduce((sum, item) => sum + item.cost, 0);
  
  // Revenue (from invoices)
  const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  
  // Gross Profit = Revenue - COGS
  const grossProfit = totalRevenue - totalCOGS;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  
  // Current Inventory Value
  const inventoryValue = availableItems.reduce((sum, item) => sum + item.cost, 0);
  
  // Total discount given
  const totalDiscounts = invoices.reduce((sum, invoice) => sum + invoice.discount, 0);
  
  // Total shipping collected
  const totalShipping = invoices.reduce((sum, invoice) => sum + invoice.shippingCost, 0);
  
  // Estimates
  const pendingEstimates = estimates.filter(e => e.status === 'pending');
  const approvedEstimates = estimates.filter(e => e.status === 'approved');
  const pendingEstimatesValue = pendingEstimates.reduce((sum, est) => sum + est.total, 0);
  const approvedEstimatesValue = approvedEstimates.reduce((sum, est) => sum + est.total, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground mt-1">Financial overview and cost analysis</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">From {invoices.length} invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">COGS</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">${totalCOGS.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Cost of {soldItems.length} sold items</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${grossProfit.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Margin: {grossProfitMargin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${inventoryValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{availableItems.length} items</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Discounts Given</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalDiscounts.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Total discounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Shipping Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalShipping.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Shipping collected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Estimates</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${pendingEstimatesValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{pendingEstimates.length} estimates</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Breakdown</CardTitle>
              <CardDescription>Revenue analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Gross Revenue</span>
                  <span className="font-semibold">${totalRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Less: COGS</span>
                  <span className="font-semibold text-red-600">-${totalCOGS.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Discounts Given</span>
                  <span className="font-semibold text-red-600">-${totalDiscounts.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Shipping Revenue</span>
                  <span className="font-semibold text-green-600">+${totalShipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-semibold">Net Profit</span>
                  <span className="text-xl font-bold">${(grossProfit + totalShipping).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estimates Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Estimates Overview</CardTitle>
              <CardDescription>Quote status and value</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Pending Estimates</span>
                    <Badge variant="outline">{pendingEstimates.length}</Badge>
                  </div>
                  <div className="text-2xl font-bold">${pendingEstimatesValue.toFixed(2)}</div>
                </div>
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Approved Estimates</span>
                    <Badge variant="default">{approvedEstimates.length}</Badge>
                  </div>
                  <div className="text-2xl font-bold">${approvedEstimatesValue.toFixed(2)}</div>
                </div>
                <div className="p-4 border rounded-lg bg-primary/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Total Estimates Value</span>
                    <Badge>{estimates.length}</Badge>
                  </div>
                  <div className="text-2xl font-bold">
                    ${(pendingEstimatesValue + approvedEstimatesValue).toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Details */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory Analysis</CardTitle>
              <CardDescription>Current stock metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Available Units</span>
                  <span className="font-semibold">{availableItems.length}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Available Value</span>
                  <span className="font-semibold">${inventoryValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Sold Units</span>
                  <span className="font-semibold">{soldItems.length}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Avg Cost per Item</span>
                  <span className="font-semibold">
                    ${availableItems.length > 0 ? (inventoryValue / availableItems.length).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-semibold">Turnover Rate</span>
                  <span className="font-bold">
                    {items.length > 0 ? ((soldItems.length / items.length) * 100).toFixed(1) : '0'}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
              <CardDescription>Latest 5 invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No invoices yet</p>
              ) : (
                <div className="space-y-3">
                  {invoices.slice(-5).reverse().map((invoice) => (
                    <div key={invoice.id} className="flex justify-between items-center p-3 border rounded-lg bg-muted/20">
                      <div>
                        <div className="font-medium">{invoice.invoiceNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(invoice.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${invoice.total.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.items.length} items
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Accounting;
