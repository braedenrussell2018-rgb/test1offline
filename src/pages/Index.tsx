import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, FileText, DollarSign, TrendingUp, FileEdit, Eye } from "lucide-react";
import { AddItemDialog } from "@/components/AddItemDialog";
import { CreateInvoiceDialog } from "@/components/CreateInvoiceDialog";
import { BulkUploadDialog } from "@/components/BulkUploadDialog";
import { IssuePODialog } from "@/components/IssuePODialog";
import { ItemDetailDialog } from "@/components/ItemDetailDialog";
import { InvoicePDFPreview } from "@/components/InvoicePDFPreview";
import { inventoryStorage, InventoryItem, Invoice } from "@/lib/inventory-storage";

function IndexContent() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("inventory");
  const [itemFilter, setItemFilter] = useState<'all' | 'available' | 'sold'>('all');
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const [itemsData, invoicesData] = await Promise.all([
        inventoryStorage.getItems(),
        inventoryStorage.getInvoices()
      ]);
      setItems(itemsData);
      setInvoices(invoicesData);
    };
    loadData();
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleItemClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setDetailDialogOpen(true);
  };

  const availableItems = items.filter(item => item.status === 'available');
  const soldItems = items.filter(item => item.status === 'sold');
  const totalInventoryValue = availableItems.reduce((sum, item) => sum + item.cost, 0);
  const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.total, 0);

  const filteredItems = items.filter(item => {
    if (itemFilter === 'all') return true;
    return item.status === itemFilter;
  });

  const handleInvoicePreview = (invoice: Invoice) => {
    setPreviewInvoice(invoice);
    setInvoicePreviewOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Track and manage your inventory items and sales</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => {
              setActiveTab("inventory");
              setItemFilter('all');
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{items.length}</div>
              <p className="text-xs text-muted-foreground">
                {availableItems.length} available, {soldItems.length} sold
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => {
              setActiveTab("inventory");
              setItemFilter('available');
            }}
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
            onClick={() => {
              setActiveTab("inventory");
              setItemFilter('sold');
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">From {invoices.length} invoices</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setActiveTab("invoices")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{invoices.length}</div>
              <p className="text-xs text-muted-foreground">Total sales</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <AddItemDialog onItemAdded={handleRefresh} />
          <BulkUploadDialog onItemsAdded={handleRefresh} />
          <IssuePODialog onPOCreated={handleRefresh} />
          <CreateInvoiceDialog onInvoiceCreated={handleRefresh} />
          <Link to="/quotes">
            <Button variant="outline">
              <FileEdit className="mr-2 h-4 w-4" />
              View Quotes
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>
                      {itemFilter === 'all' ? 'All Items' : 
                       itemFilter === 'available' ? 'Available Items' : 
                       'Sold Items'}
                    </CardTitle>
                    <CardDescription>View and manage your inventory items</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant={itemFilter === 'all' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setItemFilter('all')}
                    >
                      All ({items.length})
                    </Button>
                    <Button 
                      variant={itemFilter === 'available' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setItemFilter('available')}
                    >
                      Available ({availableItems.length})
                    </Button>
                    <Button 
                      variant={itemFilter === 'sold' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setItemFilter('sold')}
                    >
                      Sold ({soldItems.length})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {itemFilter === 'all' 
                      ? 'No items in inventory. Add your first item to get started.'
                      : `No ${itemFilter} items found.`}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
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
                                Volume: <span className="font-medium text-foreground">{item.volume} cu ft</span>
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Sales Invoices</CardTitle>
                <CardDescription>View all generated invoices</CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No invoices yet. Create your first invoice to track sales.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-lg">{invoice.invoiceNumber}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(invoice.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">${invoice.total.toFixed(2)}</div>
                            <div className="text-sm text-muted-foreground">
                              {invoice.items.length} {invoice.items.length === 1 ? 'item' : 'items'}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 border-t pt-3">
                          {invoice.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <div>
                                <span className="font-medium">{item.partNumber}</span>
                                {item.serialNumber && (
                                  <span className="text-xs text-muted-foreground ml-1">({item.serialNumber})</span>
                                )}
                                <span className="text-muted-foreground ml-2">{item.description}</span>
                              </div>
                              <span className="font-medium">${item.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t pt-3 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInvoicePreview(invoice)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Preview PDF
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ItemDetailDialog 
          item={selectedItem}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          onItemAdded={handleRefresh}
        />

        <InvoicePDFPreview
          invoice={previewInvoice}
          open={invoicePreviewOpen}
          onOpenChange={setInvoicePreviewOpen}
        />
      </div>
    </div>
  );
};

export default function Index() {
  return (
    <ProtectedRoute>
      <IndexContent />
    </ProtectedRoute>
  );
}
