import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Download, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage } from "@/lib/inventory-storage";
import * as XLSX from "xlsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BulkUploadDialogProps {
  onItemsAdded: () => void;
}

interface ParsedItem {
  partNumber: string;
  serialNumber?: string;
  description: string;
  salePrice: number;
  cost: number;
  weight?: number;
  volume?: number;
  warranty?: string;
  minReorderLevel?: number;
  maxReorderLevel?: number;
  valid: boolean;
  errors: string[];
}

export const BulkUploadDialog = ({ onItemsAdded }: BulkUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const template = [
      {
        PartNumber: "PN-001",
        SerialNumber: "SN-001",
        Description: "Sample Item 1",
        SalePrice: 149.99,
        Cost: 99.99,
        Weight: 5.5,
        Volume: 2.3,
        Warranty: "1 year",
        MinReorderLevel: 10,
        MaxReorderLevel: 100,
      },
      {
        PartNumber: "PN-002",
        SerialNumber: "SN-002",
        Description: "Sample Item 2",
        SalePrice: 199.99,
        Cost: 149.50,
        Weight: 3.2,
        Volume: 1.5,
        Warranty: "90 days",
        MinReorderLevel: 5,
        MaxReorderLevel: 50,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "inventory_template.xlsx");

    toast({
      title: "Template Downloaded",
      description: "Use this template to prepare your inventory data",
    });
  };

  const validateItem = (item: any): ParsedItem => {
    const errors: string[] = [];
    
    const partNumber = String(item.PartNumber || item.partNumber || item["Part Number"] || "").trim();
    const serialNumber = String(item.SerialNumber || item.serialNumber || item["Serial Number"] || "").trim();
    const description = String(item.Description || item.description || "").trim();
    const salePrice = parseFloat(String(item.SalePrice || item.salePrice || item["Sale Price"] || "0"));
    const cost = parseFloat(String(item.Cost || item.cost || "0"));
    const weight = item.Weight || item.weight ? parseFloat(String(item.Weight || item.weight)) : undefined;
    const volume = item.Volume || item.volume ? parseFloat(String(item.Volume || item.volume)) : undefined;
    const warranty = String(item.Warranty || item.warranty || "").trim();
    const minReorderLevel = item.MinReorderLevel || item.minReorderLevel || item["Min Reorder Level"] 
      ? parseInt(String(item.MinReorderLevel || item.minReorderLevel || item["Min Reorder Level"])) 
      : undefined;
    const maxReorderLevel = item.MaxReorderLevel || item.maxReorderLevel || item["Max Reorder Level"]
      ? parseInt(String(item.MaxReorderLevel || item.maxReorderLevel || item["Max Reorder Level"]))
      : undefined;

    if (!partNumber) {
      errors.push("Missing part number");
    }
    if (!description) {
      errors.push("Missing description");
    }
    if (isNaN(salePrice) || salePrice < 0) {
      errors.push("Invalid sale price");
    }
    if (isNaN(cost) || cost < 0) {
      errors.push("Invalid cost");
    }
    if (weight !== undefined && (isNaN(weight) || weight < 0)) {
      errors.push("Invalid weight");
    }
    if (volume !== undefined && (isNaN(volume) || volume < 0)) {
      errors.push("Invalid volume");
    }
    if (minReorderLevel !== undefined && (isNaN(minReorderLevel) || minReorderLevel < 0)) {
      errors.push("Invalid min reorder level");
    }
    if (maxReorderLevel !== undefined && (isNaN(maxReorderLevel) || maxReorderLevel < 0)) {
      errors.push("Invalid max reorder level");
    }

    // Check for duplicate part numbers in existing inventory
    const existingItems = inventoryStorage.getItems();
    if (partNumber && existingItems.some(i => i.partNumber === partNumber)) {
      errors.push("Part number already exists");
    }

    return {
      partNumber,
      serialNumber: serialNumber || undefined,
      description,
      salePrice,
      cost,
      weight,
      volume,
      warranty: warranty || undefined,
      minReorderLevel,
      maxReorderLevel,
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
          variant: "default",
        });
      } else {
        toast({
          title: "Validation Complete",
          description: `All ${validCount} items are valid and ready to import`,
        });
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      toast({
        title: "Error",
        description: "Failed to parse Excel file. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const handleImport = () => {
    const validItems = parsedItems.filter(item => item.valid);
    
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "No valid items to import",
        variant: "destructive",
      });
      return;
    }

    validItems.forEach(item => {
      inventoryStorage.addItem({
        partNumber: item.partNumber,
        serialNumber: item.serialNumber,
        description: item.description,
        salePrice: item.salePrice,
        cost: item.cost,
        weight: item.weight,
        volume: item.volume,
        warranty: item.warranty,
        minReorderLevel: item.minReorderLevel,
        maxReorderLevel: item.maxReorderLevel,
        status: 'available',
      });
    });

    toast({
      title: "Success",
      description: `Imported ${validItems.length} items to inventory`,
    });

    setParsedItems([]);
    setOpen(false);
    onItemsAdded();
  };

  const validCount = parsedItems.filter(item => item.valid).length;
  const invalidCount = parsedItems.length - validCount;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setParsedItems([]);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Upload Inventory</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Upload Excel with columns: <strong>PartNumber</strong>, <strong>Description</strong>, <strong>SalePrice</strong>, <strong>Cost</strong> (required) + SerialNumber, Weight, Volume, Warranty, MinReorderLevel, MaxReorderLevel (optional)
            </AlertDescription>
          </Alert>

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
            
            <Label htmlFor="file-upload" className="flex-1">
              <div className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground">
                <Upload className="mr-2 h-4 w-4" />
                {isProcessing ? "Processing..." : "Choose Excel File"}
              </div>
              <input
                id="file-upload"
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
                          <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                            <span>Sale: ${item.salePrice ? item.salePrice.toFixed(2) : "0.00"}</span>
                            <span>Cost: ${item.cost ? item.cost.toFixed(2) : "0.00"}</span>
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

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setParsedItems([])}
                >
                  Clear
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={validCount === 0}
                >
                  Import {validCount} {validCount === 1 ? 'Item' : 'Items'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
