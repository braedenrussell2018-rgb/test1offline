import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Loader2, ArrowUpDown } from "lucide-react";

export type SortOption = 'default' | 'alphabetical' | 'price-high' | 'price-low' | 'quantity-high' | 'quantity-low';

interface InventoryFiltersProps {
  itemFilter: 'all' | 'available' | 'sold';
  onFilterChange: (filter: 'all' | 'available' | 'sold') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount: number;
  availableCount: number;
  soldCount: number;
  isSearching?: boolean;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
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
  sortBy,
  onSortChange,
}: InventoryFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            {itemFilter === 'all' ? 'All Items' : 
             itemFilter === 'available' ? 'Available Items' : 
             'Sold Items'}
          </h3>
          <p className="text-sm text-muted-foreground">View and manage your inventory items</p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
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
        <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortOption)}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="alphabetical">A-Z (Name)</SelectItem>
            <SelectItem value="price-high">Price: High to Low</SelectItem>
            <SelectItem value="price-low">Price: Low to High</SelectItem>
            <SelectItem value="quantity-high">Quantity: High to Low</SelectItem>
            <SelectItem value="quantity-low">Quantity: Low to High</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
