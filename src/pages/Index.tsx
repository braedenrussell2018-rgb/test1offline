import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, RefreshCw, AlertCircle } from "lucide-react";
import { ItemDetailDialog } from "@/components/ItemDetailDialog";
import { InvoicePDFPreview } from "@/components/InvoicePDFPreview";
import { inventoryStorage, InventoryItem, Invoice } from "@/lib/inventory-storage";
import { useUserRole } from "@/hooks/useUserRole";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useDebouncedSearch } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingSpinner, CardSkeleton } from "@/components/LoadingState";
import { InventoryStats } from "@/components/inventory/InventoryStats";
import { InventoryActions } from "@/components/inventory/InventoryActions";
import { InventoryFilters } from "@/components/inventory/InventoryFilters";
import { InventoryList } from "@/components/inventory/InventoryList";
import { PaginationControls } from "@/components/inventory/PaginationControls";
import { toast } from "sonner";

function IndexContent() {
  const navigate = useNavigate();
  const { isSalesman, loading: roleLoading } = useUserRole();
  
  // Dialog states
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  
  // Tab and filter states
  const [activeTab, setActiveTab] = useState("inventory");
  const [itemFilter, setItemFilter] = useState<'all' | 'available' | 'sold'>('all');
  
  // Debounced search
  const { searchQuery, debouncedQuery, setSearchQuery, isSearching } = useDebouncedSearch("", 300);

  // Data fetching with async hook
  const {
    data: items = [],
    loading: itemsLoading,
    error: itemsError,
    refresh: refreshItems,
  } = useAsyncData(
    () => inventoryStorage.getItems(),
    {
      cacheKey: "inventory-items",
      errorMessage: "Failed to load inventory items. Please try again.",
    }
  );

  const {
    data: invoices = [],
    loading: invoicesLoading,
    error: invoicesError,
    refresh: refreshInvoices,
  } = useAsyncData(
    () => inventoryStorage.getInvoices(),
    {
      cacheKey: "invoices",
      errorMessage: "Failed to load invoices. Please try again.",
    }
  );

  // Redirect salesmen to spiff program
  useEffect(() => {
    if (!roleLoading && isSalesman()) {
      navigate("/spiff-program");
    }
  }, [roleLoading, isSalesman, navigate]);

  // Memoized calculations
  const availableItems = useMemo(
    () => items.filter(item => item.status === 'available'),
    [items]
  );

  const soldItems = useMemo(
    () => items.filter(item => item.status === 'sold'),
    [items]
  );

  const totalInventoryValue = useMemo(
    () => availableItems.reduce((sum, item) => sum + (item.cost || 0), 0),
    [availableItems]
  );

  const totalRevenue = useMemo(
    () => invoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0),
    [invoices]
  );

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let filtered = items.filter(item => {
      if (itemFilter === 'all') return true;
      return item.status === itemFilter;
    });

    // Apply search filter using debounced query
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.partNumber.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(query)) ||
        (item.shelfLocation && item.shelfLocation.toLowerCase().includes(query))
      );
    }

    // Sort: available first, then sold
    return filtered.sort((a, b) => {
      if (a.status === 'available' && b.status === 'sold') return -1;
      if (a.status === 'sold' && b.status === 'available') return 1;
      return 0;
    });
  }, [items, itemFilter, debouncedQuery]);

  // Pagination
  const pagination = usePagination(filteredItems, {
    initialPageSize: 50,
    pageSizeOptions: [25, 50, 100],
  });

  // Handlers
  const handleRefresh = useCallback(async () => {
    try {
      await Promise.all([refreshItems(), refreshInvoices()]);
      toast.success("Data refreshed successfully");
    } catch {
      toast.error("Failed to refresh data");
    }
  }, [refreshItems, refreshInvoices]);

  const handleItemClick = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
    setDetailDialogOpen(true);
  }, []);

  const handleInvoicePreview = useCallback((invoice: Invoice) => {
    setPreviewInvoice(invoice);
    setInvoicePreviewOpen(true);
  }, []);

  const handleStatsItemsClick = useCallback(() => {
    setActiveTab("inventory");
    setItemFilter('all');
  }, []);

  const handleStatsAvailableClick = useCallback(() => {
    setActiveTab("inventory");
    setItemFilter('available');
  }, []);

  const handleStatsSoldClick = useCallback(() => {
    setActiveTab("inventory");
    setItemFilter('sold');
  }, []);

  const handleStatsInvoicesClick = useCallback(() => {
    setActiveTab("invoices");
  }, []);

  const isLoading = itemsLoading || invoicesLoading;
  const hasError = itemsError || invoicesError;

  // Get empty message based on filter
  const emptyMessage = useMemo(() => {
    if (debouncedQuery.trim()) {
      return `No items found matching "${debouncedQuery}"`;
    }
    if (itemFilter === 'all') {
      return 'No items in inventory. Add your first item to get started.';
    }
    return `No ${itemFilter} items found.`;
  }, [itemFilter, debouncedQuery]);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
              <p className="text-muted-foreground mt-1">Track and manage your inventory items and sales</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Error State */}
        {hasError && (
          <div className="mb-6 p-4 border border-destructive/50 rounded-lg bg-destructive/10 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Failed to load some data. Please try refreshing.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        )}

        {/* Stats Cards */}
        <InventoryStats
          totalItems={items.length}
          availableCount={availableItems.length}
          soldCount={soldItems.length}
          totalInventoryValue={totalInventoryValue}
          totalRevenue={totalRevenue}
          invoiceCount={invoices.length}
          loading={isLoading}
          onItemsClick={handleStatsItemsClick}
          onAvailableClick={handleStatsAvailableClick}
          onSoldClick={handleStatsSoldClick}
          onInvoicesClick={handleStatsInvoicesClick}
        />

        {/* Actions */}
        <InventoryActions onRefresh={handleRefresh} disabled={isLoading} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="mt-6">
            <Card>
              <CardHeader>
                <InventoryFilters
                  itemFilter={itemFilter}
                  onFilterChange={setItemFilter}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  totalCount={items.length}
                  availableCount={availableItems.length}
                  soldCount={soldItems.length}
                  isSearching={isSearching}
                />
              </CardHeader>
              <CardContent>
                <InventoryList
                  items={pagination.paginatedData}
                  loading={itemsLoading}
                  emptyMessage={emptyMessage}
                  onItemClick={handleItemClick}
                />
                <PaginationControls
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  pageSize={pagination.pageSize}
                  totalItems={pagination.totalItems}
                  startIndex={pagination.startIndex}
                  endIndex={pagination.endIndex}
                  hasNextPage={pagination.hasNextPage}
                  hasPreviousPage={pagination.hasPreviousPage}
                  pageSizeOptions={pagination.pageSizeOptions}
                  onPageChange={pagination.goToPage}
                  onNextPage={pagination.nextPage}
                  onPreviousPage={pagination.previousPage}
                  onPageSizeChange={pagination.setPageSize}
                />
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
                {invoicesLoading ? (
                  <div className="space-y-4">
                    <CardSkeleton count={3} />
                  </div>
                ) : invoices.length === 0 ? (
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
}

export default function Index() {
  return (
    <ProtectedRoute>
      <ErrorBoundary>
        <IndexContent />
      </ErrorBoundary>
    </ProtectedRoute>
  );
}
