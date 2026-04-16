import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, TrendingDown, Package, FileText, Calculator, ChevronDown, ChevronRight, Truck, Receipt, CreditCard, Scale, Search } from "lucide-react";
import { inventoryStorage, InventoryItem, Invoice, Quote } from "@/lib/inventory-storage";
import { InvoicePDFPreview } from "@/components/InvoicePDFPreview";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { getPurchaseOrders, getVendors, type PurchaseOrder, type Vendor } from "@/lib/po-storage";
import { getExpenses, getCategoryLabel, EXPENSE_CATEGORY_GROUPS, type Expense } from "@/lib/expense-storage";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { FinancialReports } from "@/components/FinancialReports";
import { QuickBooksConnection } from "@/components/QuickBooksConnection";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useDebouncedSearch } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/inventory/PaginationControls";
import { EmptyState } from "@/components/EmptyState";

interface AccountingData {
  items: InventoryItem[];
  invoices: Invoice[];
  quotes: Quote[];
  expenses: Expense[];
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
}

function AccountingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountingContent() {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [pendingQuotesOpen, setPendingQuotesOpen] = useState(false);
  const [approvedQuotesOpen, setApprovedQuotesOpen] = useState(false);
  const [paidInvoicesOpen, setPaidInvoicesOpen] = useState(false);
  const [unpaidInvoicesOpen, setUnpaidInvoicesOpen] = useState(false);
  const [vendorPOsOpen, setVendorPOsOpen] = useState<Record<string, boolean>>({});
  const { searchQuery, debouncedQuery, setSearchQuery } = useDebouncedSearch("", 300);

  const fetchData = useCallback(async (): Promise<AccountingData> => {
    const [items, invoices, quotes, vendors, purchaseOrders, expenses] = await Promise.all([
      inventoryStorage.getItems(),
      inventoryStorage.getInvoices(),
      inventoryStorage.getQuotes(),
      getVendors(),
      getPurchaseOrders(),
      getExpenses()
    ]);
    return { items, invoices, quotes, expenses, vendors, purchaseOrders };
  }, []);

  const { data, loading, refresh } = useAsyncData(fetchData, {
    loadOnMount: true,
    errorMessage: "Failed to load accounting data",
    cacheKey: "accounting-data",
    cacheDuration: 2 * 60 * 1000,
  });

  const items = data?.items || [];
  const invoices = data?.invoices || [];
  const quotes = data?.quotes || [];
  const expenses = data?.expenses || [];
  const vendors = data?.vendors || [];
  const purchaseOrders = data?.purchaseOrders || [];

  // Filter by search
  const q = debouncedQuery.toLowerCase();
  const filteredInvoices = q ? invoices.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q)
  ) : invoices;

  const soldItems = items.filter(item => item.status === 'sold');
  const availableItems = items.filter(item => item.status === 'available');
  const totalCOGS = soldItems.reduce((sum, item) => sum + item.cost, 0);
  const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const inventoryValue = availableItems.reduce((sum, item) => sum + item.cost, 0);
  const totalDiscounts = invoices.reduce((sum, invoice) => sum + invoice.discount, 0);
  const totalShipping = invoices.reduce((sum, invoice) => sum + invoice.shippingCost, 0);

  const pendingQuotes = quotes.filter(e => e.status === 'pending');
  const approvedQuotes = quotes.filter(e => e.status === 'approved');
  const pendingQuotesValue = pendingQuotes.reduce((sum, q) => sum + q.total, 0);
  const approvedQuotesValue = approvedQuotes.reduce((sum, q) => sum + q.total, 0);

  const paidInvoices = filteredInvoices.filter(inv => inv.paid);
  const unpaidInvoices = filteredInvoices.filter(inv => !inv.paid);
  const paidInvoicesValue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const unpaidInvoicesValue = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0);

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const expensesByCategory = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const expensesByGroup = Object.entries(EXPENSE_CATEGORY_GROUPS).reduce((acc, [groupKey, group]) => {
    const groupExpenses = group.categories.reduce((sum, cat) => sum + (expensesByCategory[cat] || 0), 0);
    if (groupExpenses > 0) {
      acc[groupKey] = {
        label: group.label, total: groupExpenses,
        categories: group.categories
          .filter(cat => expensesByCategory[cat] && expensesByCategory[cat] > 0)
          .map(cat => ({ category: cat, amount: expensesByCategory[cat] || 0 }))
      };
    }
    return acc;
  }, {} as Record<string, { label: string; total: number; categories: { category: string; amount: number }[] }>);

  const totalPOValue = purchaseOrders.reduce((sum, po) => sum + po.total, 0);
  const posByVendor = vendors.map(vendor => ({
    vendor,
    pos: purchaseOrders.filter(po => po.vendorId === vendor.id),
    totalValue: purchaseOrders.filter(po => po.vendorId === vendor.id).reduce((sum, po) => sum + po.total, 0)
  })).filter(v => v.pos.length > 0);

  const now = new Date();
  const inventoryAges = availableItems.map(item => (now.getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const avgInventoryAge = inventoryAges.length > 0 ? inventoryAges.reduce((sum, age) => sum + age, 0) / inventoryAges.length : 0;
  const salePriceValue = availableItems.reduce((sum, item) => sum + (item.salePrice || 0), 0);

  const paginatedPaidInvoices = paidInvoices.slice(0, 10);
  const paginatedUnpaidInvoices = unpaidInvoices.slice(0, 10);

  const handleInvoiceUpdated = () => {
    refresh();
    if (selectedInvoice) {
      inventoryStorage.getInvoices().then(invoices => {
        const updated = invoices.find(inv => inv.id === selectedInvoice.id);
        if (updated) setSelectedInvoice(updated);
      });
    }
  };

  if (loading) return <AccountingSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground mt-1">Financial overview and cost analysis</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices by number or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
              <p className="text-xs text-muted-foreground">Margin: {grossProfitMargin.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.location.href = '/expenses'}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">${totalExpenses.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{expenses.length} expenses tracked</p>
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
              <CardTitle className="text-sm font-medium">Pending Quotes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${pendingQuotesValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{pendingQuotes.length} quotes</p>
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

          {/* Invoice Tracker */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Invoice Tracker
              </CardTitle>
              <CardDescription>Paid vs Unpaid invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length === 0 ? (
                <EmptyState icon={Receipt} title="No invoices found" description={debouncedQuery ? "Try a different search term" : "Create your first invoice to get started"} />
              ) : (
                <div className="space-y-4">
                  <Collapsible open={paidInvoicesOpen} onOpenChange={setPaidInvoicesOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="p-4 border rounded-lg bg-green-500/10 cursor-pointer hover:bg-green-500/20 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-green-700">Paid Invoices</span>
                            {paidInvoicesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                          <Badge variant="default" className="bg-green-500">{paidInvoices.length}</Badge>
                        </div>
                        <div className="text-2xl font-bold text-green-700">${paidInvoicesValue.toFixed(2)}</div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="space-y-2 pl-4 max-h-48 overflow-y-auto">
                        {paginatedPaidInvoices.map((invoice) => (
                          <div key={invoice.id} className="flex justify-between items-center p-2 border rounded bg-background/50 text-sm cursor-pointer hover:bg-muted/50"
                            onClick={() => { setSelectedInvoice(invoice); setInvoicePreviewOpen(true); }}>
                            <div>
                              <div className="font-medium">{invoice.invoiceNumber}</div>
                              <div className="text-xs text-muted-foreground">{invoice.customerName}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">${invoice.total.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">{invoice.items.length} items</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible open={unpaidInvoicesOpen} onOpenChange={setUnpaidInvoicesOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="p-4 border rounded-lg bg-red-500/10 cursor-pointer hover:bg-red-500/20 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-red-700">Unpaid Invoices</span>
                            {unpaidInvoicesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                          <Badge variant="destructive">{unpaidInvoices.length}</Badge>
                        </div>
                        <div className="text-2xl font-bold text-red-700">${unpaidInvoicesValue.toFixed(2)}</div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="space-y-2 pl-4 max-h-48 overflow-y-auto">
                        {paginatedUnpaidInvoices.map((invoice) => (
                          <div key={invoice.id} className="flex justify-between items-center p-2 border rounded bg-background/50 text-sm cursor-pointer hover:bg-muted/50"
                            onClick={() => { setSelectedInvoice(invoice); setInvoicePreviewOpen(true); }}>
                            <div>
                              <div className="font-medium">{invoice.invoiceNumber}</div>
                              <div className="text-xs text-muted-foreground">{invoice.customerName}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">${invoice.total.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">{invoice.items.length} items</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quotes Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Quotes Overview</CardTitle>
              <CardDescription>Quote status and value</CardDescription>
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <EmptyState icon={FileText} title="No quotes yet" description="Create quotes from the Quotes page" />
              ) : (
                <div className="space-y-4">
                  <Collapsible open={pendingQuotesOpen} onOpenChange={setPendingQuotesOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="p-4 border rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Pending Quotes</span>
                            {pendingQuotesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                          <Badge variant="outline">{pendingQuotes.length}</Badge>
                        </div>
                        <div className="text-2xl font-bold">${pendingQuotesValue.toFixed(2)}</div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="space-y-2 pl-4">
                        {pendingQuotes.map((quote) => (
                          <div key={quote.id} className="flex justify-between items-center p-2 border rounded bg-background/50 text-sm">
                            <div>
                              <div className="font-medium">{quote.quoteNumber}</div>
                              <div className="text-xs text-muted-foreground">{quote.customerName}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">${quote.total.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">{quote.items.length} items</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible open={approvedQuotesOpen} onOpenChange={setApprovedQuotesOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="p-4 border rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Approved Quotes</span>
                            {approvedQuotesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                          <Badge variant="default">{approvedQuotes.length}</Badge>
                        </div>
                        <div className="text-2xl font-bold">${approvedQuotesValue.toFixed(2)}</div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="space-y-2 pl-4">
                        {approvedQuotes.map((quote) => (
                          <div key={quote.id} className="flex justify-between items-center p-2 border rounded bg-background/50 text-sm">
                            <div>
                              <div className="font-medium">{quote.quoteNumber}</div>
                              <div className="text-xs text-muted-foreground">{quote.customerName}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">${quote.total.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">{quote.items.length} items</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="p-4 border rounded-lg bg-primary/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Total Quotes Value</span>
                      <Badge>{quotes.length}</Badge>
                    </div>
                    <div className="text-2xl font-bold">${(pendingQuotesValue + approvedQuotesValue).toFixed(2)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense Tracker */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Expense Tracker</CardTitle>
                <CardDescription>Track business expenses</CardDescription>
              </div>
              <AddExpenseDialog onExpenseAdded={refresh} />
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <EmptyState icon={CreditCard} title="No expenses recorded" description="Add your first expense to start tracking" />
              ) : (
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-orange-500/10 cursor-pointer hover:bg-orange-500/20 transition-colors"
                    onClick={() => window.location.href = '/expenses'}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-orange-700">Total Expenses</span>
                      <Badge variant="outline" className="border-orange-500 text-orange-700">{expenses.length}</Badge>
                    </div>
                    <div className="text-2xl font-bold text-orange-700">${totalExpenses.toFixed(2)}</div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Operating Expenses Breakdown</h4>
                    {Object.entries(expensesByGroup).map(([groupKey, group]) => (
                      <Collapsible key={groupKey}>
                        <CollapsibleTrigger className="w-full">
                          <div className="flex justify-between items-center p-2 border rounded bg-muted/30 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                              <span className="font-medium">{group.label}</span>
                            </div>
                            <span className="font-bold">${group.total.toFixed(2)}</span>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-6 mt-1 space-y-1">
                            {group.categories.map(({ category, amount }) => (
                              <div key={category} className="flex justify-between items-center p-1.5 text-sm text-muted-foreground">
                                <span>{getCategoryLabel(category)}</span>
                                <span>${amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Recent Expenses</h4>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {expenses.slice(0, 5).map((expense) => (
                        <div key={expense.id} className="p-2 border rounded bg-background/50 text-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{expense.employeeName}</div>
                              <div className="text-xs text-muted-foreground">
                                {getCategoryLabel(expense.category)} • {new Date(expense.expenseDate).toLocaleDateString()}
                              </div>
                              {expense.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{expense.description}</div>}
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">${expense.amount.toFixed(2)}</div>
                              {expense.creditCardLast4 && <div className="text-xs text-muted-foreground">•••• {expense.creditCardLast4}</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
                  <span className="text-sm text-muted-foreground">Sale Price Value</span>
                  <span className="font-semibold">${salePriceValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Sold Units</span>
                  <span className="font-semibold">{soldItems.length}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Avg Cost per Item</span>
                  <span className="font-semibold">${availableItems.length > 0 ? (inventoryValue / availableItems.length).toFixed(2) : '0.00'}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Avg Inventory Age</span>
                  <span className="font-semibold">{avgInventoryAge.toFixed(0)} days</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-semibold">Turnover Rate</span>
                  <span className="font-bold">{items.length > 0 ? ((soldItems.length / items.length) * 100).toFixed(1) : '0'}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Sales */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
              <CardDescription>Latest 5 invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <EmptyState icon={Receipt} title="No invoices yet" description="Sales will appear here once invoices are created" />
              ) : (
                <div className="space-y-3">
                  {invoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id}
                      className="flex justify-between items-center p-3 border rounded-lg bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => { setSelectedInvoice(invoice); setInvoicePreviewOpen(true); }}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{invoice.invoiceNumber}</span>
                          {invoice.paid ? (
                            <Badge variant="default" className="bg-green-500 text-xs">Paid</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Unpaid</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${invoice.total.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{invoice.items.length} items</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Vendors & Purchase Orders */}
        {posByVendor.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Vendors & Purchase Orders</h2>
              <Card className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Total PO Value</div>
                    <div className="text-lg font-bold">${totalPOValue.toFixed(2)}</div>
                  </div>
                </div>
              </Card>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {posByVendor.map(({ vendor, pos, totalValue }) => (
                <Card key={vendor.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{vendor.name}</CardTitle>
                        <CardDescription>
                          {vendor.email && <div>{vendor.email}</div>}
                          {vendor.phone && <div>{vendor.phone}</div>}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
                        <Badge variant="outline">{pos.length} {pos.length === 1 ? 'PO' : 'POs'}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Collapsible open={vendorPOsOpen[vendor.id]} onOpenChange={(open) => setVendorPOsOpen(prev => ({ ...prev, [vendor.id]: open }))}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between p-2">
                          <span className="font-medium">View Purchase Orders</span>
                          {vendorPOsOpen[vendor.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="space-y-2">
                          {pos.map((po) => (
                            <div key={po.id} className="p-3 border rounded-lg bg-muted/20">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium">{po.poNumber}</div>
                                  <div className="text-xs text-muted-foreground mt-1">{new Date(po.createdAt).toLocaleDateString()}</div>
                                  <Badge variant={po.status === 'pending' ? 'outline' : 'default'} className="mt-1">{po.status}</Badge>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold">${po.total.toFixed(2)}</div>
                                  <div className="text-xs text-muted-foreground">{po.items.length} items</div>
                                </div>
                              </div>
                              {po.notes && <div className="mt-2 text-sm text-muted-foreground">{po.notes}</div>}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        <QuickBooksConnection onSyncComplete={refresh} />
        <FinancialReports />
      </div>

      <div className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Scale className="h-4 w-4" />
            <Link to="/legal" className="hover:text-foreground hover:underline transition-colors">
              End-User License Agreement & Privacy Policy
            </Link>
          </div>
        </div>
      </div>

      <InvoicePDFPreview
        invoice={selectedInvoice}
        open={invoicePreviewOpen}
        onOpenChange={setInvoicePreviewOpen}
        onInvoiceUpdated={handleInvoiceUpdated}
      />
    </div>
  );
}

export default function Accounting() {
  return (
    <ProtectedRoute>
      <ErrorBoundary>
        <AccountingContent />
      </ErrorBoundary>
    </ProtectedRoute>
  );
}
