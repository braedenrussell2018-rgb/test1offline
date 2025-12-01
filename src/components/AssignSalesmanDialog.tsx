import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus } from "lucide-react";

interface AssignSalesmanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "invoice" | "quote";
  id: string;
  documentNumber: string;
  currentSalesman?: string;
  onAssigned: () => void;
}

export function AssignSalesmanDialog({
  open,
  onOpenChange,
  type,
  id,
  documentNumber,
  currentSalesman,
  onAssigned,
}: AssignSalesmanDialogProps) {
  const [salesmanName, setSalesmanName] = useState(currentSalesman || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salesmanName.trim()) {
      toast.error("Please enter a salesman name");
      return;
    }

    setIsSubmitting(true);
    try {
      const table = type === "invoice" ? "invoices" : "quotes";
      const { error } = await supabase
        .from(table)
        .update({ salesman_name: salesmanName.trim() })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Salesman assigned to ${type}`);
      onAssigned();
      onOpenChange(false);
    } catch (error) {
      console.error("Error assigning salesman:", error);
      toast.error("Failed to assign salesman");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign Salesman
          </DialogTitle>
          <DialogDescription>
            Assign a salesman to {type} {documentNumber}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="salesman">Salesman Name</Label>
            <Input
              id="salesman"
              value={salesmanName}
              onChange={(e) => setSalesmanName(e.target.value)}
              placeholder="Enter salesman name"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
