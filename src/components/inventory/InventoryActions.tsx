import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileEdit, Archive } from "lucide-react";
import { AddItemDialog } from "@/components/AddItemDialog";
import { CreateInvoiceDialog } from "@/components/CreateInvoiceDialog";
import { BulkUploadDialog } from "@/components/BulkUploadDialog";
import { IssuePODialog } from "@/components/IssuePODialog";

interface InventoryActionsProps {
  onRefresh: () => void;
  disabled?: boolean;
}

export function InventoryActions({ onRefresh, disabled = false }: InventoryActionsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
      <AddItemDialog onItemAdded={onRefresh} />
      <BulkUploadDialog onItemsAdded={onRefresh} />
      <IssuePODialog onPOCreated={onRefresh} />
      <CreateInvoiceDialog onInvoiceCreated={onRefresh} />
      <Link to="/quotes">
        <Button variant="outline" className="w-full" disabled={disabled}>
          <FileEdit className="mr-2 h-4 w-4" />
          Create Quote
        </Button>
      </Link>
      <Link to="/sold-items">
        <Button variant="outline" className="w-full" disabled={disabled}>
          <Archive className="mr-2 h-4 w-4" />
          Sold Items
        </Button>
      </Link>
    </div>
  );
}
