import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, Check, Building, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

interface AddressSuggestion {
  id: string;
  place_name: string;
  place_type: string;
  lat: number;
  lon: number;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing an address, city, or state...",
  required = false,
  className,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchAddresses = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      // Use Nominatim (OpenStreetMap) geocoding API - free, no API key required
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&q=${encodeURIComponent(query)}` +
        `&limit=8&addressdetails=1&countrycodes=us`,
        {
          headers: {
            'Accept': 'application/json',
            // Required by Nominatim usage policy
            'User-Agent': 'LovableApp/1.0'
          }
        }
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        setSuggestions(
          data.map((item: any) => ({
            id: item.place_id.toString(),
            place_name: item.display_name,
            place_type: item.type || item.class || 'place',
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
          }))
        );
        setOpen(true);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (inputValue: string) => {
    onChange(inputValue, true);
    setIsVerified(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (inputValue.length >= 3) {
      debounceRef.current = setTimeout(() => {
        searchAddresses(inputValue);
      }, 400); // Slightly longer debounce for Nominatim rate limits
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  };

  const handleSelectAddress = (suggestion: AddressSuggestion) => {
    onChange(suggestion.place_name, true);
    setIsVerified(true);
    setSuggestions([]);
    setOpen(false);
  };

  const getPlaceTypeIcon = (placeType: string) => {
    if (['state', 'region', 'county', 'city', 'town', 'village'].includes(placeType)) {
      return <Building className="h-4 w-4 text-blue-500 shrink-0" />;
    }
    if (['house', 'building', 'residential', 'commercial'].includes(placeType)) {
      return <MapPin className="h-4 w-4 text-green-500 shrink-0" />;
    }
    return <MapPinned className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  const getPlaceTypeLabel = (placeType: string) => {
    const labels: Record<string, string> = {
      state: "State",
      region: "Region",
      county: "County",
      city: "City",
      town: "Town",
      village: "Village",
      house: "Address",
      building: "Building",
      residential: "Address",
      commercial: "Commercial",
      neighbourhood: "Neighborhood",
      suburb: "Suburb",
    };
    return labels[placeType] || "Location";
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className={cn(
            "pl-9 pr-9",
            isVerified && "border-green-500 focus-visible:ring-green-500"
          )}
          required={required}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {isVerified && !isLoading && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
        )}
      </div>

      {/* Dropdown with suggestions */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[300px] overflow-auto">
          <div className="py-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSelectAddress(suggestion)}
                className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-start gap-3 transition-colors"
              >
                {getPlaceTypeIcon(suggestion.place_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{suggestion.place_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getPlaceTypeLabel(suggestion.place_type)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results message */}
      {open && suggestions.length === 0 && value.length >= 3 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-3">
          <p className="text-sm text-muted-foreground text-center">
            No matching locations found
          </p>
        </div>
      )}

      {/* Helpful tip */}
      {value.length > 0 && !isVerified && !open && (
        <p className="text-xs text-muted-foreground mt-1">
          Select from suggestions for best map accuracy
        </p>
      )}
    </div>
  );
}
