import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Download, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet, Pencil, X, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { inventoryStorage } from "@/lib/inventory-storage";
import { createAndDownloadExcel, readExcelFile, createTemplate } from "@/lib/excel-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

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

interface ImportProgress {
  current: number;
  total: number;
  currentProduct: string;
}

export const BulkUploadDialog = ({ onItemsAdded }: BulkUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ParsedItem | null>(null);
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
      [5, 25, 50, 10, 12, 10]
    );
    toast.success("Template downloaded");
  };

  const exportInventory = async () => {
    setIsExporting(true);
    try {
      const items = await inventoryStorage.getItems();
      const availableItems = items.filter(item => item.status === 'available');

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
        [5, 30, 60, 10, 12, 10]
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

      const existingItems = await inventoryStorage.getItems();
      const existingPartNumbers = new Set(existingItems.map(i => i.partNumber));

      const items: ParsedItem[] = [];
      for (const row of jsonData as Record<string, unknown>[]) {
        const partNumber = String(row["Name"] || row["PartNumber"] || row["partNumber"] || row["Part Number"] || "").trim();
        const description = String(row["Description"] || row["description"] || "").trim();
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

    const totalQuantity = validItems.reduce((sum, i) => sum + i.quantity, 0);

    setIsProcessing(true);
    setImportProgress({ current: 0, total: totalQuantity, currentProduct: "" });

    try {
      let totalItemsCreated = 0;
      
      for (const item of validItems) {
        setImportProgress(prev => prev ? { ...prev, currentProduct: item.partNumber } : null);
        
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
          setImportProgress(prev => prev ? { ...prev, current: totalItemsCreated } : null);
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
      setImportProgress(null);
    }
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...parsedItems[index] });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const saveEditing = async () => {
    if (editingIndex === null || !editForm) return;

    const existingItems = await inventoryStorage.getItems();
    const existingPartNumbers = new Set(existingItems.map(i => i.partNumber));

    const validatedItem = validateItem(editForm, existingPartNumbers);

    const newItems = [...parsedItems];
    newItems[editingIndex] = validatedItem;
    setParsedItems(newItems);

    setEditingIndex(null);
    setEditForm(null);

    if (validatedItem.isValid) {
      toast.success("Item updated and validated");
    } else {
      toast.info("Item updated but still has validation errors");
    }
  };

  const deleteItem = (index: number) => {
    const newItems = parsedItems.filter((_, i) => i !== index);
    setParsedItems(newItems);
    toast.success("Item removed from import list");
  };

  const deleteAllInvalid = () => {
    const validOnly = parsedItems.filter(item => item.isValid);
    const removedCount = parsedItems.length - validOnly.length;
    setParsedItems(validOnly);
    toast.success(`Removed ${removedCount} invalid items`);
  };

  const validCount = parsedItems.filter(item => item.isValid).length;
  const invalidCount = parsedItems.length - validCount;
  const totalQuantity = parsedItems.filter(i => i.isValid).reduce((sum, i) => sum + i.quantity, 0);

  const validItems = parsedItems.filter(item => item.isValid);
  const invalidItems = parsedItems
    .map((item, index) => ({ item, originalIndex: index }))
    .filter(({ item }) => !item.isValid);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setParsedItems([]);
        setEditingIndex(null);
        setEditForm(null);
        setImportProgress(null);
      }
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
                  {isProcessing && !importProgress ? "Processing..." : "Choose Excel File"}
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

            {/* Import Progress */}
            {importProgress && (
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Importing items...</span>
                  <span className="font-medium">
                    {importProgress.current} / {importProgress.total}
                  </span>
                </div>
                <Progress 
                  value={(importProgress.current / importProgress.total) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  Current: {importProgress.currentProduct}
                </p>
              </div>
            )}

            {parsedItems.length > 0 && !importProgress && (
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
                        <strong>{invalidCount}</strong> Invalid (click to edit)
                      </span>
                    </div>
                  )}
                </div>

                {/* Invalid Items Section - Editable */}
                {invalidItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Invalid Items - Click to Edit
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={deleteAllInvalid}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove All Invalid
                      </Button>
                    </div>
                    <ScrollArea className="h-[200px] border border-destructive/20 rounded-lg">
                      <div className="p-3 space-y-2">
                        {invalidItems.map(({ item, originalIndex }) => (
                          <div
                            key={originalIndex}
                            className="p-3 border rounded-lg bg-destructive/5 border-destructive/20"
                          >
                            {editingIndex === originalIndex ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Part Number *</Label>
                                    <Input
                                      value={editForm?.partNumber || ""}
                                      onChange={(e) => setEditForm(prev => prev ? { ...prev, partNumber: e.target.value } : null)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Quantity</Label>
                                    <Input
                                      type="number"
                                      value={editForm?.quantity || 0}
                                      onChange={(e) => setEditForm(prev => prev ? { ...prev, quantity: parseInt(e.target.value) || 0 } : null)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs">Description *</Label>
                                  <Input
                                    value={editForm?.description || ""}
                                    onChange={(e) => setEditForm(prev => prev ? { ...prev, description: e.target.value } : null)}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Sale Price</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editForm?.salePrice || 0}
                                      onChange={(e) => setEditForm(prev => prev ? { ...prev, salePrice: parseFloat(e.target.value) || 0 } : null)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Weight (lbs)</Label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={editForm?.weight || 0}
                                      onChange={(e) => setEditForm(prev => prev ? { ...prev, weight: parseFloat(e.target.value) || 0 } : null)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="ghost" onClick={cancelEditing}>
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                  <Button size="sm" onClick={saveEditing}>
                                    <Check className="h-4 w-4 mr-1" />
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <div 
                                  className="flex-1 cursor-pointer hover:bg-destructive/10 -m-3 p-3 rounded-lg transition-colors"
                                  onClick={() => startEditing(originalIndex)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">{item.partNumber || "(missing)"}</span>
                                        <Pencil className="h-3 w-3 text-muted-foreground" />
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
                                      </div>
                                      {item.errors.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          {item.errors.map((error, errorIndex) => (
                                            <p key={errorIndex} className="text-xs text-destructive flex items-center gap-1">
                                              <AlertCircle className="h-3 w-3" />
                                              {error}
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteItem(originalIndex);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Valid Items Section */}
                {validItems.length > 0 && (
                  <div className="space-y-2 flex-1 flex flex-col min-h-0">
                    <h4 className="text-sm font-medium text-green-600 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Valid Items ({validItems.length} products, {totalQuantity} items)
                    </h4>
                    <ScrollArea className="flex-1 border border-green-500/20 rounded-lg min-h-[150px]">
                      <div className="p-3 space-y-2">
                        {validItems.map((item, index) => (
                          <div
                            key={index}
                            className="p-3 border rounded-lg bg-green-500/5 border-green-500/20"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{item.partNumber}</span>
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {item.description}
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
                  </div>
                )}

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
