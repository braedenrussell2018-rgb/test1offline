import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { latLngToCell, cellToBoundary } from "h3-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { MapPin, Building2, User, X, Loader2, AlertCircle, Hexagon, RefreshCw } from "lucide-react";
import { Company, Person } from "@/lib/inventory-storage";
import { PersonDetailDialog } from "./PersonDetailDialog";
import { CompanyDetailDialog } from "./CompanyDetailDialog";

interface ContactsMapDialogProps {
  companies: Company[];
  persons: Person[];
  onRefresh: () => void;
}

interface GeocodedLocation {
  address: string;
  lat: number;
  lng: number;
  companies: Company[];
  persons: Person[];
}

interface H3Cell {
  h3Index: string;
  count: number;
  companies: Company[];
  persons: Person[];
  boundary: [number, number][];
}

interface FailedLocation {
  address: string;
  companies: Company[];
  persons: Person[];
  reason?: string;
}

interface CachedGeocode {
  lat: number;
  lng: number;
  timestamp: number;
}

// Fix for default marker icons in Leaflet with bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Color scale for heatmap (low to high density)
const getHexColor = (count: number, maxCount: number): string => {
  const ratio = Math.min(count / Math.max(maxCount, 1), 1);
  // Gradient from blue (low) to red (high)
  const hue = (1 - ratio) * 240; // 240 = blue, 0 = red
  return `hsl(${hue}, 70%, 50%)`;
};

// Geocode cache persistence
const CACHE_KEY = "crm_geocode_cache";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const loadGeocodeCache = (): Map<string, CachedGeocode> => {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (!saved) return new Map();
    const parsed = JSON.parse(saved);
    const now = Date.now();
    // Filter out expired entries
    const entries = Object.entries(parsed)
      .filter(([_, value]) => now - (value as CachedGeocode).timestamp < CACHE_DURATION)
      .map(([key, value]) => [key, value] as [string, CachedGeocode]);
    return new Map(entries);
  } catch (err) {
    console.error("Failed to load geocode cache", err);
    return new Map();
  }
};

