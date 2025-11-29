import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Loader2, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addExpense, EXPENSE_CATEGORIES, getCategoryLabel, uploadReceipt, scanReceipt } from "@/lib/expense-storage";
import { inventoryStorage, Person } from "@/lib/inventory-storage";
import { supabase } from "@/integrations/supabase/client";

interface AddExpenseDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onExpenseAdded: () => void;
}

export const AddExpenseDialog = ({ open: controlledOpen, onOpenChange, onExpenseAdded }: AddExpenseDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [employeeName, setEmployeeName] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [creditCardLast4, setCreditCardLast4] = useState("");
  const [persons, setPersons] = useState<Person[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadData();
      resetForm();
    }
  }, [open]);

  const loadData = async () => {
    const [personsData] = await Promise.all([
      inventoryStorage.getPersons()
    ]);
    setPersons(personsData);

    // Get current user's name
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      
      if (profile?.full_name) {
        setEmployeeName(profile.full_name);
      }
    }
  };

  const resetForm = () => {
    setAmount("");
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setCategory("");
    setDescription("");
    setReceiptUrl("");
    setCreditCardLast4("");
    setCustomerId("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setIsScanning(true);

    try {
      // Upload receipt
      const url = await uploadReceipt(file);
      setReceiptUrl(url);

      // Convert to base64 for scanning
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const scannedData = await scanReceipt(base64);

          if (scannedData.total) setAmount(scannedData.total.toString());
          if (scannedData.date) setExpenseDate(scannedData.date);
          if (scannedData.category) setCategory(scannedData.category);
          if (scannedData.creditCardLast4) setCreditCardLast4(scannedData.creditCardLast4);
          if (scannedData.description) setDescription(scannedData.description);

          toast({
            title: "Receipt Scanned",
            description: "Receipt data has been extracted successfully",
          });
        } catch (scanError) {
          console.error('Scan error:', scanError);
          toast({
            title: "Scan Warning",
            description: "Receipt uploaded but could not be scanned automatically",
            variant: "destructive",
          });
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload receipt",
        variant: "destructive",
      });
      setIsScanning(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!employeeName.trim()) {
      toast({ title: "Error", description: "Employee name is required", variant: "destructive" });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Error", description: "Valid amount is required", variant: "destructive" });
      return;
    }
    if (!category) {
      toast({ title: "Error", description: "Category is required", variant: "destructive" });
      return;
    }

    try {
      await addExpense({
        employeeName,
        customerId: customerId || undefined,
        amount: parseFloat(amount),
        expenseDate,
        category,
        description: description || undefined,
        receiptUrl: receiptUrl || undefined,
        creditCardLast4: creditCardLast4 || undefined,
      });

      toast({ title: "Success", description: "Expense added successfully" });
      setOpen(false);
      onExpenseAdded();
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({ title: "Error", description: "Failed to add expense", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label>Receipt (Optional)</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
                id="receipt-upload"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById('receipt-upload')?.click()}
                disabled={isUploading || isScanning}
              >
                {isUploading || isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isScanning ? 'Scanning...' : 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Upload & Scan Receipt
                  </>
                )}
              </Button>
            </div>
            {receiptUrl && (
              <p className="text-xs text-green-600">Receipt uploaded successfully</p>
            )}
          </div>

          {/* Employee Name */}
          <div className="space-y-2">
            <Label htmlFor="employeeName">Employee Name *</Label>
            <Input
              id="employeeName"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Enter employee name"
            />
          </div>

          {/* Customer Assignment */}
          <div className="space-y-2">
            <Label htmlFor="customer">Assign to Customer (Optional)</Label>
          <Select value={customerId} onValueChange={(value) => setCustomerId(value === "none" ? "" : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {persons.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="expenseDate">Date *</Label>
            <Input
              id="expenseDate"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {getCategoryLabel(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Credit Card Last 4 */}
          <div className="space-y-2">
            <Label htmlFor="creditCard">Credit Card Last 4 Digits</Label>
            <Input
              id="creditCard"
              value={creditCardLast4}
              onChange={(e) => setCreditCardLast4(e.target.value.slice(0, 4))}
              placeholder="1234"
              maxLength={4}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
              rows={2}
            />
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Add Expense
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};