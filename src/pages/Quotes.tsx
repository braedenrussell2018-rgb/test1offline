import { useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateQuoteDialog } from "@/components/CreateQuoteDialog";
import { QuotePDFPreview } from "@/components/QuotePDFPreview";
import { EditQuoteDialog } from "@/components/EditQuoteDialog";
import { EditInvoiceDialog } from "@/components/EditInvoiceDialog";
import { QuoteDraftsDialog } from "@/components/QuoteDraftsDialog";
import { inventoryStorage, Quote, Invoice } from "@/lib/inventory-storage";
import { Home, FileText, Calendar, DollarSign, Eye, Search, Pencil, ArrowRightCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useDebouncedSearch } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/inventory/PaginationControls";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

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

type StatusFilter = 'all' | 'draft' | 'pending' | 'approved' | 'rejected' | 'expired';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'expired', label: 'Expired' },
];

function isExpired(quote: Quote): boolean {
  if (quote.status !== 'pending') return false;
  if (!quote.expiresAt) return false;
  return new Date(quote.expiresAt).getTime() < Date.now();
}

function effectiveStatus(quote: Quote): string {
  return isExpired(quote) ? 'expired' : quote.status;
}

function QuotesContent() {
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null);
  const [pendingInvoice, setPendingInvoice] = useState<Invoice | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: allQuotes.length, draft: 0, pending: 0, approved: 0, rejected: 0, expired: 0 };
    for (const q of allQuotes) {
      const s = effectiveStatus(q) as StatusFilter;
      if (c[s] !== undefined) c[s]++;
    }
    return c;
  }, [allQuotes]);

  const q = debouncedQuery.toLowerCase();
  const filteredQuotes = allQuotes.filter(quote => {
    if (statusFilter !== 'all' && effectiveStatus(quote) !== statusFilter) return false;
    if (!q) return true;
    return (
      quote.quoteNumber.toLowerCase().includes(q) ||
      quote.customerName.toLowerCase().includes(q) ||
      quote.status.toLowerCase().includes(q)
    );
  });

  const pagination = usePagination(filteredQuotes, { initialPageSize: 25 });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'draft': return 'bg-amber-500';
      case 'expired': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const handleReject = async (quoteId: string) => {
    await inventoryStorage.updateQuote(quoteId, { status: 'rejected' });
    refresh();
    toast({ title: "Quote rejected" });
  };

  // Step 1 of conversion: create a draft invoice from the quote and open the editor
  const handleStartConvert = async (quote: Quote) => {
    try {
      const invoiceNumber = `INV-${Date.now()}`;
      const draft = await inventoryStorage.createInvoice({
        invoiceNumber,
        items: quote.items,
        customerName: quote.customerName,
        customerEmail: quote.customerEmail,
        customerPhone: quote.customerPhone,
        customerAddress: quote.customerAddress,
        shipToName: quote.shipToName,
        shipToAddress: quote.shipToAddress,
        discount: quote.discount,
        shippingCost: quote.shippingCost,
        tax: quote.tax,
        notes: quote.notes,
        subtotal: quote.subtotal,
        total: quote.total,
        salesmanName: quote.salesmanName,
        status: 'draft',
        sourceQuoteId: quote.id,
      } as any);
      setConvertingQuote(quote);
      setPendingInvoice(draft);
      setConvertOpen(true);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to start invoice conversion", variant: "destructive" });
    }
  };

  // Step 2: when editor saves and finalizes, mark the quote approved + items sold
  const handleConvertSaved = async () => {
    if (!convertingQuote || !pendingInvoice) {
      setConvertOpen(false);
      return;
    }
    try {
      // Re-fetch the saved invoice to know its current status
      const invoices = await inventoryStorage.getInvoices();
      const saved = invoices.find(i => i.id === pendingInvoice.id);
      if (saved && saved.status === 'finalized') {
        await inventoryStorage.updateQuote(convertingQuote.id, { status: 'approved' });
        for (const item of saved.items) {
          await inventoryStorage.updateItem(item.itemId, {
            status: 'sold',
            soldDate: new Date().toISOString(),
            invoiceId: saved.id,
          });
        }
        toast({ title: "Invoice created", description: `Invoice ${saved.invoiceNumber} finalized from quote` });
        setConvertOpen(false);
        setConvertingQuote(null);
        setPendingInvoice(null);
        refresh();
        navigate('/');
        return;
      }
      // Saved as draft — keep quote pending, refresh
      toast({ title: "Saved as draft", description: "Invoice draft saved. Quote remains pending." });
      setConvertOpen(false);
      setConvertingQuote(null);
      setPendingInvoice(null);
      refresh();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to finalize conversion", variant: "destructive" });
    }
  };

  // If user closes the convert dialog without finalizing, delete the draft so we don't leak orphans
  const handleConvertOpenChange = async (open: boolean) => {
    if (!open && pendingInvoice && convertingQuote) {
      try {
        const invoices = await inventoryStorage.getInvoices();
        const saved = invoices.find(i => i.id === pendingInvoice.id);
        if (!saved || saved.status === 'draft') {
          // user cancelled before finalizing
          await inventoryStorage.deleteInvoice(pendingInvoice.id);
        } else if (saved.status === 'finalized') {
          // already handled in onSaved
        }
      } catch (err) {
        console.warn("Cleanup failed:", err);
      }
      setConvertingQuote(null);
      setPendingInvoice(null);
    }
    setConvertOpen(open);
  };

  if (loading) return <QuotesSkeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Quotes</h1>
            <p className="text-muted-foreground mt-2">Create and manage customer quotes</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/"><Button variant="outline"><Home className="mr-2 h-4 w-4" />Home</Button></Link>
            <QuoteDraftsDialog onQuoteUpdated={refresh} />
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

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <Button
              key={f.key}
              size="sm"
              variant={statusFilter === f.key ? "default" : "outline"}
              onClick={() => { setStatusFilter(f.key); pagination.goToPage(1); }}
              className={cn("rounded-full")}
            >
              {f.label}
              <Badge variant="secondary" className="ml-2">{counts[f.key]}</Badge>
            </Button>
          ))}
        </div>

        <div className="grid gap-4">
          {pagination.paginatedData.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={FileText}
                  title={debouncedQuery || statusFilter !== 'all' ? "No quotes match your filters" : "No quotes created yet"}
                  description={debouncedQuery || statusFilter !== 'all' ? "Try a different search or status" : "Create your first quote to get started"}
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {pagination.paginatedData.map((quote) => {
                const status = effectiveStatus(quote);
                return (
                <Card key={quote.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />{quote.quoteNumber}
                        </CardTitle>
                        {quote.customerName && <p className="text-sm text-muted-foreground mt-1">{quote.customerName}</p>}
                      </div>
                      <Badge className={getStatusColor(status)}>{status}</Badge>
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
                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => { setPreviewQuote(quote); setPreviewOpen(true); }}>
                        <Eye className="mr-2 h-4 w-4" />Preview PDF
                      </Button>
                      {(status === 'pending' || status === 'draft') && (
                        <Button size="sm" variant="outline" onClick={() => { setEditQuote(quote); setEditOpen(true); }}>
                          <Pencil className="mr-2 h-4 w-4" />Edit
                        </Button>
                      )}
                      {status === 'pending' && (
                        <>
                          <Button size="sm" variant="default" onClick={() => handleStartConvert(quote)}>
                            <ArrowRightCircle className="mr-2 h-4 w-4" />Convert to Invoice
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(quote.id)}>Reject</Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );})}
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
      <EditQuoteDialog quote={editQuote} open={editOpen} onOpenChange={setEditOpen} onSaved={refresh} />
      <EditInvoiceDialog
        invoice={pendingInvoice}
        open={convertOpen}
        onOpenChange={handleConvertOpenChange}
        onSaved={handleConvertSaved}
      />
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
