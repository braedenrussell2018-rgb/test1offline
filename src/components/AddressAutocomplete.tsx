import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  center: [number, number];
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing an address...",
  required = false,
  className,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidAddress, setIsValidAddress] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch Mapbox token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-mapbox-token");
        if (!error && data?.token) {
          setMapboxToken(data.token);
        }
      } catch (err) {
        console.error("Failed to fetch Mapbox token:", err);
      }
    };
    fetchToken();
  }, []);

  const searchAddresses = async (query: string) => {
    if (!mapboxToken || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&types=address,place,postcode&limit=5&country=US,CA`
      );
      const data = await response.json();
      
      if (data.features) {
        setSuggestions(
          data.features.map((feature: any) => ({
            id: feature.id,
            place_name: feature.place_name,
            center: feature.center,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (inputValue: string) => {
    onChange(inputValue, false);
    setIsValidAddress(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchAddresses(inputValue);
      if (inputValue.length >= 3) {
        setOpen(true);
      }
    }, 300);
  };

  const handleSelectAddress = (suggestion: AddressSuggestion) => {
    onChange(suggestion.place_name, true);
    setIsValidAddress(true);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={placeholder}
              className={cn(
                "pl-9 pr-9",
                isValidAddress && "border-green-500 focus-visible:ring-green-500"
              )}
              required={required}
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {isValidAddress && !isLoading && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-[var(--radix-popover-trigger-width)]" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Searching..." : "No addresses found"}
              </CommandEmpty>
              <CommandGroup>
                {suggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion.id}
                    value={suggestion.place_name}
                    onSelect={() => handleSelectAddress(suggestion)}
                    className="cursor-pointer"
                  >
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{suggestion.place_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {required && !isValidAddress && value.length > 0 && (
        <p className="text-xs text-amber-600 mt-1">
          Please select a valid address from the suggestions
        </p>
      )}
    </div>
  );
}
