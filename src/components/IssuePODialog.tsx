import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Download, CheckCircle2, XCircle, AlertCircle, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getVendors, addVendor, addPurchaseOrder, addPOItems, type Vendor } from "@/lib/po-storage";

interface IssuePODialogProps {
  onPOCreated: () => void;
}

interface ParsedPOItem {
  partNumber: string;
  serialNumber?: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  valid: boolean;
  errors: string[];
}

export const IssuePODialog = ({ onPOCreated }: IssuePODialogProps) => {
  const [open, setOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [newVendorName, setNewVendorName] = useState("");
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedPOItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shipping, setShipping] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const { toast } = useToast();

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

  const downloadTemplate = () => {
    const template = [
      {
        PartNumber: "PN-001",
        SerialNumber: "SN-001",
        Description: "Sample Item 1",
        Quantity: 10,
        UnitCost: 99.99,
      },
      {
        PartNumber: "PN-002",
        SerialNumber: "SN-002",
        Description: "Sample Item 2",
        Quantity: 5,
        UnitCost: 149.50,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PO Items");
    XLSX.writeFile(wb, "po_template.xlsx");

    toast({
      title: "Template Downloaded",
      description: "Use this template to prepare your PO items",
    });
  };

  const validateItem = (item: Record<string, unknown>): ParsedPOItem => {
    const errors: string[] = [];
    
    const partNumber = String(item.PartNumber || item.partNumber || item["Part Number"] || "").trim();
    const serialNumber = String(item.SerialNumber || item.serialNumber || item["Serial Number"] || "").trim();
    const description = String(item.Description || item.description || "").trim();
    const quantity = parseInt(String(item.Quantity || item.quantity || "0"));
    const unitCost = parseFloat(String(item.UnitCost || item.unitCost || item["Unit Cost"] || "0"));
    const totalCost = quantity * unitCost;

    if (!partNumber) errors.push("Missing part number");
    if (!description) errors.push("Missing description");
    if (isNaN(quantity) || quantity <= 0) errors.push("Invalid quantity");
    if (isNaN(unitCost) || unitCost < 0) errors.push("Invalid unit cost");

    return {
      partNumber,
      serialNumber: serialNumber || undefined,
      description,
      quantity,
      unitCost,
      totalCost,
      valid: errors.length === 0,
      errors,
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast({
          title: "Error",
          description: "The Excel file is empty",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const validated = jsonData.map((item) => validateItem(item));
      setParsedItems(validated);

      const validCount = validated.filter(item => item.valid).length;
      const invalidCount = validated.length - validCount;

      if (invalidCount > 0) {
        toast({
          title: "Validation Complete",
          description: `${validCount} valid items, ${invalidCount} items with errors`,
        });
      } else {
        toast({
          title: "Validation Complete",
          description: `All ${validCount} items are valid`,
        });
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      toast({
        title: "Error",
        description: "Failed to parse Excel file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const handleCreatePO = async () => {
    const validItems = parsedItems.filter(item => item.valid);
    
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "No valid items to add to PO",
        variant: "destructive",
      });
      return;
    }

    let vendorId = selectedVendor;
    let vendorName = "";

    if (showNewVendor) {
      if (!newVendorName.trim()) {
        toast({
          title: "Error",
          description: "Please enter vendor name",
          variant: "destructive",
        });
        return;
      }
      
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
      if (!vendorId) {
        toast({
          title: "Error",
          description: "Please select a vendor",
          variant: "destructive",
        });
        return;
      }
      const vendor = vendors.find(v => v.id === vendorId);
      vendorName = vendor?.name || "";
    }

    try {
      const subtotal = validItems.reduce((sum, item) => sum + item.totalCost, 0);
      const total = subtotal + shipping + tax;
      const poNumber = `PO-${Date.now()}`;

      const po = await addPurchaseOrder({
        poNumber,
        vendorId,
        vendorName,
        status: 'pending',
        subtotal,
        shipping,
        tax,
        total,
        items: validItems,
      });

      await addPOItems(validItems.map(item => ({
        poId: po.id,
        partNumber: item.partNumber,
        serialNumber: item.serialNumber,
        description: item.description,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        receivedQuantity: 0,
      })));

      toast({
        title: "Success",
        description: `Purchase Order ${poNumber} created`,
      });

      setParsedItems([]);
      setSelectedVendor("");
      setNewVendorName("");
      setShowNewVendor(false);
      setShipping(0);
      setTax(0);
      setOpen(false);
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

  const validCount = parsedItems.filter(item => item.valid).length;
  const invalidCount = parsedItems.length - validCount;
  const subtotal = parsedItems.filter(item => item.valid).reduce((sum, item) => sum + item.totalCost, 0);
  const total = subtotal + shipping + tax;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setParsedItems([]);
        setSelectedVendor("");
        setNewVendorName("");
        setShowNewVendor(false);
        setShipping(0);
        setTax(0);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Issue PO
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Issue Purchase Order</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Upload Excel with: <strong>PartNumber</strong>, <strong>Description</strong>, <strong>Quantity</strong>, <strong>UnitCost</strong> (required) + SerialNumber (optional)
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Vendor</Label>
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
                <Button type="button" variant="outline" onClick={() => setShowNewVendor(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            
            <Label htmlFor="po-file-upload" className="flex-1">
              <div className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground">
                <Upload className="mr-2 h-4 w-4" />
                {isProcessing ? "Processing..." : "Choose Excel File"}
              </div>
              <input
                id="po-file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="sr-only"
              />
            </Label>
          </div>

          {parsedItems.length > 0 && (
            <>
              <div className="flex gap-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm">
                    <strong>{validCount}</strong> Valid
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm">
                    <strong>{invalidCount}</strong> Invalid
                  </span>
                </div>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-4 space-y-2">
                  {parsedItems.map((item, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg ${
                        item.valid ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{item.partNumber || "(missing)"}</span>
                            <Badge variant={item.valid ? "default" : "destructive"}>
                              {item.valid ? "Valid" : "Invalid"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {item.description || "(missing)"}
                          </p>
                          <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                            <span>Qty: {item.quantity}</span>
                            <span>Unit: ${item.unitCost.toFixed(2)}</span>
                            <span>Total: ${item.totalCost.toFixed(2)}</span>
                          </div>
                          {item.errors.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.errors.map((error, errorIndex) => (
                                <p key={errorIndex} className="text-xs text-destructive flex items-center gap-1">
                                  <XCircle className="h-3 w-3" />
                                  {error}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="shipping">Shipping</Label>
                    <Input
                      id="shipping"
                      type="number"
                      min="0"
                      step="0.01"
                      value={shipping}
                      onChange={(e) => setShipping(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tax">Tax</Label>
                    <Input
                      id="tax"
                      type="number"
                      min="0"
                      step="0.01"
                      value={tax}
                      onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold">Subtotal:</span>
                  <span className="text-lg">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-bold text-lg">Total:</span>
                  <span className="text-2xl font-bold">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setParsedItems([])}
                >
                  Clear
                </Button>
                <Button
                  onClick={handleCreatePO}
                  disabled={validCount === 0}
                >
                  Create PO
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
