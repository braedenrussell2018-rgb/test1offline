import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Download, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { inventoryStorage } from "@/lib/inventory-storage";
import { createAndDownloadExcel, readExcelFile, createTemplate } from "@/lib/excel-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BulkUploadDialogProps {
  onItemsAdded: () => void;
}

interface ParsedItem {
  partNumber: string;
  description: string;
  quantity: number;
  salePrice: number;
  cost: number;
  weight: number;
  isValid: boolean;
  errors: string[];
}

export const BulkUploadDialog = ({ onItemsAdded }: BulkUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    const template = [
      {
        "#": 1,
        "Name": "EXAMPLE-PART-001",
        "Description": "Example part description",
        "In Stock": 5,
        "Sales Price": 99.99,
        "Weight": 10.5,
      },
      {
        "#": 2,
        "Name": "EXAMPLE-PART-002",
        "Description": "Another example part",
        "In Stock": 3,
        "Sales Price": 149.99,
        "Weight": 25.0,
      },
    ];

    await createTemplate(
      template, 
      "Items", 
      "inventory_template.xlsx",
      [5, 25, 50, 10, 12, 10]  // Column widths
    );
    toast.success("Template downloaded");
  };

  const exportInventory = async () => {
    setIsExporting(true);
    try {
      const items = await inventoryStorage.getItems();
      const availableItems = items.filter(item => item.status === 'available');

      // Group items by part number and count quantities
      const groupedItems = availableItems.reduce((acc, item) => {
        const key = item.partNumber;
        if (!acc[key]) {
          acc[key] = {
            partNumber: item.partNumber,
            description: item.description,
            quantity: 0,
            salePrice: item.salePrice || 0,
            weight: item.weight || 0,
          };
        }
        acc[key].quantity += 1;
        return acc;
      }, {} as Record<string, { partNumber: string; description: string; quantity: number; salePrice: number; weight: number }>);

      const exportData = Object.values(groupedItems).map((item, index) => ({
        "#": index + 1,
        "Name": item.partNumber,
        "Description": item.description,
        "In Stock": item.quantity,
        "Sales Price": item.salePrice,
        "Weight": item.weight,
      }));

      if (exportData.length === 0) {
        toast.error("No available items to export");
        setIsExporting(false);
        return;
      }

      const date = new Date().toISOString().split('T')[0];
      await createAndDownloadExcel(
        exportData,
        "Items",
        `inventory_export_${date}.xlsx`,
        [5, 30, 60, 10, 12, 10]  // Column widths
      );
      toast.success(`Exported ${exportData.length} items`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export inventory");
    } finally {
      setIsExporting(false);
    }
  };

  const validateItem = (item: ParsedItem, existingPartNumbers: Set<string>): ParsedItem => {
    const errors: string[] = [];

    if (!item.partNumber || item.partNumber.trim() === "") {
      errors.push("Part number is required");
    }
    if (!item.description || item.description.trim() === "") {
      errors.push("Description is required");
    }
    if (item.quantity < 0) {
      errors.push("Quantity cannot be negative");
    }
    if (item.salePrice < 0) {
      errors.push("Sale price cannot be negative");
    }

    // Check for duplicates in existing inventory (only warn, don't block)
    if (existingPartNumbers.has(item.partNumber)) {
      errors.push("Part number already exists (will add to existing)");
    }

    return {
      ...item,
      isValid: errors.filter(e => !e.includes("already exists")).length === 0,
      errors,
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const jsonData = await readExcelFile(file);

      if (jsonData.length === 0) {
        toast.error("The Excel file is empty");
        setIsProcessing(false);
        return;
      }

      // Get existing part numbers
      const existingItems = await inventoryStorage.getItems();
      const existingPartNumbers = new Set(existingItems.map(i => i.partNumber));

      const items: ParsedItem[] = [];
      for (const row of jsonData as Record<string, unknown>[]) {
        // Support multiple formats: external inventory (Name, Description, Total), 
        // internal format (Name, In Stock, Sales Price), and legacy formats
        const partNumber = String(row["Name"] || row["PartNumber"] || row["partNumber"] || row["Part Number"] || "").trim();
        const description = String(row["Description"] || row["description"] || "").trim();
        // Support "Total" column from external inventory systems, "In Stock", and other quantity column names
        const quantity = Number(row["Total"] || row["In Stock"] || row["Quantity"] || row["quantity"] || row["Qty"] || row["Stock"] || 1) || 1;
        const salePrice = Number(row["Sales Price"] || row["SalePrice"] || row["salePrice"] || row["Sale Price"] || 0) || 0;
        const cost = Number(row["Purch Price"] || row["Cost"] || row["cost"] || row["Purchase Price"] || 0) || 0;
        const weight = Number(row["Weight"] || row["weight"] || 0) || 0;

        const item: ParsedItem = {
          partNumber,
          description,
          quantity,
          salePrice,
          cost,
          weight,
          isValid: true,
          errors: [],
        };

        const validatedItem = validateItem(item, existingPartNumbers);
        items.push(validatedItem);
      }

      setParsedItems(items);

      const validCount = items.filter(item => item.isValid).length;
      const totalQuantity = items.filter(i => i.isValid).reduce((sum, i) => sum + i.quantity, 0);
      toast.success(`Parsed ${items.length} products (${totalQuantity} total items)`);
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Failed to parse Excel file. Please check the format.");
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const handleImport = async () => {
    const validItems = parsedItems.filter(item => item.isValid && item.quantity > 0);
    
    if (validItems.length === 0) {
      toast.error("No valid items with stock to import");
      return;
    }

    setIsProcessing(true);
    try {
      let totalItemsCreated = 0;
      
      for (const item of validItems) {
        // Create one inventory item per quantity
        for (let i = 0; i < item.quantity; i++) {
          await inventoryStorage.addItem({
            partNumber: item.partNumber,
            description: item.description,
            salePrice: item.salePrice,
            cost: item.cost,
            weight: item.weight || undefined,
            status: 'available',
          });
          totalItemsCreated++;
        }
      }

      toast.success(`Imported ${totalItemsCreated} items from ${validItems.length} products`);
      setParsedItems([]);
      setOpen(false);
      onItemsAdded();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import items");
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedItems.filter(item => item.isValid).length;
  const invalidCount = parsedItems.length - validCount;
  const totalQuantity = parsedItems.filter(i => i.isValid).reduce((sum, i) => sum + i.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setParsedItems([]);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Import/Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import/Export Inventory</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="import" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4 flex-1 overflow-hidden flex flex-col mt-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Upload Excel with columns: <strong>Name</strong> (part number), <strong>Description</strong>, <strong>Total</strong> or <strong>In Stock</strong> (quantity). Optional: <strong>Sales Price</strong>, <strong>Weight</strong>
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
                  ref={fileInputRef}
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
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      <strong>{validCount}</strong> Valid ({totalQuantity} items)
                    </span>
                  </div>
                  {invalidCount > 0 && (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm">
                        <strong>{invalidCount}</strong> Invalid
                      </span>
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1 border rounded-lg">
                  <div className="p-4 space-y-2">
                    {parsedItems.map((item, index) => (
                      <div
                        key={index}
                        className={`p-3 border rounded-lg ${
                          item.isValid ? 'bg-green-500/5 border-green-500/20' : 'bg-destructive/5 border-destructive/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{item.partNumber || "(missing)"}</span>
                              {item.isValid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {item.description || "(missing)"}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                Qty: {item.quantity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                ${item.salePrice.toFixed(2)}
                              </Badge>
                              {item.weight > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {item.weight} lbs
                                </Badge>
                              )}
                            </div>
                            {item.errors.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {item.errors.map((error, errorIndex) => (
                                  <p key={errorIndex} className="text-xs text-amber-600 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
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
                    disabled={isProcessing}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={validCount === 0 || isProcessing}
                  >
                    {isProcessing ? "Importing..." : `Import ${totalQuantity} Items`}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="text-center py-8">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-medium">Export Current Inventory</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Download all available inventory items as an Excel file
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Items are grouped by part number with quantities
              </p>
            </div>

            <Button
              onClick={exportInventory}
              disabled={isExporting}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export Inventory"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
