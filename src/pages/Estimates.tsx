import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateEstimateDialog } from "@/components/CreateEstimateDialog";
import { EstimatePDFPreview } from "@/components/EstimatePDFPreview";
import { inventoryStorage, Estimate } from "@/lib/inventory-storage";
import { Home, FileEdit, FileText, Calendar, DollarSign, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Estimates = () => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [previewEstimate, setPreviewEstimate] = useState<Estimate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadEstimates();
  }, []);

  const loadEstimates = () => {
    const allEstimates = inventoryStorage.getEstimates();
    setEstimates(allEstimates.sort((a, b) => 
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

  const handleStatusChange = (estimateId: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    const estimate = estimates.find(e => e.id === estimateId);
    
    if (newStatus === 'approved' && estimate) {
      // Create invoice from estimate
      const invoice = inventoryStorage.createInvoice({
        items: estimate.items,
        customerName: estimate.customerName,
        customerEmail: estimate.customerEmail,
        customerPhone: estimate.customerPhone,
        shipToAddress: estimate.shipToAddress,
        discount: estimate.discount,
        shippingCost: estimate.shippingCost,
        estimateId: estimate.id,
      });

      // Mark items as sold
      estimate.items.forEach((item) => {
        inventoryStorage.updateItem(item.itemId, {
          status: 'sold',
          soldDate: new Date().toISOString(),
          invoiceId: invoice.id,
        });
      });

      toast({
        title: "Estimate Approved",
        description: `Invoice ${invoice.invoiceNumber} created successfully`,
      });

      // Update estimate status
      inventoryStorage.updateEstimate(estimateId, { status: newStatus });
      loadEstimates();

      // Navigate to invoices tab
      setTimeout(() => navigate('/'), 500);
    } else {
      inventoryStorage.updateEstimate(estimateId, { status: newStatus });
      loadEstimates();
    }
  };

  const handlePreview = (estimate: Estimate) => {
    setPreviewEstimate(estimate);
    setPreviewOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Estimates
            </h1>
            <p className="text-muted-foreground mt-2">
              Create and manage customer estimates
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            </Link>
            <CreateEstimateDialog onEstimateCreated={loadEstimates} />
          </div>
        </div>

        <div className="grid gap-4">
          {estimates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No estimates created yet</p>
              </CardContent>
            </Card>
          ) : (
            estimates.map((estimate) => (
              <Card key={estimate.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {estimate.estimateNumber}
                      </CardTitle>
                      {estimate.customerName && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {estimate.customerName}
                        </p>
                      )}
                    </div>
                    <Badge className={getStatusColor(estimate.status)}>
                      {estimate.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(estimate.createdAt).toLocaleDateString()}
                      </div>
                      {estimate.customerEmail && (
                        <div className="text-sm text-muted-foreground">
                          {estimate.customerEmail}
                        </div>
                      )}
                      {estimate.customerPhone && (
                        <div className="text-sm text-muted-foreground">
                          {estimate.customerPhone}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {estimate.shipToAddress && (
                        <div className="text-sm text-muted-foreground">
                          <div className="font-medium">Ship To:</div>
                          <div>{estimate.shipToAddress.street}</div>
                          <div>
                            {estimate.shipToAddress.city}, {estimate.shipToAddress.state} {estimate.shipToAddress.zip}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Items:</span>
                        <span>{estimate.items.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>${estimate.subtotal.toFixed(2)}</span>
                      </div>
                      {estimate.discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Discount:</span>
                          <span>-${estimate.discount.toFixed(2)}</span>
                        </div>
                      )}
                      {estimate.shippingCost > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Shipping:</span>
                          <span>${estimate.shippingCost.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="font-semibold flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Total:
                        </span>
                        <span className="text-xl font-bold text-primary">
                          ${estimate.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePreview(estimate)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Preview PDF
                    </Button>
                    {estimate.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleStatusChange(estimate.id, 'approved')}
                        >
                          Approve & Create Invoice
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(estimate.id, 'rejected')}
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

      <EstimatePDFPreview 
        estimate={previewEstimate}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
};

export default Estimates;
