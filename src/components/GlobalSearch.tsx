import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Package, Building2, User, FileText, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { inventoryStorage } from "@/lib/inventory-storage";

type SearchResult = {
  id: string;
  type: "item" | "company" | "person" | "quote" | "invoice";
  title: string;
  subtitle?: string;
  route: string;
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const searchData = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      const searchTerm = query.toLowerCase();
      const allResults: SearchResult[] = [];

      try {
        // Search inventory items
        const items = await inventoryStorage.getItems();
        items
          .filter(
            (item) =>
              item.partNumber.toLowerCase().includes(searchTerm) ||
              item.description.toLowerCase().includes(searchTerm) ||
              item.serialNumber?.toLowerCase().includes(searchTerm)
          )
          .forEach((item) => {
            allResults.push({
              id: item.id,
              type: "item",
              title: item.partNumber,
              subtitle: item.description,
              route: "/",
            });
          });

        // Search companies
        const companies = await inventoryStorage.getCompanies();
        companies
          .filter(
            (company) =>
              company.name.toLowerCase().includes(searchTerm) ||
              company.address?.toLowerCase().includes(searchTerm)
          )
          .forEach((company) => {
            allResults.push({
              id: company.id,
              type: "company",
              title: company.name,
              subtitle: company.address || undefined,
              route: "/crm",
            });
          });

        // Search people/contacts
        const people = await inventoryStorage.getPersons();
        people
          .filter(
            (person) =>
              person.name.toLowerCase().includes(searchTerm) ||
              person.email?.toLowerCase().includes(searchTerm) ||
              person.phone?.toLowerCase().includes(searchTerm) ||
              person.jobTitle?.toLowerCase().includes(searchTerm)
          )
          .forEach((person) => {
            allResults.push({
              id: person.id,
              type: "person",
              title: person.name,
              subtitle: person.jobTitle || person.email || undefined,
              route: "/crm",
            });
          });

        // Search quotes
        const quotes = await inventoryStorage.getQuotes();
        quotes
          .filter(
            (quote) =>
              quote.quoteNumber.toLowerCase().includes(searchTerm) ||
              quote.customerName.toLowerCase().includes(searchTerm)
          )
          .forEach((quote) => {
            allResults.push({
              id: quote.id,
              type: "quote",
              title: `Quote ${quote.quoteNumber}`,
              subtitle: quote.customerName,
              route: "/accounting",
            });
          });

        // Search invoices
        const invoices = await inventoryStorage.getInvoices();
        invoices
          .filter(
            (invoice) =>
              invoice.invoiceNumber.toLowerCase().includes(searchTerm) ||
              invoice.customerName.toLowerCase().includes(searchTerm)
          )
          .forEach((invoice) => {
            allResults.push({
              id: invoice.id,
              type: "invoice",
              title: `Invoice ${invoice.invoiceNumber}`,
              subtitle: invoice.customerName,
              route: "/accounting",
            });
          });

        setResults(allResults.slice(0, 20)); // Limit to 20 results
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchData, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    navigate(result.route);
    setOpen(false);
    setQuery("");
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "item":
        return <Package className="h-4 w-4" />;
      case "company":
        return <Building2 className="h-4 w-4" />;
      case "person":
        return <User className="h-4 w-4" />;
      case "quote":
        return <FileText className="h-4 w-4" />;
      case "invoice":
        return <Receipt className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "item":
        return "Item";
      case "company":
        return "Company";
      case "person":
        return "Contact";
      case "quote":
        return "Quote";
      case "invoice":
        return "Invoice";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search everything..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => query.length >= 2 && setOpen(true)}
            className="pl-9 pr-4"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {query.length < 2
                ? "Type at least 2 characters to search"
                : "No results found"}
            </div>
          ) : (
            <div className="p-2">
              {results.map((result) => (
                <Button
                  key={`${result.type}-${result.id}`}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto py-3 px-3 mb-1"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className="mt-0.5 text-muted-foreground">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium truncate">{result.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {getTypeLabel(result.type)}
                        </span>
                      </div>
                      {result.subtitle && (
                        <div className="text-sm text-muted-foreground truncate">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
