import jsPDF from "jspdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Quote } from "@/lib/inventory-storage";

interface QuotePDFPreviewProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const QuotePDFPreview = ({ quote, open, onOpenChange }: QuotePDFPreviewProps) => {
  const generatePDF = () => {
    if (!quote) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("QUOTE", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Quote #: ${quote.quoteNumber}`, 20, 35);
    doc.text(`Date: ${new Date(quote.createdAt).toLocaleDateString()}`, 20, 40);
    
    // Customer Info
    if (quote.customerName) {
      doc.setFontSize(12);
      doc.text("Bill To:", 20, 55);
      doc.setFontSize(10);
      doc.text(quote.customerName, 20, 60);
      if (quote.customerEmail) doc.text(quote.customerEmail, 20, 65);
      if (quote.customerPhone) doc.text(quote.customerPhone, 20, 70);
    }
    
    // Ship To
    if (quote.shipToAddress) {
      doc.setFontSize(12);
      doc.text("Ship To:", 120, 55);
      doc.setFontSize(10);
      doc.text(quote.shipToAddress, 120, 60);
    }
    
    // Items Table
    let y = 90;
    doc.setFontSize(10);
    doc.text("Part Number", 20, y);
    doc.text("Description", 70, y);
    doc.text("Price", 170, y);
    
    y += 5;
    doc.line(20, y, 190, y);
    y += 7;
    
    quote.items.forEach((item: any) => {
      doc.text(item.partNumber, 20, y);
      const description = item.description.length > 40 ? item.description.substring(0, 40) + "..." : item.description;
      doc.text(description, 70, y);
      doc.text(`$${item.price.toFixed(2)}`, 170, y);
      y += 5;
      
      if (item.serialNumber) {
        doc.setFontSize(8);
        doc.text(`SN: ${item.serialNumber}`, 70, y);
        y += 5;
      }
      
      if (quote.salesmanName) {
        doc.setFontSize(7);
        doc.setTextColor(128, 128, 128);
        doc.text(`Added by: ${quote.salesmanName}`, 70, y);
        doc.setTextColor(0, 0, 0);
        y += 5;
      }
      
      doc.setFontSize(10);
      y += 2;
    });
    
    // Totals
    y += 5;
    doc.line(140, y, 190, y);
    y += 7;
    
    doc.text("Subtotal:", 140, y);
    doc.text(`$${quote.subtotal.toFixed(2)}`, 170, y);
    y += 7;
    
    if (quote.discount > 0) {
      doc.text("Discount:", 140, y);
      doc.text(`-$${quote.discount.toFixed(2)}`, 170, y);
      y += 7;
    }
    
    if (quote.shippingCost > 0) {
      doc.text("Shipping:", 140, y);
      doc.text(`$${quote.shippingCost.toFixed(2)}`, 170, y);
      y += 7;
    }
    
    doc.setFontSize(12);
    doc.text("Total:", 140, y);
    doc.text(`$${quote.total.toFixed(2)}`, 170, y);
    
    // Footer
    doc.setFontSize(8);
    doc.text("This quote is valid for 30 days from the date of issue.", 105, 280, { align: "center" });
    
    doc.save(`quote-${quote.quoteNumber}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quote Preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {quote && (
            <>
              <div className="border-b pb-4">
                <h3 className="font-semibold">Quote #{quote.quoteNumber}</h3>
                <p className="text-sm text-muted-foreground">
                  Date: {new Date(quote.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="space-y-3">
                {quote.customerName && (
                  <div>
                    <p className="text-sm font-semibold">Bill To:</p>
                    <p className="text-sm">{quote.customerName}</p>
                    {quote.customerEmail && <p className="text-sm">{quote.customerEmail}</p>}
                    {quote.customerPhone && <p className="text-sm">{quote.customerPhone}</p>}
                  </div>
                )}

                {quote.shipToAddress && (
                  <div>
                    <p className="text-sm font-semibold">Ship To:</p>
                    <p className="text-sm">{quote.shipToAddress}</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Items</h4>
                <div className="space-y-2">
                  {quote.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{item.partNumber}</p>
                        <p className="text-muted-foreground">{item.description}</p>
                        {item.serialNumber && (
                          <p className="text-xs text-muted-foreground">SN: {item.serialNumber}</p>
                        )}
                        {quote.salesmanName && (
                          <p className="text-xs text-gray-400">Added by: {quote.salesmanName}</p>
                        )}
                      </div>
                      <p className="font-medium">${item.price.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${quote.subtotal.toFixed(2)}</span>
                </div>
                {quote.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Discount:</span>
                    <span>-${quote.discount.toFixed(2)}</span>
                  </div>
                )}
                {quote.shippingCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Shipping:</span>
                    <span>${quote.shippingCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>${quote.total.toFixed(2)}</span>
                </div>
              </div>

              <Button onClick={generatePDF} className="w-full">
                Download PDF
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
