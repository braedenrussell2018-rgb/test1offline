import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, Loader2, Check, AlertCircle } from "lucide-react";
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
  const [isVerified, setIsVerified] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch Mapbox token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-mapbox-token");
        if (!error && data?.token) {
          setMapboxToken(data.token);
          setTokenError(false);
        } else {
          setTokenError(true);
        }
      } catch (err) {
        console.error("Failed to fetch Mapbox token:", err);
        setTokenError(true);
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
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&types=address,place,postcode,locality,neighborhood,region&limit=5`
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
        if (data.features.length > 0) {
          setOpen(true);
        }
      }
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (inputValue: string) => {
    // Always pass true for isValid - we allow manual addresses
    onChange(inputValue, true);
    setIsVerified(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (inputValue.length >= 3 && mapboxToken) {
      debounceRef.current = setTimeout(() => {
        searchAddresses(inputValue);
      }, 300);
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

  const handleBlur = () => {
    // Close suggestions after a short delay to allow click
    setTimeout(() => {
      setOpen(false);
    }, 200);
  };

  // If no token, show a simple input without autocomplete
  if (tokenError || !mapboxToken) {
    return (
      <div className={cn("relative", className)}>
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value, true)}
          placeholder={placeholder}
          className="pl-9"
          required={required}
        />
      </div>
    );
  }

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
              onBlur={handleBlur}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setOpen(true);
                }
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
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-[var(--radix-popover-trigger-width)]" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Searching..." : "No suggestions found - you can still use this address"}
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
      {value.length > 0 && !isVerified && (
        <p className="text-xs text-muted-foreground mt-1">
          Tip: Select from suggestions for best map accuracy
        </p>
      )}
    </div>
  );
}
