import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateQuoteDialog } from "@/components/CreateQuoteDialog";
import { QuotePDFPreview } from "@/components/QuotePDFPreview";
import { inventoryStorage, Quote } from "@/lib/inventory-storage";
import { Home, FileEdit, FileText, Calendar, DollarSign, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Quotes = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    const allQuotes = await inventoryStorage.getQuotes();
    setQuotes(allQuotes.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'approved':
        return 'bg-green-500';
      case 'rejected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleStatusChange = async (quoteId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    const quote = quotes.find(e => e.id === quoteId);
    
    if (newStatus === 'approved' && quote) {
      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}`;
      
      // Create invoice from quote
      const invoice = await inventoryStorage.createInvoice({
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
        subtotal: quote.subtotal,
        total: quote.total,
      });

      // Mark items as sold
      for (const item of quote.items) {
        await inventoryStorage.updateItem(item.itemId, {
          status: 'sold',
          soldDate: new Date().toISOString(),
          invoiceId: invoice.id,
        });
      }

      toast({
        title: "Invoice created",
        description: `Invoice ${invoice.invoiceNumber} has been created`,
      });

      navigate('/');
    }

    // Update quote status
    const updatedQuote = { ...quote!, status: newStatus };
    await inventoryStorage.updateQuote(updatedQuote);
    loadQuotes();

    toast({
      title: "Status updated",
      description: `Quote status changed to ${newStatus}`,
    });
  };

  const handlePreview = (quote: Quote) => {
    setPreviewQuote(quote);
    setPreviewOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Quotes
            </h1>
            <p className="text-muted-foreground mt-2">
              Create and manage customer quotes
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            </Link>
            <CreateQuoteDialog onQuoteCreated={loadQuotes} />
          </div>
        </div>

        <div className="grid gap-4">
          {quotes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No quotes created yet</p>
              </CardContent>
            </Card>
          ) : (
            quotes.map((quote) => (
              <Card key={quote.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {quote.quoteNumber}
                      </CardTitle>
                      {quote.customerName && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {quote.customerName}
                        </p>
                      )}
                    </div>
                    <Badge className={getStatusColor(quote.status)}>
                      {quote.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(quote.createdAt).toLocaleDateString()}
                      </div>
                      {quote.customerEmail && (
                        <div className="text-sm text-muted-foreground">
                          {quote.customerEmail}
                        </div>
                      )}
                      {quote.customerPhone && (
                        <div className="text-sm text-muted-foreground">
                          {quote.customerPhone}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {quote.shipToAddress && (
                        <div className="text-sm text-muted-foreground">
                          <div className="font-medium">Ship To:</div>
                          <div>{quote.shipToAddress}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Items:</span>
                        <span>{quote.items.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>${quote.subtotal.toFixed(2)}</span>
                      </div>
                      {quote.discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Discount:</span>
                          <span>-${quote.discount.toFixed(2)}</span>
                        </div>
                      )}
                      {quote.shippingCost > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Shipping:</span>
                          <span>${quote.shippingCost.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="font-semibold flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Total:
                        </span>
                        <span className="text-xl font-bold text-primary">
                          ${quote.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePreview(quote)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview PDF
                    </Button>
                    {quote.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleStatusChange(quote.id, 'approved')}
                        >
                          Approve & Create Invoice
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(quote.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <QuotePDFPreview 
        quote={previewQuote}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
};

export default Quotes;
