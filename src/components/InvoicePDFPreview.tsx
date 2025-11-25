import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Invoice, inventoryStorage } from "@/lib/inventory-storage";
import jsPDF from "jspdf";
import { Download, CheckCircle, Circle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvoicePDFPreviewProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvoiceUpdated?: () => void;
}

export const InvoicePDFPreview = ({ invoice, open, onOpenChange, onInvoiceUpdated }: InvoicePDFPreviewProps) => {
  const { toast } = useToast();

  const handleMarkAsPaid = async () => {
    if (!invoice) return;
    
    try {
      await inventoryStorage.updateInvoicePaidStatus(invoice.id, !invoice.paid);
      toast({
        title: "Success",
        description: invoice.paid ? "Invoice marked as unpaid" : "Invoice marked as paid",
      });
      onInvoiceUpdated?.();
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to update invoice status",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    if (!invoice) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header - Company Name
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("TRUE ATTACHMENTS", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("3045 E Chestnut Expy Ste K", pageWidth / 2, 28, { align: "center" });
    doc.text("Springfield, MO 65802", pageWidth / 2, 33, { align: "center" });
    doc.text("Info@TrueAttachments.com", pageWidth / 2, 38, { align: "center" });
    doc.text("417-306-9612", pageWidth / 2, 43, { align: "center" });

    // Date and Invoice Number
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DATE", 140, 20);
    doc.text("Invoice", 165, 20);
    
    doc.setFont("helvetica", "normal");
    doc.text(new Date(invoice.createdAt).toLocaleDateString(), 140, 26);
    doc.text(invoice.invoiceNumber, 165, 26);

    // Paid status
    if (invoice.paid) {
      doc.setTextColor(34, 197, 94);
      doc.setFont("helvetica", "bold");
      doc.text("PAID", 140, 35);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
    }

    // Bill To and Ship To
    let yPos = 55;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO", 20, yPos);
    doc.text("SHIP TO", 110, yPos);
    
    yPos += 5;
    doc.setFont("helvetica", "normal");
    if (invoice.customerName) {
      doc.text(invoice.customerName, 20, yPos);
      doc.text(invoice.customerName, 110, yPos);
      yPos += 5;
    }
    if (invoice.customerEmail) {
      doc.text(invoice.customerEmail, 20, yPos);
      yPos += 5;
    }
    if (invoice.customerPhone) {
      doc.text(invoice.customerPhone, 20, yPos);
      yPos += 5;
    }
    
    // Ship To Address
    let shipYPos = 65;
    if (invoice.customerName) shipYPos += 5;
    if (invoice.shipToAddress) {
      const lines = doc.splitTextToSize(invoice.shipToAddress, 75);
      doc.text(lines, 110, shipYPos);
      shipYPos += (lines.length * 5);
    }

    // Items Table
    yPos = Math.max(yPos, shipYPos) + 10;
    
    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos, 170, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Item", 22, yPos + 5);
    doc.text("Description", 60, yPos + 5);
    doc.text("Qty", 120, yPos + 5);
    doc.text("Rate", 135, yPos + 5);
    doc.text("Amount", 165, yPos + 5);
    
    yPos += 10;
    doc.setFont("helvetica", "normal");
    
    // Table rows
    invoice.items.forEach((item) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.text(item.partNumber, 22, yPos);
      const description = doc.splitTextToSize(item.description, 55);
      doc.text(description, 60, yPos);
      doc.text("1", 120, yPos);
      doc.text(`$${item.price.toFixed(2)}`, 135, yPos);
      doc.text(`$${item.price.toFixed(2)}`, 165, yPos);
      
      yPos += Math.max(6, description.length * 5);
      
      // Add salesman name in fine print
      if (invoice.salesmanName) {
        doc.setFontSize(7);
        doc.setTextColor(128, 128, 128);
        doc.text(`Added by: ${invoice.salesmanName}`, 60, yPos);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        yPos += 4;
      }
    });

    // Summary
    yPos += 10;
    const summaryX = 140;
    doc.setFont("helvetica", "normal");
    
    doc.text("SUBTOTAL", summaryX, yPos);
    doc.text(`$${invoice.subtotal.toFixed(2)}`, 175, yPos, { align: "right" });
    yPos += 6;
    
    doc.text("SHIPPING", summaryX, yPos);
    doc.text(`$${invoice.shippingCost.toFixed(2)}`, 175, yPos, { align: "right" });
    yPos += 6;
    
    doc.text("DISCOUNT", summaryX, yPos);
    doc.text(`$${invoice.discount.toFixed(2)}`, 175, yPos, { align: "right" });
    yPos += 6;
    
    doc.text("TAX", summaryX, yPos);
    doc.text("$0.00", 175, yPos, { align: "right" });
    yPos += 8;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL", summaryX, yPos);
    doc.text(`$${invoice.total.toFixed(2)}`, 175, yPos, { align: "right" });

    doc.save(`${invoice.invoiceNumber}.pdf`);
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span>Invoice Preview - {invoice.invoiceNumber}</span>
              {invoice.paid ? (
                <Badge variant="default" className="bg-green-500">Paid</Badge>
              ) : (
                <Badge variant="outline">Unpaid</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleMarkAsPaid} variant="outline" size="sm">
                {invoice.paid ? (
                  <>
                    <Circle className="mr-2 h-4 w-4" />
                    Mark Unpaid
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark Paid
                  </>
                )}
              </Button>
              <Button onClick={handleDownload} size="sm">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto max-h-[70vh] bg-muted p-4 rounded-lg">
          <div className="bg-white p-8 max-w-[210mm] mx-auto shadow-lg" style={{ minHeight: '297mm' }}>
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">TRUE ATTACHMENTS</h1>
              <p className="text-sm">3045 E Chestnut Expy Ste K</p>
              <p className="text-sm">Springfield, MO 65802</p>
              <p className="text-sm">Info@TrueAttachments.com</p>
              <p className="text-sm">417-306-9612</p>
            </div>

            {/* Date and Invoice Number */}
            <div className="flex justify-end gap-8 mb-8">
              <div>
                <p className="font-bold">DATE</p>
                <p>{new Date(invoice.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="font-bold">Invoice</p>
                <p>{invoice.invoiceNumber}</p>
              </div>
              {invoice.paid && (
                <div>
                  <p className="font-bold text-green-600">PAID</p>
                  {invoice.paidAt && (
                    <p className="text-sm">{new Date(invoice.paidAt).toLocaleDateString()}</p>
                  )}
                </div>
              )}
            </div>

            {/* Bill To and Ship To */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="font-bold mb-2">BILL TO</p>
                {invoice.customerName && <p>{invoice.customerName}</p>}
                {invoice.customerEmail && <p>{invoice.customerEmail}</p>}
                {invoice.customerPhone && <p>{invoice.customerPhone}</p>}
              </div>
              <div>
                <p className="font-bold mb-2">SHIP TO</p>
                {invoice.customerName && <p>{invoice.customerName}</p>}
                {invoice.shipToAddress && <p>{invoice.shipToAddress}</p>}
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-8 border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Item</th>
                  <th className="border p-2 text-left">Description</th>
                  <th className="border p-2 text-center">Qty</th>
                  <th className="border p-2 text-right">Rate</th>
                  <th className="border p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border p-2">{item.partNumber}</td>
                    <td className="border p-2">
                      {item.description}
                      {invoice.salesmanName && (
                        <div className="text-xs text-gray-400 mt-1">
                          Added by: {invoice.salesmanName}
                        </div>
                      )}
                    </td>
                    <td className="border p-2 text-center">1</td>
                    <td className="border p-2 text-right">${item.price.toFixed(2)}</td>
                    <td className="border p-2 text-right">${item.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary */}
            <div className="ml-auto w-64">
              <div className="flex justify-between py-1">
                <span>SUBTOTAL</span>
                <span>${invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>SHIPPING</span>
                <span>${invoice.shippingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>DISCOUNT</span>
                <span>${invoice.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>TAX</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 font-bold text-lg">
                <span>TOTAL</span>
                <span>${invoice.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};