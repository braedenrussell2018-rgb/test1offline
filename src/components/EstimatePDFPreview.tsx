import { useEffect, useRef } from "react";
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (estimate && open && canvasRef.current) {
      generatePDFPreview(estimate);
    }
  }, [estimate, open]);

  const generatePDFPreview = (estimate: Estimate) => {
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
      doc.text(estimate.shipToAddress.street, 110, shipYPos);
      shipYPos += 5;
      doc.text(`${estimate.shipToAddress.city}, ${estimate.shipToAddress.state} ${estimate.shipToAddress.zip}`, 110, shipYPos);
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

    // Render to canvas
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imgData = doc.output('dataurlstring');
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
        };
        img.src = imgData;
      }
    }
  };

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
      doc.text(estimate.shipToAddress.street, 110, shipYPos);
      shipYPos += 5;
      doc.text(`${estimate.shipToAddress.city}, ${estimate.shipToAddress.state} ${estimate.shipToAddress.zip}`, 110, shipYPos);
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
          <canvas ref={canvasRef} className="w-full border bg-white" />
        </div>
      </DialogContent>
    </Dialog>
  );
};
