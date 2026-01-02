import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";

interface InventoryFiltersProps {
  itemFilter: 'all' | 'available' | 'sold';
  onFilterChange: (filter: 'all' | 'available' | 'sold') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount: number;
  availableCount: number;
  soldCount: number;
  isSearching?: boolean;
}

export function InventoryFilters({
  itemFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  totalCount,
  availableCount,
  soldCount,
  isSearching = false,
}: InventoryFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">
            {itemFilter === 'all' ? 'All Items' : 
             itemFilter === 'available' ? 'Available Items' : 
             'Sold Items'}
          </h3>
          <p className="text-sm text-muted-foreground">View and manage your inventory items</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={itemFilter === 'all' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => onFilterChange('all')}
          >
            All ({totalCount})
          </Button>
          <Button 
            variant={itemFilter === 'available' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => onFilterChange('available')}
          >
            Available ({availableCount})
          </Button>
          <Button 
            variant={itemFilter === 'sold' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => onFilterChange('sold')}
          >
            Sold ({soldCount})
          </Button>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by part number, description, serial number, or shelf location..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-10 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
