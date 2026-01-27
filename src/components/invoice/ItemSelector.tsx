import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Package, ArrowRight } from "lucide-react";
import { InventoryItem, Company, Person } from "@/lib/inventory-storage";

interface ItemSelectorProps {
  availableItems: InventoryItem[];
  companies: Company[];
  persons: Person[];
  onProceed: (data: {
    selectedItems: InventoryItem[];
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    salesmanName: string;
    shipToAddress: string;
  }) => void;
  onCancel: () => void;
  initialSalesmanName?: string;
}

export const ItemSelector = ({
  availableItems,
  companies,
  persons,
  onProceed,
  onCancel,
  initialSalesmanName = "",
}: ItemSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  
  // CRM Integration
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [availablePersons, setAvailablePersons] = useState<Person[]>([]);
  
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [salesmanName, setSalesmanName] = useState(initialSalesmanName);
  const [shipStreet, setShipStreet] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipState, setShipState] = useState("");
  const [shipZip, setShipZip] = useState("");

  // Update available persons when company is selected
  useEffect(() => {
    if (selectedCompanyId) {
      const companyPersons = persons.filter(p => p.companyId === selectedCompanyId);
      setAvailablePersons(companyPersons);
      setSelectedPersonId("");
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
        
        if (person.address) {
          const addressParts = person.address.split(',').map(s => s.trim());
          if (addressParts.length >= 3) {
            setShipStreet(addressParts[0] || "");
            setShipCity(addressParts[1] || "");
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

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return availableItems;
    
    const query = searchQuery.toLowerCase();
    return availableItems.filter(item =>
      item.partNumber.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.serialNumber?.toLowerCase().includes(query)
    );
  }, [searchQuery, availableItems]);

  // Group items by part number for display
  const groupedItems = useMemo(() => {
    const groups = new Map<string, InventoryItem[]>();
    filteredItems.forEach(item => {
      const existing = groups.get(item.partNumber) || [];
      groups.set(item.partNumber, [...existing, item]);
    });
    return groups;
  }, [filteredItems]);

  const toggleItem = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleAllInGroup = (items: InventoryItem[]) => {
    const allSelected = items.every(item => selectedItemIds.has(item.id));
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      items.forEach(item => {
        if (allSelected) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
      });
      return next;
    });
  };

  const handleProceed = () => {
    const selectedItems = availableItems.filter(item => selectedItemIds.has(item.id));
    const shipToAddressStr = (shipStreet || shipCity || shipState || shipZip)
      ? `${shipStreet}, ${shipCity}, ${shipState} ${shipZip}`.trim()
      : "";

    onProceed({
      selectedItems,
      customerName,
      customerEmail,
      customerPhone,
      salesmanName,
      shipToAddress: shipToAddressStr,
    });
  };

  const selectedCount = selectedItemIds.size;

  return (
    <div className="space-y-6">
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
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Select Items</h3>
          {selectedCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Package className="h-3 w-3" />
              {selectedCount} selected
            </Badge>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by part number, description, or serial number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <ScrollArea className="h-64 border rounded-lg">
          <div className="p-2 space-y-2">
            {groupedItems.size === 0 ? (
              <p className="text-muted-foreground text-center py-4">No items found</p>
            ) : (
              Array.from(groupedItems.entries()).map(([partNumber, items]) => {
                const allSelected = items.every(item => selectedItemIds.has(item.id));
                const someSelected = items.some(item => selectedItemIds.has(item.id));
                
                return (
                  <div key={partNumber} className="border rounded-lg overflow-hidden">
                    {/* Group header */}
                    <div
                      className="flex items-center gap-3 p-3 bg-muted/50 cursor-pointer hover:bg-muted"
                      onClick={() => toggleAllInGroup(items)}
                    >
                      <Checkbox
                        checked={allSelected}
                        className={someSelected && !allSelected ? "data-[state=checked]:bg-muted" : ""}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{partNumber}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {items[0].description}
                        </div>
                      </div>
                      <Badge variant="outline">{items.length} available</Badge>
                    </div>
                    
                    {/* Individual items */}
                    {items.length > 1 && (
                      <div className="divide-y">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-2 pl-8 hover:bg-muted/30 cursor-pointer"
                            onClick={() => toggleItem(item.id)}
                          >
                            <Checkbox checked={selectedItemIds.has(item.id)} />
                            <div className="flex-1 text-sm">
                              {item.serialNumber ? (
                                <span className="text-muted-foreground">SN: {item.serialNumber}</span>
                              ) : (
                                <span className="text-muted-foreground italic">No serial</span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ${item.salePrice.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Single item - click the header */}
                    {items.length === 1 && items[0].serialNumber && (
                      <div className="px-3 pb-2 text-xs text-muted-foreground">
                        SN: {items[0].serialNumber} • ${items[0].salePrice.toFixed(2)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleProceed} disabled={selectedCount === 0}>
          Continue to Invoice
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
