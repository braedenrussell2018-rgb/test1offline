import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, InventoryItem, Company, Person } from "@/lib/inventory-storage";
import { supabase } from "@/integrations/supabase/client";

interface CreateQuoteDialogProps {
  onQuoteCreated: () => void;
}

export const CreateQuoteDialog = ({ onQuoteCreated }: CreateQuoteDialogProps) => {
  const [open, setOpen] = useState(false);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Map<string, { price: number }>>(new Map());
  
  // CRM Integration
  const [companies, setCompanies] = useState<Company[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [availablePersons, setAvailablePersons] = useState<Person[]>([]);
  
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [salesmanName, setSalesmanName] = useState("");
  const [shipStreet, setShipStreet] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipState, setShipState] = useState("");
  const [shipZip, setShipZip] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'dollar' | 'percent'>('dollar');
  const [shippingCost, setShippingCost] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const loadData = async () => {
        const [items, companiesData, personsData] = await Promise.all([
          inventoryStorage.getItems(),
          inventoryStorage.getCompanies(),
          inventoryStorage.getPersons()
        ]);
        
        const availableItems = items.filter(item => item.status === 'available');
        setAvailableItems(availableItems);
        setFilteredItems(availableItems);
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
      };
      
      loadData();
      setSelectedItems(new Map());
      setSearchQuery("");
      
      // Reset form
      setSelectedCompanyId("");
      setSelectedPersonId("");
      setCustomerName("");
      setCustomerEmail("");
      setCustomerPhone("");
      setShipStreet("");
      setShipCity("");
      setShipState("");
      setShipZip("");
      setDiscount(0);
      setShippingCost(0);
    }
  }, [open]);

  // Update available persons when company is selected
  useEffect(() => {
    if (selectedCompanyId) {
      const companyPersons = persons.filter(p => p.companyId === selectedCompanyId);
      setAvailablePersons(companyPersons);
      setSelectedPersonId(""); // Reset person selection
    } else {
      setAvailablePersons([]);
      setSelectedPersonId("");
    }
  }, [selectedCompanyId, persons]);

  // Auto-fill customer information when person is selected
  useEffect(() => {
    if (selectedPersonId) {
      const person = persons.find(p => p.id === selectedPersonId);
      const company = companies.find(c => c.id === selectedCompanyId);
      
      if (person && company) {
        setCustomerName(`${person.name} - ${company.name}`);
        setCustomerEmail(person.email || "");
        setCustomerPhone(person.phone || "");
        
        // Pre-fill address if available
        if (person.address) {
          // Try to parse address (basic parsing)
          const addressParts = person.address.split(',').map(s => s.trim());
          if (addressParts.length >= 3) {
            setShipStreet(addressParts[0] || "");
            setShipCity(addressParts[1] || "");
            // Try to extract state and zip from last part
            const lastPart = addressParts[addressParts.length - 1];
            const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5})/);
            if (stateZipMatch) {
              setShipState(stateZipMatch[1]);
              setShipZip(stateZipMatch[2]);
            }
          } else {
            setShipStreet(person.address);
          }
        }
      }
    }
  }, [selectedPersonId, persons, companies, selectedCompanyId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(availableItems);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = availableItems.filter(item => 
      item.partNumber.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.serialNumber?.toLowerCase().includes(query)
    );
    setFilteredItems(filtered);
  }, [searchQuery, availableItems]);

  const handleToggleItemWithSalePrice = (itemId: string, checked: boolean) => {
    const newSelected = new Map(selectedItems);
    if (checked) {
      const item = availableItems.find(i => i.id === itemId);
      if (item) {
        newSelected.set(itemId, { price: item.salePrice });
      }
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handlePriceChange = (itemId: string, price: string) => {
    const priceNum = parseFloat(price);
    if (!isNaN(priceNum) && priceNum >= 0) {
      const newSelected = new Map(selectedItems);
      const current = newSelected.get(itemId);
      if (current) {
        newSelected.set(itemId, { price: priceNum });
        setSelectedItems(newSelected);
      }
    }
  };

  const handleCreateQuote = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one item",
        variant: "destructive",
      });
      return;
    }

    const quoteItems = Array.from(selectedItems.entries()).map(([itemId, data]) => {
      const item = availableItems.find(i => i.id === itemId)!;
      return {
        itemId,
        partNumber: item.partNumber,
        serialNumber: item.serialNumber,
        description: item.description,
        price: data.price,
      };
    });

    const subtotal = quoteItems.reduce((sum, item) => sum + item.price, 0);
    const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;
    const total = subtotal - discountAmount + shippingCost;

    const shipToAddressStr = (shipStreet || shipCity || shipState || shipZip) 
      ? `${shipStreet}, ${shipCity}, ${shipState} ${shipZip}`.trim()
      : undefined;

    const quoteNumber = `QTE-${Date.now()}`;

    const quote = await inventoryStorage.createQuote({
      quoteNumber,
      items: quoteItems,
      customerName: customerName || undefined,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      salesmanName: salesmanName || undefined,
      shipToAddress: shipToAddressStr,
      discount: discountAmount,
      shippingCost,
      subtotal,
      total,
      status: 'pending',
    });

    toast({
      title: "Success",
      description: `Quote ${quote.quoteNumber} created successfully`,
    });

    setOpen(false);
    onQuoteCreated();
  };

  const subtotal = Array.from(selectedItems.values()).reduce((sum, data) => sum + data.price, 0);
  const discountAmount = discountType === 'percent' ? (subtotal * discount) / 100 : discount;
  const total = subtotal - discountAmount + shippingCost;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Create Quote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Quote</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {availableItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No available items in inventory
            </p>
          ) : (
            <>
              {/* Customer Information from CRM */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="company">Company</Label>
                    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="person">Contact Person</Label>
                    <Select 
                      value={selectedPersonId} 
                      onValueChange={setSelectedPersonId}
                      disabled={!selectedCompanyId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedCompanyId ? "Select a contact" : "Select company first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePersons.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="customerEmail">Email</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="customerPhone">Phone</Label>
                    <Input
                      id="customerPhone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Salesman */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Salesman</h3>
                <div className="space-y-1">
                  <Label htmlFor="salesmanName">Salesman Name</Label>
                  <Input
                    id="salesmanName"
                    value={salesmanName}
                    onChange={(e) => setSalesmanName(e.target.value)}
                    placeholder="Enter salesman name"
                  />
                </div>
              </div>

              {/* Shipping Address */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Ship To Address</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="shipStreet">Street Address</Label>
                    <Input
                      id="shipStreet"
                      value={shipStreet}
                      onChange={(e) => setShipStreet(e.target.value)}
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="shipCity">City</Label>
                      <Input
                        id="shipCity"
                        value={shipCity}
                        onChange={(e) => setShipCity(e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="shipState">State</Label>
                      <Input
                        id="shipState"
                        value={shipState}
                        onChange={(e) => setShipState(e.target.value)}
                        placeholder="State"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="shipZip">ZIP Code</Label>
                      <Input
                        id="shipZip"
                        value={shipZip}
                        onChange={(e) => setShipZip(e.target.value)}
                        placeholder="12345"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Selection with Search */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Select Items</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by part number, description, or serial number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredItems.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No items found</p>
                  ) : (
                    filteredItems.map((item) => {
                      const itemData = selectedItems.get(item.id);
                      const isSelected = selectedItems.has(item.id);
                      
                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 border rounded-lg bg-card"
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleToggleItemWithSalePrice(item.id, checked as boolean)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{item.partNumber}</div>
                            {item.serialNumber && (
                              <div className="text-xs text-muted-foreground">SN: {item.serialNumber}</div>
                            )}
                            <div className="text-sm text-muted-foreground truncate">
                              {item.description}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Cost: ${item.cost.toFixed(2)} | Sale: ${item.salePrice.toFixed(2)}
                            </div>
                          </div>
                          {isSelected && itemData && (
                            <div className="space-y-2">
                              <div className="space-y-1">
                                <Label htmlFor={`price-${item.id}`} className="text-xs">
                                  Quote Price
                                </Label>
                                <Input
                                  id={`price-${item.id}`}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={itemData.price}
                                  onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                  className="w-24"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Pricing Summary */}
              <div className="border-t pt-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="discount">Discount</Label>
                    <Input
                      id="discount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="discountType">Type</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={discountType === 'dollar' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDiscountType('dollar')}
                        className="flex-1"
                      >
                        $
                      </Button>
                      <Button
                        type="button"
                        variant={discountType === 'percent' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDiscountType('percent')}
                        className="flex-1"
                      >
                        %
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="shippingCost">Shipping Cost</Label>
                    <Input
                      id="shippingCost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Discount ({discountType === 'percent' ? `${discount}%` : `$${discount}`}):
                      </span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {shippingCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping:</span>
                      <span>${shippingCost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold border-t pt-2">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateQuote} disabled={selectedItems.size === 0}>
                  Create Quote
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
