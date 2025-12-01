import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Building2, FileText, StickyNote, Mail, Phone, MapPin, Briefcase, User, Eye, Download, Users, UserPlus } from "lucide-react";
import { AddCompanyDialog } from "@/components/AddCompanyDialog";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { CompanyDetailDialog } from "@/components/CompanyDetailDialog";
import { PersonDetailDialog } from "@/components/PersonDetailDialog";
import { QuotePDFPreview } from "@/components/QuotePDFPreview";
import { InvoicePDFPreview } from "@/components/InvoicePDFPreview";
import { AssignSalesmanDialog } from "@/components/AssignSalesmanDialog";
import { MergeDuplicatesDialog } from "@/components/MergeDuplicatesDialog";
import { inventoryStorage, Company, Person, Quote, Invoice } from "@/lib/inventory-storage";

const CRM = () => {
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('crm_active_tab') || "companies";
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [quotePreviewOpen, setQuotePreviewOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [assignSalesmanOpen, setAssignSalesmanOpen] = useState(false);
  const [assignSalesmanType, setAssignSalesmanType] = useState<"invoice" | "quote">("invoice");
  const [assignSalesmanId, setAssignSalesmanId] = useState("");
  const [assignSalesmanDocNumber, setAssignSalesmanDocNumber] = useState("");
  const [assignSalesmanCurrent, setAssignSalesmanCurrent] = useState<string | undefined>();
  const [mergeDuplicatesOpen, setMergeDuplicatesOpen] = useState(false);

  // Persist active tab on change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    sessionStorage.setItem('crm_active_tab', value);
  };

  useEffect(() => {
    const loadData = async () => {
      const [companiesData, personsData, quotesData, invoicesData] = await Promise.all([
        inventoryStorage.getCompanies(),
        inventoryStorage.getPersons(),
        inventoryStorage.getQuotes(),
        inventoryStorage.getInvoices()
      ]);
      setCompanies(companiesData);
      setPersons(personsData);
      setQuotes(quotesData);
      setInvoices(invoicesData);
    };
    loadData();
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || "Unknown Company";
  };

  const handlePersonClick = (person: Person) => {
    setSelectedPerson(person);
  };

  const handleQuotePreview = (quote: Quote) => {
    setPreviewQuote(quote);
    setQuotePreviewOpen(true);
  };

  const handleInvoicePreview = (invoice: Invoice) => {
    setPreviewInvoice(invoice);
    setInvoicePreviewOpen(true);
  };

  const handleAssignSalesman = (type: "invoice" | "quote", id: string, docNumber: string, currentSalesman?: string) => {
    setAssignSalesmanType(type);
    setAssignSalesmanId(id);
    setAssignSalesmanDocNumber(docNumber);
    setAssignSalesmanCurrent(currentSalesman);
    setAssignSalesmanOpen(true);
  };

  const pendingQuotes = quotes.filter(q => q.status === 'pending');

  // Salesman Statistics
  const salesmanStats = new Map<string, { revenue: number; invoiceCount: number; quoteCount: number }>();
  
  // Calculate invoice revenue and count per salesman
  invoices.forEach(invoice => {
    const salesman = invoice.salesmanName || 'Unassigned';
    const current = salesmanStats.get(salesman) || { revenue: 0, invoiceCount: 0, quoteCount: 0 };
    salesmanStats.set(salesman, {
      revenue: current.revenue + invoice.total,
      invoiceCount: current.invoiceCount + 1,
      quoteCount: current.quoteCount,
    });
  });
  
  // Calculate quote count per salesman
  quotes.forEach(quote => {
    const salesman = quote.salesmanName || 'Unassigned';
    const current = salesmanStats.get(salesman) || { revenue: 0, invoiceCount: 0, quoteCount: 0 };
    salesmanStats.set(salesman, {
      revenue: current.revenue,
      invoiceCount: current.invoiceCount,
      quoteCount: current.quoteCount + 1,
    });
  });

  const salesmenArray = Array.from(salesmanStats.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.revenue - a.revenue);

  const exportContactsToCSV = () => {
    // Create CSV header
    const headers = ['First Name', 'Last Name', 'Email', 'Phone Number'];
    
    // Create CSV rows
    const rows = persons.map(person => {
      // Split name into first and last name
      const nameParts = person.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      return [
        firstName,
        lastName,
        person.email || '',
        person.phone || ''
      ];
    });
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `contacts_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground mt-1">Track quotes, invoices, and notes for each company</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card 
            className="cursor-pointer hover:bg-accent/5 transition-colors"
            onClick={() => setActiveTab("companies")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companies.length}</div>
              <p className="text-xs text-muted-foreground">Active clients</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/5 transition-colors"
            onClick={() => setActiveTab("contacts")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{persons.length}</div>
              <p className="text-xs text-muted-foreground">People in system</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/5 transition-colors"
            onClick={() => setActiveTab("quotes")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Quotes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingQuotes.length}</div>
              <p className="text-xs text-muted-foreground">Pending quotes</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <AddCompanyDialog onCompanyAdded={handleRefresh} />
          <AddPersonDialog onPersonAdded={handleRefresh} />
          <Button 
            variant="outline" 
            onClick={exportContactsToCSV}
            disabled={persons.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Contacts
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setMergeDuplicatesOpen(true)}
            disabled={persons.length < 2}
          >
            <Users className="mr-2 h-4 w-4" />
            Find Duplicates
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto">
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Companies</CardTitle>
                <CardDescription>Manage your clients and organizations</CardDescription>
              </CardHeader>
              <CardContent>
                {companies.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No companies yet. Add your first company to get started.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {companies.map((company) => {
                      const companyPersons = persons.filter(p => p.companyId === company.id);
                      return (
                        <CompanyDetailDialog
                          key={company.id}
                          company={company}
                          persons={companyPersons}
                          onPersonClick={handlePersonClick}
                          onUpdate={handleRefresh}
                        >
                           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg bg-card hover:bg-accent/10 transition-colors cursor-pointer">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-base sm:text-lg">{company.name}</span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {companyPersons.length} {companyPersons.length === 1 ? 'contact' : 'contacts'}
                              </div>
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              Added {new Date(company.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </CompanyDetailDialog>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Contacts</CardTitle>
                <CardDescription>View and manage your contacts</CardDescription>
              </CardHeader>
              <CardContent>
                {persons.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No contacts yet. Add your first person to get started.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {persons.map((person) => (
                      <PersonDetailDialog
                        key={person.id}
                        person={person}
                        companyName={getCompanyName(person.companyId)}
                        onUpdate={handleRefresh}
                      >
                        <div className="border rounded-lg p-3 sm:p-4 bg-card hover:bg-accent/5 transition-colors cursor-pointer">
                          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                              <div className="flex-1 space-y-2">
                                <div>
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-base sm:text-lg">
                                      {person.name}
                                    </h3>
                                  <Badge variant="secondary" className="w-fit">
                                    {getCompanyName(person.companyId)}
                                  </Badge>
                                </div>
                                {person.jobTitle && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Briefcase className="h-3 w-3" />
                                    <span>{person.jobTitle}</span>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1">
                                {person.email && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <a href={`mailto:${person.email}`} className="text-primary hover:underline">
                                      {person.email}
                                    </a>
                                  </div>
                                )}
                                {person.phone && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    <a href={`tel:${person.phone}`} className="text-primary hover:underline">
                                      {person.phone}
                                    </a>
                                  </div>
                                )}
                                {person.address && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span>{person.address}</span>
                                  </div>
                                )}
                              </div>
                              {person.notes.length > 0 && (
                                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                                  <StickyNote className="h-3 w-3 inline mr-1" />
                                  {person.notes.length} {person.notes.length === 1 ? 'note' : 'notes'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </PersonDetailDialog>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Quotes</CardTitle>
                <CardDescription>Track quotes sent to companies</CardDescription>
              </CardHeader>
              <CardContent>
                {quotes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No quotes yet. Create your first quote.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {quotes.map((quote) => (
                      <div
                        key={quote.id}
                        className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-lg">{quote.quoteNumber}</div>
                            <div className="text-sm text-muted-foreground">
                              {quote.customerName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(quote.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">${quote.total.toFixed(2)}</div>
                            <Badge variant={quote.status === 'pending' ? 'outline' : quote.status === 'approved' ? 'default' : 'destructive'}>
                              {quote.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <UserPlus className="h-3 w-3" />
                          {quote.salesmanName || "No salesman assigned"}
                        </div>
                        <div className="border-t pt-3 mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuotePreview(quote)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Preview PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAssignSalesman("quote", quote.id, quote.quoteNumber, quote.salesmanName)}
                          >
                            <UserPlus className="mr-2 h-4 w-4" />
                            Assign Salesman
                          </Button>
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
                <CardTitle>Invoices by Company</CardTitle>
                <CardDescription>View invoices organized by company</CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No invoices yet. Invoices will appear here when created.
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
                              {invoice.customerName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(invoice.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">${invoice.total.toFixed(2)}</div>
                            <div className="text-sm text-muted-foreground">
                              {invoice.items.length} {invoice.items.length === 1 ? 'item' : 'items'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <UserPlus className="h-3 w-3" />
                          {invoice.salesmanName || "No salesman assigned"}
                        </div>
                        <div className="border-t pt-3 mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleInvoicePreview(invoice)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Preview PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAssignSalesman("invoice", invoice.id, invoice.invoiceNumber, invoice.salesmanName)}
                          >
                            <UserPlus className="mr-2 h-4 w-4" />
                            Assign Salesman
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

        {/* Salesman Performance */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Salesman Performance</CardTitle>
            <CardDescription>Revenue and activity by salesperson</CardDescription>
          </CardHeader>
          <CardContent>
            {salesmenArray.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No salesman data yet</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {salesmenArray.map((salesman) => (
                  <div key={salesman.name} className="border rounded-lg p-4 bg-muted/20">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-lg">{salesman.name}</div>
                        <div className="flex gap-4 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {salesman.invoiceCount} {salesman.invoiceCount === 1 ? 'invoice' : 'invoices'}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {salesman.quoteCount} {salesman.quoteCount === 1 ? 'quote' : 'quotes'}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">${salesman.revenue.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Total Revenue</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <QuotePDFPreview
          quote={previewQuote}
          open={quotePreviewOpen}
          onOpenChange={setQuotePreviewOpen}
        />

        <InvoicePDFPreview
          invoice={previewInvoice}
          open={invoicePreviewOpen}
          onOpenChange={setInvoicePreviewOpen}
        />

        <AssignSalesmanDialog
          open={assignSalesmanOpen}
          onOpenChange={setAssignSalesmanOpen}
          type={assignSalesmanType}
          id={assignSalesmanId}
          documentNumber={assignSalesmanDocNumber}
          currentSalesman={assignSalesmanCurrent}
          onAssigned={handleRefresh}
        />

        <MergeDuplicatesDialog
          open={mergeDuplicatesOpen}
          onOpenChange={setMergeDuplicatesOpen}
          persons={persons}
          companies={companies}
          onMerged={handleRefresh}
        />
      </div>
    </div>
  );
};

export default CRM;
