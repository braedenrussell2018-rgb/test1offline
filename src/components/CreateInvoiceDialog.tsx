import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, InventoryItem, Company, Person } from "@/lib/inventory-storage";
import { supabase } from "@/integrations/supabase/client";
import { ItemSelector } from "@/components/invoice/ItemSelector";
import { InvoicePreviewEditor, InvoiceLineItem } from "@/components/invoice/InvoicePreviewEditor";

interface CreateInvoiceDialogProps {
  onInvoiceCreated: () => void;
}

type Step = 'select' | 'preview';

export const CreateInvoiceDialog = ({ onInvoiceCreated }: CreateInvoiceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('select');
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [salesmanName, setSalesmanName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Data passed from selection to preview
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const loadData = async () => {
        const [items, companiesData, personsData] = await Promise.all([
          inventoryStorage.getItems(),
          inventoryStorage.getCompanies(),
          inventoryStorage.getPersons()
        ]);
        
        const available = items.filter(item => item.status === 'available');
        setAvailableItems(available);
        setCompanies(companiesData);
        setPersons(personsData);
        
        // Fetch user profile to autofill salesman name
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', user.id)
            .single();
          
          if (profile?.full_name) {
            setSalesmanName(profile.full_name);
          }
        }
        
        // Generate invoice number
        setInvoiceNumber(`INV-${Date.now()}`);
      };
      
      loadData();
      
      // Reset state
      setStep('select');
      setSelectedItems([]);
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setShipToAddress("");
      setIsSubmitting(false);
    }
  }, [open]);

  const handleProceedToPreview = (data: {
    selectedItems: InventoryItem[];
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    salesmanName: string;
    shipToAddress: string;
  }) => {
    setSelectedItems(data.selectedItems);
    setCustomerName(data.customerName);
    setCustomerEmail(data.customerEmail);
    setCustomerPhone(data.customerPhone);
    setSalesmanName(data.salesmanName);
    setShipToAddress(data.shipToAddress);
    setStep('preview');
  };

  const handleCreateInvoice = async (data: {
    lineItems: InvoiceLineItem[];
    discount: number;
    discountType: 'dollar' | 'percent';
    shippingCost: number;
  }) => {
    if (data.lineItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the invoice",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const invoiceItems = data.lineItems.map((item) => ({
        itemId: item.itemId,
        partNumber: item.partNumber,
        serialNumber: item.serialNumber,
        description: item.description,
        price: item.price,
      }));

      const subtotal = invoiceItems.reduce((sum, item) => sum + item.price, 0);
      const discountAmount = data.discountType === 'percent' 
        ? (subtotal * data.discount) / 100 
        : data.discount;
      const total = subtotal - discountAmount + data.shippingCost;

      const invoice = await inventoryStorage.createInvoice({
        invoiceNumber,
        items: invoiceItems,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        salesmanName: salesmanName || undefined,
        shipToAddress: shipToAddress || undefined,
        discount: discountAmount,
        shippingCost: data.shippingCost,
        subtotal,
        total,
      });

      // Mark items as sold
      for (const item of data.lineItems) {
        await inventoryStorage.updateItem(item.itemId, {
          status: 'sold',
          soldDate: new Date().toISOString(),
          invoiceId: invoice.id,
        });
      }

      toast({
        title: "Success",
        description: `Invoice ${invoice.invoiceNumber} created successfully`,
      });

      setOpen(false);
      onInvoiceCreated();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Create New Invoice' : 'Review Invoice'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {availableItems.length === 0 && step === 'select' ? (
            <p className="text-muted-foreground text-center py-8">
              No available items in inventory
            </p>
          ) : step === 'select' ? (
            <ItemSelector
              availableItems={availableItems}
              companies={companies}
              persons={persons}
              onProceed={handleProceedToPreview}
              onCancel={() => setOpen(false)}
              initialSalesmanName={salesmanName}
            />
          ) : (
            <InvoicePreviewEditor
              items={selectedItems}
              customerName={customerName}
              customerEmail={customerEmail}
              customerPhone={customerPhone}
              salesmanName={salesmanName}
              shipToAddress={shipToAddress}
              invoiceNumber={invoiceNumber}
              onBack={() => setStep('select')}
              onCreateInvoice={handleCreateInvoice}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
