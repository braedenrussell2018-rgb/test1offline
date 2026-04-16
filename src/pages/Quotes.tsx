import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateQuoteDialog } from "@/components/CreateQuoteDialog";
import { QuotePDFPreview } from "@/components/QuotePDFPreview";
import { inventoryStorage, Quote } from "@/lib/inventory-storage";
import { Home, FileText, Calendar, DollarSign, Eye, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useDebouncedSearch } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/inventory/PaginationControls";
import { EmptyState } from "@/components/EmptyState";

function QuotesSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div><Skeleton className="h-10 w-32" /><Skeleton className="h-4 w-48 mt-2" /></div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>)}
        </div>
      </div>
    </div>
  );
}

function QuotesContent() {
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { searchQuery, debouncedQuery, setSearchQuery } = useDebouncedSearch("", 300);

  const fetchQuotes = useCallback(async () => {
    const allQuotes = await inventoryStorage.getQuotes();
    return allQuotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, []);

  const { data: quotes, loading, refresh } = useAsyncData(fetchQuotes, {
    loadOnMount: true,
    errorMessage: "Failed to load quotes",
    cacheKey: "quotes-data",
    cacheDuration: 2 * 60 * 1000,
  });

  const allQuotes = quotes || [];
  const q = debouncedQuery.toLowerCase();
  const filteredQuotes = q ? allQuotes.filter(quote =>
    quote.quoteNumber.toLowerCase().includes(q) ||
    quote.customerName.toLowerCase().includes(q) ||
    quote.status.toLowerCase().includes(q)
  ) : allQuotes;

  const pagination = usePagination(filteredQuotes, { initialPageSize: 25 });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleStatusChange = async (quoteId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    const quote = allQuotes.find(e => e.id === quoteId);
    if (newStatus === 'approved' && quote) {
      const invoiceNumber = `INV-${Date.now()}`;
      const invoice = await inventoryStorage.createInvoice({
        invoiceNumber, items: quote.items, customerName: quote.customerName,
        customerEmail: quote.customerEmail, customerPhone: quote.customerPhone,
        customerAddress: quote.customerAddress, shipToName: quote.shipToName,
        shipToAddress: quote.shipToAddress, discount: quote.discount,
        shippingCost: quote.shippingCost, subtotal: quote.subtotal, total: quote.total,
      });
      for (const item of quote.items) {
        await inventoryStorage.updateItem(item.itemId, { status: 'sold', soldDate: new Date().toISOString(), invoiceId: invoice.id });
      }
      toast({ title: "Invoice created", description: `Invoice ${invoice.invoiceNumber} has been created` });
      navigate('/');
    }
    const updatedQuote = { ...quote!, status: newStatus };
    await inventoryStorage.updateQuote(updatedQuote);
    refresh();
    toast({ title: "Status updated", description: `Quote status changed to ${newStatus}` });
  };

  if (loading) return <QuotesSkeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Quotes</h1>
            <p className="text-muted-foreground mt-2">Create and manage customer quotes</p>
          </div>
          <div className="flex gap-2">
            <Link to="/"><Button variant="outline"><Home className="mr-2 h-4 w-4" />Home</Button></Link>
            <CreateQuoteDialog onQuoteCreated={refresh} />
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by quote number, customer, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid gap-4">
          {pagination.paginatedData.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={FileText}
                  title={debouncedQuery ? "No quotes match your search" : "No quotes created yet"}
                  description={debouncedQuery ? "Try a different search term" : "Create your first quote to get started"}
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {pagination.paginatedData.map((quote) => (
                <Card key={quote.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />{quote.quoteNumber}
                        </CardTitle>
                        {quote.customerName && <p className="text-sm text-muted-foreground mt-1">{quote.customerName}</p>}
                      </div>
                      <Badge className={getStatusColor(quote.status)}>{quote.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />{new Date(quote.createdAt).toLocaleDateString()}
                        </div>
                        {quote.customerEmail && <div className="text-sm text-muted-foreground">{quote.customerEmail}</div>}
                        {quote.customerPhone && <div className="text-sm text-muted-foreground">{quote.customerPhone}</div>}
                      </div>
                      <div className="space-y-2">
                        {quote.shipToAddress && (
                          <div className="text-sm text-muted-foreground">
                            <div className="font-medium">Ship To:</div><div>{quote.shipToAddress}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Items:</span><span>{quote.items.length}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal:</span><span>${quote.subtotal.toFixed(2)}</span></div>
                        {quote.discount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount:</span><span>-${quote.discount.toFixed(2)}</span></div>}
                        {quote.shippingCost > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Shipping:</span><span>${quote.shippingCost.toFixed(2)}</span></div>}
                        <div className="flex justify-between items-center border-t pt-2">
                          <span className="font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" />Total:</span>
                          <span className="text-xl font-bold text-primary">${quote.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => { setPreviewQuote(quote); setPreviewOpen(true); }}>
                        <Eye className="mr-2 h-4 w-4" />Preview PDF
                      </Button>
                      {quote.status === 'pending' && (
                        <>
                          <Button size="sm" variant="default" onClick={() => handleStatusChange(quote.id, 'approved')}>Approve & Create Invoice</Button>
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(quote.id, 'rejected')}>Reject</Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pagination.totalPages > 1 && (
                <PaginationControls
                  currentPage={pagination.currentPage} totalPages={pagination.totalPages}
                  pageSize={pagination.pageSize} totalItems={pagination.totalItems}
                  startIndex={pagination.startIndex} endIndex={pagination.endIndex}
                  hasNextPage={pagination.hasNextPage} hasPreviousPage={pagination.hasPreviousPage}
                  pageSizeOptions={pagination.pageSizeOptions}
                  onPageChange={pagination.goToPage} onNextPage={pagination.nextPage}
                  onPreviousPage={pagination.previousPage} onPageSizeChange={pagination.setPageSize}
                />
              )}
            </>
          )}
        </div>
      </div>
      <QuotePDFPreview quote={previewQuote} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
}

export default function Quotes() {
  return (
    <ProtectedRoute>
      <ErrorBoundary>
        <QuotesContent />
      </ErrorBoundary>
    </ProtectedRoute>
  );
}
