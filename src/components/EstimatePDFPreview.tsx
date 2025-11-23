import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Estimate } from "@/lib/inventory-storage";
import jsPDF from "jspdf";
import { Download } from "lucide-react";

interface EstimatePDFPreviewProps {
  estimate: Estimate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EstimatePDFPreview = ({ estimate, open, onOpenChange }: EstimatePDFPreviewProps) => {

  const handleDownload = () => {
    if (!estimate) return;
    
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

    // Date and Estimate Number
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DATE", 140, 20);
    doc.text("Sales Order", 165, 20);
    
    doc.setFont("helvetica", "normal");
    doc.text(new Date(estimate.createdAt).toLocaleDateString(), 140, 26);
    doc.text(estimate.estimateNumber, 165, 26);

    // Bill To and Ship To
    let yPos = 55;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO", 20, yPos);
    doc.text("SHIP TO", 110, yPos);
    
    yPos += 5;
    doc.setFont("helvetica", "normal");
    if (estimate.customerName) {
      doc.text(estimate.customerName, 20, yPos);
      doc.text(estimate.customerName, 110, yPos);
      yPos += 5;
    }
    if (estimate.customerEmail) {
      doc.text(estimate.customerEmail, 20, yPos);
      yPos += 5;
    }
    if (estimate.customerPhone) {
      doc.text(estimate.customerPhone, 20, yPos);
      yPos += 5;
    }
    
    // Ship To Address
    let shipYPos = 65;
    if (estimate.customerName) shipYPos += 5;
    if (estimate.shipToAddress) {
      const addressLines = estimate.shipToAddress.split('\n');
      addressLines.forEach((line, i) => {
        doc.text(line.trim(), 110, shipYPos + (i * 5));
      });
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
    estimate.items.forEach((item) => {
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
    });

    // Summary
    yPos += 10;
    const summaryX = 140;
    doc.setFont("helvetica", "normal");
    
    doc.text("SUBTOTAL", summaryX, yPos);
    doc.text(`$${estimate.subtotal.toFixed(2)}`, 175, yPos, { align: "right" });
    yPos += 6;
    
    doc.text("SHIPPING", summaryX, yPos);
    doc.text(`$${estimate.shippingCost.toFixed(2)}`, 175, yPos, { align: "right" });
    yPos += 6;
    
    doc.text("DISCOUNT", summaryX, yPos);
    doc.text(`$${estimate.discount.toFixed(2)}`, 175, yPos, { align: "right" });
    yPos += 6;
    
    doc.text("TAX", summaryX, yPos);
    doc.text("$0.00", 175, yPos, { align: "right" });
    yPos += 8;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL", summaryX, yPos);
    doc.text(`$${estimate.total.toFixed(2)}`, 175, yPos, { align: "right" });

    doc.save(`${estimate.estimateNumber}.pdf`);
  };

  if (!estimate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Estimate Preview - {estimate.estimateNumber}</span>
            <Button onClick={handleDownload} size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
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

            {/* Date and Estimate Number */}
            <div className="flex justify-end gap-8 mb-8">
              <div>
                <p className="font-bold">DATE</p>
                <p>{new Date(estimate.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="font-bold">Sales Order</p>
                <p>{estimate.estimateNumber}</p>
              </div>
            </div>

            {/* Bill To and Ship To */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="font-bold mb-2">BILL TO</p>
                {estimate.customerName && <p>{estimate.customerName}</p>}
                {estimate.customerEmail && <p>{estimate.customerEmail}</p>}
                {estimate.customerPhone && <p>{estimate.customerPhone}</p>}
              </div>
              <div>
                <p className="font-bold mb-2">SHIP TO</p>
                {estimate.customerName && <p>{estimate.customerName}</p>}
                {estimate.shipToAddress && <p>{estimate.shipToAddress}</p>}
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
                {estimate.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border p-2">{item.partNumber}</td>
                    <td className="border p-2">{item.description}</td>
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
                <span>${estimate.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>SHIPPING</span>
                <span>${estimate.shippingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>DISCOUNT</span>
                <span>${estimate.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>TAX</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 font-bold text-lg">
                <span>TOTAL</span>
                <span>${estimate.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
