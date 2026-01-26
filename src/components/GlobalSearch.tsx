import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Package, Building2, User, FileText, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { inventoryStorage } from "@/lib/inventory-storage-adapter";

type SearchResult = {
  id: string;
  type: "item" | "company" | "person" | "quote" | "invoice";
  title: string;
  subtitle?: string;
  route: string;
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    // Navigate to the page with state to open the specific item
    navigate(result.route, { 
      state: { 
        selectedId: result.id, 
        selectedType: result.type 
      } 
    });
    
    setShowResults(false);
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
    <div ref={containerRef} className="relative w-64">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
      <Input
        ref={inputRef}
        placeholder="Search everything..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.length >= 2) {
            setShowResults(true);
          }
        }}
        onFocus={() => {
          if (query.length >= 2) {
            setShowResults(true);
          }
        }}
        className="pl-9 pr-4"
      />
      
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-xl z-[9999] max-h-[400px] overflow-y-auto">
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
                  className="w-full justify-start text-left h-auto py-3 px-3 mb-1 hover:bg-muted"
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
        </div>
      )}
    </div>
  );
}