import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, FileText, Download, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getVendors, addVendor, addPurchaseOrder, addPOItems, type Vendor } from "@/lib/po-storage";
import jsPDF from "jspdf";

interface IssuePODialogProps {
  onPOCreated: () => void;
}

interface POLineItem {
  id: string;
  partNumber: string;
  serialNumber: string;
  description: string;
  quantity: number;
  unitCost: number;
}

interface AdditionalCost {
  id: string;
  description: string;
  amount: number;
}

export const IssuePODialog = ({ onPOCreated }: IssuePODialogProps) => {
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [newVendorName, setNewVendorName] = useState("");
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [lineItems, setLineItems] = useState<POLineItem[]>([createEmptyLineItem()]);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);
  const [notes, setNotes] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [createdPO, setCreatedPO] = useState<{
    poNumber: string;
    vendorName: string;
    items: POLineItem[];
    additionalCosts: AdditionalCost[];
    subtotal: number;
    additionalTotal: number;
    total: number;
    notes: string;
    createdAt: string;
  } | null>(null);
  const { toast } = useToast();

  function createEmptyLineItem(): POLineItem {
    return {
      id: crypto.randomUUID(),
      partNumber: "",
      serialNumber: "",
      description: "",
      quantity: 1,
      unitCost: 0,
    };
  }

  function createEmptyAdditionalCost(): AdditionalCost {
    return {
      id: crypto.randomUUID(),
      description: "",
      amount: 0,
    };
  }

  useEffect(() => {
    if (open) {
      loadVendors();
    }
  }, [open]);

  const loadVendors = async () => {
    try {
      const data = await getVendors();
      setVendors(data);
    } catch (error) {
      console.error("Error loading vendors:", error);
    }
  };

  const updateLineItem = (id: string, field: keyof POLineItem, value: string | number) => {
    setLineItems(items =>
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(items => items.filter(item => item.id !== id));
    }
  };

  const addLineItem = () => {
    setLineItems(items => [...items, createEmptyLineItem()]);
  };

  const updateAdditionalCost = (id: string, field: keyof AdditionalCost, value: string | number) => {
    setAdditionalCosts(costs =>
      costs.map(cost =>
        cost.id === id ? { ...cost, [field]: value } : cost
      )
    );
  };

  const removeAdditionalCost = (id: string) => {
    setAdditionalCosts(costs => costs.filter(cost => cost.id !== id));
  };

  const addAdditionalCost = () => {
    setAdditionalCosts(costs => [...costs, createEmptyAdditionalCost()]);
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
  };

  const calculateAdditionalTotal = () => {
    return additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateAdditionalTotal();
  };

  const validateForm = () => {
    if (!selectedVendor && !newVendorName.trim()) {
      toast({
        title: "Error",
        description: "Please select or create a vendor",
        variant: "destructive",
      });
      return false;
    }

    const validItems = lineItems.filter(item => 
      item.partNumber.trim() && item.description.trim() && item.quantity > 0
    );

    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one valid line item with part number, description, and quantity",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleIssuePO = async () => {
    if (!validateForm()) return;

    let vendorId = selectedVendor;
    let vendorName = "";

    if (showNewVendor) {
      try {
        const newVendor = await addVendor({ name: newVendorName.trim() });
        vendorId = newVendor.id;
        vendorName = newVendor.name;
      } catch (error) {
        console.error("Error creating vendor:", error);
        toast({
          title: "Error",
          description: "Failed to create vendor",
          variant: "destructive",
        });
        return;
      }
    } else {
      const vendor = vendors.find(v => v.id === vendorId);
      vendorName = vendor?.name || "";
    }

    try {
      const validItems = lineItems.filter(item => 
        item.partNumber.trim() && item.description.trim() && item.quantity > 0
      );

      const subtotal = calculateSubtotal();
      const additionalTotal = calculateAdditionalTotal();
      const total = calculateTotal();
      const poNumber = `PO-${Date.now()}`;

      const po = await addPurchaseOrder({
        poNumber,
        vendorId,
        vendorName,
        status: 'pending',
        subtotal,
        shipping: additionalTotal,
        tax: 0,
        total,
        items: validItems.map(item => ({
          partNumber: item.partNumber,
          serialNumber: item.serialNumber || undefined,
          description: item.description,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.quantity * item.unitCost,
        })),
        notes: notes + (additionalCosts.length > 0 ? `\n\nAdditional Costs:\n${additionalCosts.map(c => `${c.description}: $${c.amount.toFixed(2)}`).join('\n')}` : ''),
      });

      await addPOItems(validItems.map(item => ({
        poId: po.id,
        partNumber: item.partNumber,
        serialNumber: item.serialNumber || undefined,
        description: item.description,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.quantity * item.unitCost,
        receivedQuantity: 0,
      })));

      setCreatedPO({
        poNumber,
        vendorName,
        items: validItems,
        additionalCosts: [...additionalCosts],
        subtotal,
        additionalTotal,
        total,
        notes,
        createdAt: new Date().toISOString(),
      });

      setShowPreview(true);

      toast({
        title: "Success",
        description: `Purchase Order ${poNumber} created`,
      });

      onPOCreated();
    } catch (error) {
      console.error("Error creating PO:", error);
      toast({
        title: "Error",
        description: "Failed to create purchase order",
        variant: "destructive",
      });
    }
  };

  const generatePDF = () => {
    if (!createdPO) return null;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PURCHASE ORDER", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("TRUE ATTACHMENTS", pageWidth / 2, 28, { align: "center" });
    doc.text("3045 E Chestnut Expy Ste K", pageWidth / 2, 33, { align: "center" });
    doc.text("Springfield, MO 65802", pageWidth / 2, 38, { align: "center" });

    // PO Number and Date
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PO Number:", 20, 50);
    doc.text("Date:", 20, 57);
    doc.text("Vendor:", 20, 64);
    
    doc.setFont("helvetica", "normal");
    doc.text(createdPO.poNumber, 55, 50);
    doc.text(new Date(createdPO.createdAt).toLocaleDateString(), 55, 57);
    doc.text(createdPO.vendorName, 55, 64);

    // Items Table Header
    let yPos = 80;
    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos - 5, 170, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Part #", 22, yPos);
    doc.text("Serial #", 45, yPos);
    doc.text("Description", 70, yPos);
    doc.text("Qty", 125, yPos);
    doc.text("Unit Cost", 140, yPos);
    doc.text("Total", 165, yPos);

    yPos += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    // Items
    createdPO.items.forEach((item) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.text(item.partNumber.substring(0, 12), 22, yPos);
      doc.text((item.serialNumber || "-").substring(0, 12), 45, yPos);
      const desc = doc.splitTextToSize(item.description, 50);
      doc.text(desc[0], 70, yPos);
      doc.text(String(item.quantity), 125, yPos);
      doc.text(`$${item.unitCost.toFixed(2)}`, 140, yPos);
      doc.text(`$${(item.quantity * item.unitCost).toFixed(2)}`, 165, yPos);

      yPos += 7;
    });

    // Additional Costs
    if (createdPO.additionalCosts.length > 0) {
      yPos += 5;
      doc.setFont("helvetica", "bold");
      doc.text("Additional Costs:", 22, yPos);
      yPos += 6;
      doc.setFont("helvetica", "normal");

      createdPO.additionalCosts.forEach((cost) => {
        doc.text(cost.description, 22, yPos);
        doc.text(`$${cost.amount.toFixed(2)}`, 165, yPos);
        yPos += 6;
      });
    }

    // Summary
    yPos += 10;
    doc.line(120, yPos - 3, 190, yPos - 3);
    
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", 140, yPos);
    doc.text(`$${createdPO.subtotal.toFixed(2)}`, 175, yPos, { align: "right" });
    
    if (createdPO.additionalTotal > 0) {
      yPos += 6;
      doc.text("Additional:", 140, yPos);
      doc.text(`$${createdPO.additionalTotal.toFixed(2)}`, 175, yPos, { align: "right" });
    }

    yPos += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("TOTAL:", 140, yPos);
    doc.text(`$${createdPO.total.toFixed(2)}`, 175, yPos, { align: "right" });

    // Notes
    if (createdPO.notes) {
      yPos += 15;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", 22, yPos);
      doc.setFont("helvetica", "normal");
      const noteLines = doc.splitTextToSize(createdPO.notes, 160);
      doc.text(noteLines, 22, yPos + 5);
    }

    return doc;
  };

  const handleDownloadPDF = () => {
    const doc = generatePDF();
    if (doc && createdPO) {
      doc.save(`${createdPO.poNumber}.pdf`);
    }
  };

  const handlePrintPDF = () => {
    const doc = generatePDF();
    if (doc) {
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  const resetForm = () => {
    setLineItems([createEmptyLineItem()]);
    setAdditionalCosts([]);
    setSelectedVendor("");
    setNewVendorName("");
    setShowNewVendor(false);
    setNotes("");
    setShowPreview(false);
    setCreatedPO(null);
  };

  const subtotal = calculateSubtotal();
  const additionalTotal = calculateAdditionalTotal();
  const total = calculateTotal();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetForm();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Issue PO
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {showPreview ? `Purchase Order Preview - ${createdPO?.poNumber}` : "Issue Purchase Order"}
          </DialogTitle>
        </DialogHeader>

        {showPreview && createdPO ? (
          // PDF Preview Mode
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-2 mb-4">
              <Button onClick={handleDownloadPDF}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
              <Button variant="outline" onClick={handlePrintPDF}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" onClick={() => {
                resetForm();
                setOpen(false);
              }}>
                Close
              </Button>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="bg-muted p-4 rounded-lg">
                <div className="bg-white p-8 max-w-[210mm] mx-auto shadow-lg" style={{ minHeight: '297mm' }}>
                  {/* Preview Header */}
                  <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold mb-2">PURCHASE ORDER</h1>
                    <p className="text-sm font-semibold">TRUE ATTACHMENTS</p>
                    <p className="text-sm">3045 E Chestnut Expy Ste K</p>
                    <p className="text-sm">Springfield, MO 65802</p>
                  </div>

                  {/* PO Info */}
                  <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                      <p><strong>PO Number:</strong> {createdPO.poNumber}</p>
                      <p><strong>Date:</strong> {new Date(createdPO.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p><strong>Vendor:</strong> {createdPO.vendorName}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="w-full mb-8 border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 text-left">Part #</th>
                        <th className="border p-2 text-left">Serial #</th>
                        <th className="border p-2 text-left">Description</th>
                        <th className="border p-2 text-center">Qty</th>
                        <th className="border p-2 text-right">Unit Cost</th>
                        <th className="border p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {createdPO.items.map((item) => (
                        <tr key={item.id}>
                          <td className="border p-2">{item.partNumber}</td>
                          <td className="border p-2">{item.serialNumber || "-"}</td>
                          <td className="border p-2">{item.description}</td>
                          <td className="border p-2 text-center">{item.quantity}</td>
                          <td className="border p-2 text-right">${item.unitCost.toFixed(2)}</td>
                          <td className="border p-2 text-right">${(item.quantity * item.unitCost).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Additional Costs */}
                  {createdPO.additionalCosts.length > 0 && (
                    <div className="mb-8">
                      <h3 className="font-bold mb-2">Additional Costs</h3>
                      <table className="w-full border-collapse text-sm">
                        <tbody>
                          {createdPO.additionalCosts.map((cost) => (
                            <tr key={cost.id}>
                              <td className="border p-2">{cost.description}</td>
                              <td className="border p-2 text-right w-32">${cost.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="ml-auto w-64">
                    <div className="flex justify-between py-1">
                      <span>Subtotal:</span>
                      <span>${createdPO.subtotal.toFixed(2)}</span>
                    </div>
                    {createdPO.additionalTotal > 0 && (
                      <div className="flex justify-between py-1">
                        <span>Additional Costs:</span>
                        <span>${createdPO.additionalTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-t-2 font-bold text-lg">
                      <span>TOTAL:</span>
                      <span>${createdPO.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  {createdPO.notes && (
                    <div className="mt-8 pt-4 border-t">
                      <p className="font-bold">Notes:</p>
                      <p className="whitespace-pre-wrap text-sm">{createdPO.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        ) : (
          // Form Entry Mode
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Vendor Selection */}
            <div className="space-y-2">
              <Label>Vendor *</Label>
              {!showNewVendor ? (
                <div className="flex gap-2">
                  <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map(vendor => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={() => setShowNewVendor(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="New vendor name"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="default" 
                    onClick={async () => {
                      if (!newVendorName.trim()) {
                        toast({
                          title: "Error",
                          description: "Please enter a vendor name",
                          variant: "destructive",
                        });
                        return;
                      }
                      try {
                        const newVendor = await addVendor({ name: newVendorName.trim() });
                        await loadVendors();
                        setSelectedVendor(newVendor.id);
                        setNewVendorName("");
                        setShowNewVendor(false);
                        toast({
                          title: "Success",
                          description: `Vendor "${newVendor.name}" created`,
                        });
                      } catch (error) {
                        console.error("Error creating vendor:", error);
                        toast({
                          title: "Error",
                          description: "Failed to create vendor",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button type="button" variant="outline" onClick={() => {
                    setShowNewVendor(false);
                    setNewVendorName("");
                  }}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <Label>Line Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                    <div className="col-span-2">Part Number *</div>
                    <div className="col-span-2">Serial Number</div>
                    <div className="col-span-3">Description *</div>
                    <div className="col-span-1">Qty *</div>
                    <div className="col-span-2">Unit Cost</div>
                    <div className="col-span-1">Total</div>
                    <div className="col-span-1"></div>
                  </div>
                  
                  {lineItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-2"
                        placeholder="PN-001"
                        value={item.partNumber}
                        onChange={(e) => updateLineItem(item.id, 'partNumber', e.target.value)}
                      />
                      <Input
                        className="col-span-2"
                        placeholder="SN-001"
                        value={item.serialNumber}
                        onChange={(e) => updateLineItem(item.id, 'serialNumber', e.target.value)}
                      />
                      <Input
                        className="col-span-3"
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      />
                      <Input
                        className="col-span-1"
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                      />
                      <Input
                        className="col-span-2"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.unitCost || ''}
                        onChange={(e) => updateLineItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                      />
                      <div className="col-span-1 text-sm font-medium">
                        ${(item.quantity * item.unitCost).toFixed(2)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="col-span-1"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Additional Costs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Additional Costs (Shipping, Handling, etc.)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addAdditionalCost}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Cost
                </Button>
              </div>
              
              {additionalCosts.length > 0 && (
                <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  {additionalCosts.map((cost) => (
                    <div key={cost.id} className="flex gap-2 items-center">
                      <Input
                        className="flex-1"
                        placeholder="Description (e.g., Shipping, Handling)"
                        value={cost.description}
                        onChange={(e) => updateAdditionalCost(cost.id, 'description', e.target.value)}
                      />
                      <Input
                        className="w-32"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={cost.amount || ''}
                        onChange={(e) => updateAdditionalCost(cost.id, 'amount', parseFloat(e.target.value) || 0)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAdditionalCost(cost.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes for this purchase order..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Totals */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
              <div className="flex justify-between items-center">
                <span>Subtotal:</span>
                <span className="text-lg">${subtotal.toFixed(2)}</span>
              </div>
              {additionalTotal > 0 && (
                <div className="flex justify-between items-center">
                  <span>Additional Costs:</span>
                  <span className="text-lg">${additionalTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-bold text-lg">Total:</span>
                <span className="text-2xl font-bold">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleIssuePO}>
                <FileText className="mr-2 h-4 w-4" />
                Issue PO
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