const saveGeocodeCache = (cache: Map<string, CachedGeocode>) => {
  try {
    const obj = Object.fromEntries(cache.entries());
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (err) {
    console.error("Failed to save geocode cache", err);
  }
};

// Geocode cache stored in memory (persists across dialog opens/closes)
const geocodeCache = loadGeocodeCache();

export function ContactsMapDialog({ companies, persons, onRefresh }: ContactsMapDialogProps) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<GeocodedLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GeocodedLocation | null>(null);
  const [selectedH3Cell, setSelectedH3Cell] = useState<H3Cell | null>(null);
  const [failedLocations, setFailedLocations] = useState<FailedLocation[]>([]);
  const [showFailedDialog, setShowFailedDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMinimized, setIsLoadingMinimized] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState(0);
  const [geocodeStatus, setGeocodeStatus] = useState("");
  const [showH3Overlay, setShowH3Overlay] = useState(true);
  const [h3Resolution, setH3Resolution] = useState(7); // Default resolution
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const h3LayerRef = useRef<L.LayerGroup | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasFittedRef = useRef(false);

  const getCompanyName = useCallback((companyId?: string) => {
    if (!companyId) return "No Company";
    const company = companies.find(c => c.id === companyId);
    return company?.name || "Unknown Company";
  }, [companies]);

  // Derived state: totalAddresses
  const totalAddresses = useMemo(() => new Set([
    ...companies.filter(c => c.address?.trim()).map(c => c.address!.trim().toLowerCase()),
    ...persons.filter(p => p.address?.trim()).map(p => p.address!.trim().toLowerCase()),
  ]).size, [companies, persons]);

  // Derived state: H3 cells
  const h3Cells = useMemo((): H3Cell[] => {
    if (locations.length === 0) return [];

    const cellMap = new Map<string, { companies: Company[]; persons: Person[] }>();

    locations.forEach(location => {
      try {
        const h3Index = latLngToCell(location.lat, location.lng, h3Resolution);

        if (!cellMap.has(h3Index)) {
          cellMap.set(h3Index, { companies: [], persons: [] });
        }

        const cell = cellMap.get(h3Index)!;
        cell.companies.push(...location.companies);
        cell.persons.push(...location.persons);
      } catch (err) {
        console.error("H3 conversion error:", err);
      }
    });

    return Array.from(cellMap.entries()).map(([h3Index, data]) => {
      // Get boundary as [lat, lng] pairs
      const boundary = cellToBoundary(h3Index).map(([lat, lng]) => [lat, lng] as [number, number]);

      return {
        h3Index,
        count: data.companies.length + data.persons.length,
        companies: data.companies,
        persons: data.persons,
        boundary,
      };
    });
  }, [locations, h3Resolution]);

  const maxCellCount = useMemo(() => {
    return Math.max(...h3Cells.map(c => c.count), 1);
  }, [h3Cells]);

  const selectedData = selectedH3Cell || selectedLocation;

  const geocodeAddress = async (address: string, signal: AbortSignal): Promise<CachedGeocode | null> => {
    const cacheKey = address.trim().toLowerCase();

    // Check cache first
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'LovableApp/1.1'
          },
          signal
        }
      );

      if (!response.ok) {
        return null;
      }

      const result = await response.json();

      if (result && result.length > 0) {
        const geocoded: CachedGeocode = {
          lat: parseFloat(result[0].lat),
          lng: parseFloat(result[0].lon),
          timestamp: Date.now()
        };
        geocodeCache.set(cacheKey, geocoded);
        // Persist to local storage
        saveGeocodeCache(geocodeCache);
        return geocoded;
      }
      return null;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error(`Failed to geocode: ${address}`, err);
      }
      return null;
    }
  };

  const startGeocoding = useCallback(async () => {
    // Cancel any ongoing geocoding
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setIsLoadingMinimized(false);
    setGeocodeProgress(0);

    // Collect all unique addresses
    const addressMap = new Map<string, { companies: Company[]; persons: Person[] }>();

    companies.forEach(company => {
      if (company.address?.trim()) {
        const key = company.address.trim().toLowerCase();
        if (!addressMap.has(key)) {
          addressMap.set(key, { companies: [], persons: [] });
        }
        addressMap.get(key)!.companies.push(company);
      }
    });

    persons.forEach(person => {
      if (person.address?.trim()) {
        const key = person.address.trim().toLowerCase();
        if (!addressMap.has(key)) {
          addressMap.set(key, { companies: [], persons: [] });
        }
        addressMap.get(key)!.persons.push(person);
      }
    });

    if (addressMap.size === 0) {
      setGeocodeStatus("No addresses to geocode");
      setIsLoading(false);
      setLocations([]);
      return;
    }

    const addressTotal = addressMap.size;
    const geocodedLocations: GeocodedLocation[] = [];
    const uncachedEntries: [string, { companies: Company[]; persons: Person[] }][] = [];
    const currentFailed: FailedLocation[] = [];

    // Step 1: Process ALL cached items immediately
    let processed = 0;
    let failed = 0;

    for (const [address, data] of addressMap) {
      const cacheKey = address.trim().toLowerCase();
      const cached = geocodeCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        geocodedLocations.push({
          address: data.companies[0]?.address || data.persons[0]?.address || address,
          lat: cached.lat,
          lng: cached.lng,
          companies: data.companies,
          persons: data.persons,
        });
        processed++;
      } else {
        uncachedEntries.push([address, data]);
      }
    }

    // Initial batch update with all cached results
    if (geocodedLocations.length > 0) {
      setLocations([...geocodedLocations]);
      setGeocodeStatus(`Loaded ${geocodedLocations.length} locations from cache...`);
      setGeocodeProgress((processed / addressTotal) * 100);

      // If everything was cached, we're done with map loading
      if (uncachedEntries.length === 0) {
        setIsLoading(false);
        setGeocodeStatus(`Done: ${geocodedLocations.length} locations mapped`);
        return;
      }
    }

    // Step 2: Process uncached items sequentially
    if (uncachedEntries.length > 0) {
      setGeocodeStatus(`Fetching ${uncachedEntries.length} new addresses...`);

      for (const [address, data] of uncachedEntries) {
        if (signal.aborted) break;

        const geocoded = await geocodeAddress(data.companies[0]?.address || data.persons[0]?.address || address, signal);

        if (geocoded) {
          geocodedLocations.push({
            address: data.companies[0]?.address || data.persons[0]?.address || address,
            lat: geocoded.lat,
            lng: geocoded.lng,
            companies: data.companies,
            persons: data.persons,
          });
        } else {
          // Fallback: Try to parse City + State from the address string
          const fullAddress = data.companies[0]?.address || data.persons[0]?.address || address;
          let fallbackSuccess = false;

          if (fullAddress && fullAddress.includes(',')) {
            const parts = fullAddress.split(',').map(p => p.trim());
            if (parts.length >= 2) {
              const cityStateFallback = parts.slice(1).join(', ');

              if (cityStateFallback && cityStateFallback !== fullAddress) {
                const fallbackGeocoded = await geocodeAddress(cityStateFallback, signal);

                if (fallbackGeocoded) {
                  geocodedLocations.push({
                    address: `${fullAddress} (Approx: ${cityStateFallback})`,
                    lat: fallbackGeocoded.lat,
                    lng: fallbackGeocoded.lng,
                    companies: data.companies,
                    persons: data.persons,
                  });
                  fallbackSuccess = true;
                }
              }
            }
          }

          if (!fallbackSuccess) {
            failed++;
            currentFailed.push({
              address: fullAddress,
              companies: data.companies,
              persons: data.persons,
              reason: "Could not locate address"
            });
          }
        }

        processed++;
        setGeocodeProgress((processed / addressTotal) * 100);
        setGeocodeStatus(`Processed ${processed}/${addressTotal} (${geocodedLocations.length} mapped, ${failed} failed)`);

        // Batch updates for new items: update every 5 items or at the end
        if (processed % 5 === 0 || processed === addressTotal) {
          setLocations([...geocodedLocations]);
          setFailedLocations([...currentFailed]);
        }

        // Rate limiting
        if (!signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!signal.aborted) {
      setLocations([...geocodedLocations]);
      setFailedLocations([...currentFailed]);
      setGeocodeStatus(`Done: ${geocodedLocations.length} locations mapped`);
      setIsLoading(false);
    }
  }, [companies, persons]);

  // Start geocoding when dialog opens
  useEffect(() => {
    if (open) {
      startGeocoding();
    } else {
      // Cleanup when dialog closes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setSelectedLocation(null);
      setSelectedH3Cell(null);
    }
  }, [open, startGeocoding]);

  // Initialize map ONLY ONCE when dialog opens
  useEffect(() => {
    if (!open) return;

    // Small timeout to ensure DOM is ready and dialog is fully rendered
    const timer = setTimeout(() => {
      if (!mapContainer.current) return;

      if (!map.current) {
        // Create map instance
        map.current = L.map(mapContainer.current);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        }).addTo(map.current);

        // Create H3 layer group
        h3LayerRef.current = L.layerGroup().addTo(map.current);
      }

      // Force map to recalculate size after render
      map.current.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      // Cleanup on modal close
      if (!open && map.current) {
        map.current.remove();
        map.current = null;
        h3LayerRef.current = null;
        markersRef.current = [];
      }
    };
  }, [open]);

  // Handle minimize/maximize of loading overlay to refresh map size
  useEffect(() => {
    if (isLoadingMinimized && map.current) {
      setTimeout(() => {
        map.current?.invalidateSize();
      }, 100);
    }
  }, [isLoadingMinimized]);

  // Update markers when locations change
  useEffect(() => {
    if (!map.current || locations.length === 0) return;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Custom marker icon
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: hsl(var(--primary));
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          border: 2px solid white;
          cursor: pointer;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    // Add markers
    locations.forEach(location => {
      const marker = L.marker([location.lat, location.lng], { icon: customIcon })
        .addTo(map.current!);

      marker.on('click', () => {
        setSelectedLocation(location);
        setSelectedH3Cell(null);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds only if we haven't fitted them yet or if it's the final update
    if (!hasFittedRef.current || locations.length === totalAddresses) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng]));
      if (locations.length === 1) {
        map.current.setView([locations[0].lat, locations[0].lng], 14);
      } else {
        map.current.fitBounds(bounds, { padding: [50, 50] });
      }
      if (locations.length > 0) hasFittedRef.current = true;
    }
  }, [locations, totalAddresses]);

  // Update H3 overlay when cells change or toggle changes
  useEffect(() => {
    if (!h3LayerRef.current || !map.current) return;

    // Clear existing H3 polygons
    h3LayerRef.current.clearLayers();

    if (!showH3Overlay || h3Cells.length === 0) return;

    // Add H3 hexagon polygons
    h3Cells.forEach(cell => {
      const color = getHexColor(cell.count, maxCellCount);

      const polygon = L.polygon(cell.boundary, {
        color: color,
        fillColor: color,
        fillOpacity: 0.4,
        weight: 2,
        opacity: 0.8,
      });

      polygon.bindTooltip(`${cell.count} contact${cell.count !== 1 ? 's' : ''}`, {
        permanent: false,
        direction: 'center',
      });

      polygon.on('click', () => {
        setSelectedH3Cell(cell);
        setSelectedLocation(null);
      });

      polygon.addTo(h3LayerRef.current!);
    });
  }, [h3Cells, showH3Overlay, maxCellCount]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={totalAddresses === 0}>
          <MapPin className="mr-2 h-4 w-4" />
          Map ({totalAddresses})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Contacts & Companies Map
            </DialogTitle>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={startGeocoding}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {failedLocations.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowFailedDialog(true)}
                >
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Failed ({failedLocations.length})
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  id="h3-toggle"
                  checked={showH3Overlay}
                  onCheckedChange={setShowH3Overlay}
                />
                <Label htmlFor="h3-toggle" className="flex items-center gap-1 text-sm cursor-pointer">
                  <Hexagon className="h-4 w-4" />
                  H3 Heatmap
                </Label>
              </div>
              {showH3Overlay && (
                <select
                  value={h3Resolution}
                  onChange={(e) => setH3Resolution(Number(e.target.value))}
                  className="text-sm border rounded px-2 py-1 bg-background"
                >
                  <option value={5}>Large Cells</option>
                  <option value={6}>Medium-Large</option>
                  <option value={7}>Medium</option>
                  <option value={8}>Medium-Small</option>
                  <option value={9}>Small Cells</option>
                </select>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Map Container */}
          <div className="flex-1 relative">
            {/* Map Container - Always render to ensure ref is available */}
            <div ref={mapContainer} className="absolute inset-0" />

            {/* Loading overlay - shown on top of map or as placeholder */}
            {isLoading && !isLoadingMinimized && (
              <div className={`absolute inset-0 flex items-center justify-center ${locations.length > 0 ? 'bg-background/80' : 'bg-muted'}`}>
                <div className="flex flex-col items-center gap-4 max-w-md px-8 bg-card p-6 rounded-lg shadow-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground text-center">{geocodeStatus}</p>
                  <Progress value={geocodeProgress} className="w-full" />
                  {locations.length > 0 ? (
                    <button
                      onClick={() => setIsLoadingMinimized(true)}
                      className="text-xs text-primary hover:underline text-center cursor-pointer"
                    >
                      {locations.length} locations shown. Click to view map while processing...
                    </button>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">
                      First load may take a while. Addresses are cached for 24 hours.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Minimized Loading Indicator */}
            {isLoading && isLoadingMinimized && (
              <div className="absolute bottom-4 right-4 z-[5000] bg-card border rounded-lg shadow-lg p-3 w-64 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs font-medium">Processing...</span>
                  <button
                    onClick={() => setIsLoadingMinimized(false)}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    Expand
                  </button>
                </div>
                <Progress value={geocodeProgress} className="h-1.5 w-full" />
                <p className="text-[10px] text-muted-foreground mt-1 truncate">
                  {geocodeStatus}
                </p>
              </div>
            )}

            {/* Empty state - only when not loading and no locations */}
            {!isLoading && locations.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="flex flex-col items-center gap-2 text-center px-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No valid addresses found to display on the map
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {geocodeStatus}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Location Summary Panel */}
          {selectedData && (
            <div className="w-80 border-l bg-card flex flex-col">
              <div className="p-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm truncate flex-1">
                  {selectedH3Cell ? `Region (${selectedH3Cell.count} contacts)` : selectedLocation?.address}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => { setSelectedLocation(null); setSelectedH3Cell(null); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {/* Companies at this location */}
                  {selectedData.companies.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Companies ({selectedData.companies.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedData.companies.map(company => (
                          <CompanyDetailDialog
                            key={company.id}
                            company={company}
                            persons={persons.filter(p => p.companyId === company.id)}
                            onPersonClick={() => { }}
                            onUpdate={onRefresh}
                          >
                            <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{company.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {persons.filter(p => p.companyId === company.id).length} contacts
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </CompanyDetailDialog>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Persons at this location */}
                  {selectedData.persons.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Contacts ({selectedData.persons.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedData.persons.map(person => (
                          <PersonDetailDialog
                            key={person.id}
                            person={person}
                            companyName={getCompanyName(person.companyId)}
                            onUpdate={onRefresh}
                          >
                            <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{person.name}</p>
                                    {person.companyId && (
                                      <Badge variant="secondary" className="text-xs truncate max-w-full">
                                        {getCompanyName(person.companyId)}
                                      </Badge>
                                    )}
                                    {person.jobTitle && (
                                      <p className="text-xs text-muted-foreground truncate">{person.jobTitle}</p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </PersonDetailDialog>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t text-xs text-muted-foreground flex justify-between items-center">
          <span>
            Showing {locations.length} location{locations.length !== 1 ? "s" : ""} •
            Click a marker or hexagon to see details
          </span>
          {showH3Overlay && locations.length > 0 && (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded" style={{ background: getHexColor(1, maxCellCount) }} />
              Low
              <span className="w-3 h-3 rounded" style={{ background: getHexColor(maxCellCount, maxCellCount) }} />
              High density
            </span>
          )}
        </div>
      </DialogContent>

      {/* Failed Locations Dialog */}
      <Dialog open={showFailedDialog} onOpenChange={setShowFailedDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Failed Addresses
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <p className="text-sm text-muted-foreground mb-4">
              The following addresses could not be located. Please check for typos or missing information.
            </p>
            <div className="space-y-4">
              {failedLocations.map((fail, i) => (
                <Card key={i} className="bg-muted/50">
                  <CardContent className="p-3">
                    <p className="font-medium text-sm text-destructive mb-1">{fail.address}</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {fail.companies.map(c => (
                        <CompanyDetailDialog
                          key={c.id}
                          company={c}
                          persons={persons.filter(p => p.companyId === c.id)}
                          onPersonClick={() => { }}
                          onUpdate={onRefresh}
                        >
                          <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors p-1 rounded hover:bg-background/50">
                            <Building2 className="h-3 w-3" />
                            <span className="underline decoration-dotted">{c.name}</span>
                          </div>
                        </CompanyDetailDialog>
                      ))}
                      {fail.persons.map(p => (
                        <PersonDetailDialog
                          key={p.id}
                          person={p}
                          companyName={getCompanyName(p.companyId)}
                          onUpdate={onRefresh}
                        >
                          <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors p-1 rounded hover:bg-background/50">
                            <User className="h-3 w-3" />
                            <span className="underline decoration-dotted">{p.name}</span>
                          </div>
                        </PersonDetailDialog>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
