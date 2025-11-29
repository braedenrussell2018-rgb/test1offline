import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Trash2, ExternalLink } from "lucide-react";
import { type Expense, EXPENSE_CATEGORIES, getCategoryLabel, updateExpense, deleteExpense } from "@/lib/expense-storage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExpenseDetailDialogProps {
  expense: Expense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseUpdated: () => void;
  onExpenseDeleted: () => void;
}

export const ExpenseDetailDialog = ({
  expense,
  open,
  onOpenChange,
  onExpenseUpdated,
  onExpenseDeleted,
}: ExpenseDetailDialogProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const [employeeName, setEmployeeName] = useState(expense.employeeName);
  const [amount, setAmount] = useState(expense.amount.toString());
  const [expenseDate, setExpenseDate] = useState(expense.expenseDate);
  const [category, setCategory] = useState(expense.category);
  const [description, setDescription] = useState(expense.description || "");
  const [creditCardLast4, setCreditCardLast4] = useState(expense.creditCardLast4 || "");

  const handleSave = async () => {
    if (!employeeName.trim()) {
      toast.error("Employee name is required");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Valid amount is required");
      return;
    }

    setIsSaving(true);
    try {
      await updateExpense(expense.id, {
        employeeName: employeeName.trim(),
        amount: parseFloat(amount),
        expenseDate,
        category,
        description: description.trim() || undefined,
        creditCardLast4: creditCardLast4.trim() || undefined,
      });

      toast.success("Expense updated successfully");
      setIsEditing(false);
      onExpenseUpdated();
    } catch (error) {
      console.error("Error updating expense:", error);
      toast.error("Failed to update expense");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await deleteExpense(expense.id);
      toast.success("Expense deleted successfully");
      setShowDeleteDialog(false);
      onOpenChange(false);
      onExpenseDeleted();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEmployeeName(expense.employeeName);
    setAmount(expense.amount.toString());
    setExpenseDate(expense.expenseDate);
    setCategory(expense.category);
    setDescription(expense.description || "");
    setCreditCardLast4(expense.creditCardLast4 || "");
    setIsEditing(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => {
        if (!open) resetForm();
        onOpenChange(open);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Expense" : "Expense Details"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeName">Employee Name</Label>
                <Input
                  id="employeeName"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={!isEditing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenseDate">Date</Label>
                  <Input
                    id="expenseDate"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={category}
                  onValueChange={setCategory}
                  disabled={!isEditing}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
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

              <div className="space-y-2">
                <Label htmlFor="creditCardLast4">Credit Card Last 4 Digits</Label>
                <Input
                  id="creditCardLast4"
                  maxLength={4}
                  value={creditCardLast4}
                  onChange={(e) => setCreditCardLast4(e.target.value.replace(/\D/g, ''))}
                  placeholder="Optional"
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes about this expense"
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              {expense.receiptUrl && (
                <div className="space-y-2">
                  <Label>Receipt</Label>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(expense.receiptUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Receipt
                  </Button>
                </div>
              )}

              {expense.customerId && (
                <div className="space-y-2">
                  <Label>Linked to Customer</Label>
                  <div className="text-sm text-muted-foreground">
                    This expense is linked to a customer
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Created: {new Date(expense.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this expense. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
