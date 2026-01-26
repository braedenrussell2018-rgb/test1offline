import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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
import { MapPin, Building2, User, X, Loader2, AlertCircle, Hexagon, Navigation } from "lucide-react";
import { Company, Person } from "@/lib/inventory-storage";
import { PersonDetailDialog } from "./PersonDetailDialog";
import { CompanyDetailDialog } from "./CompanyDetailDialog";
import {
  groupLocationsByH3,
  getHexagonColor,
  getHexagonOpacity,
  getResolutionForZoom,
  H3Location,
  H3Cell,
} from "@/lib/h3-utils";

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

type ViewMode = "hexagons" | "markers";

// Fix for default marker icons in Leaflet with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export function ContactsMapDialog({ companies, persons, onRefresh }: ContactsMapDialogProps) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<GeocodedLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GeocodedLocation | null>(null);
  const [selectedCell, setSelectedCell] = useState<H3Cell | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("hexagons");
  const [h3Resolution, setH3Resolution] = useState(7);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const hexagonsRef = useRef<L.Polygon[]>([]);

  const getCompanyName = useCallback((companyId?: string) => {
    if (!companyId) return "No Company";
    const company = companies.find(c => c.id === companyId);
    return company?.name || "Unknown Company";
  }, [companies]);

  // Geocode addresses when dialog opens using Nominatim (OpenStreetMap)
  useEffect(() => {
    if (!open) return;

    const geocodeAddresses = async () => {
      setIsLoading(true);
      
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
        setLocations([]);
        setIsLoading(false);
        return;
      }

      const geocodedLocations: GeocodedLocation[] = [];
      const failedAddresses: string[] = [];
      
      for (const [address, data] of addressMap) {
        try {
          // Use Nominatim (OpenStreetMap) geocoding API - free, no API key required
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `format=json&q=${encodeURIComponent(address)}&limit=1`,
            {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'LovableApp/1.0'
              }
            }
          );
          const result = await response.json();
          
          if (result && result.length > 0) {
            const lat = parseFloat(result[0].lat);
            const lng = parseFloat(result[0].lon);
            geocodedLocations.push({
              address: data.companies[0]?.address || data.persons[0]?.address || address,
              lat,
              lng,
              companies: data.companies,
              persons: data.persons,
            });
          } else {
            failedAddresses.push(address);
          }
          
          // Small delay to respect Nominatim rate limits (1 request per second)
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`Failed to geocode: ${address}`, err);
          failedAddresses.push(address);
        }
      }
      
      if (failedAddresses.length > 0) {
        console.log(`Could not geocode ${failedAddresses.length} addresses:`, failedAddresses);
      }
      
      setLocations(geocodedLocations);
      setIsLoading(false);
    };

    geocodeAddresses();
  }, [open, companies, persons]);

  // Clear hexagons helper
  const clearHexagons = useCallback(() => {
    hexagonsRef.current.forEach(hex => hex.remove());
    hexagonsRef.current = [];
  }, []);

  // Clear markers helper
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  }, []);

  // Render hexagons on the map
  const renderHexagons = useCallback(() => {
    if (!map.current || locations.length === 0) return;

    clearHexagons();

    // Convert locations to H3Location format
    const h3Locations: H3Location[] = locations.map(loc => ({
      lat: loc.lat,
      lng: loc.lng,
      address: loc.address,
      companies: loc.companies,
      persons: loc.persons,
    }));

    // Group by H3 cells
    const cells = groupLocationsByH3(h3Locations, h3Resolution);
    
    // Find max count for color scaling
    const maxCount = Math.max(...Array.from(cells.values()).map(c => c.count));

    // Create hexagon polygons
    cells.forEach((cell) => {
      const color = getHexagonColor(cell.count, maxCount);
      const opacity = getHexagonOpacity(cell.count, maxCount);

      const hexagon = L.polygon(cell.polygon, {
        fillColor: color,
        fillOpacity: opacity,
        color: 'white',
        weight: 2,
        opacity: 0.8,
      }).addTo(map.current!);

      // Add hover effect
      hexagon.on('mouseover', () => {
        hexagon.setStyle({
          weight: 3,
          color: 'hsl(var(--primary))',
          fillOpacity: opacity + 0.2,
        });
      });

      hexagon.on('mouseout', () => {
        hexagon.setStyle({
          weight: 2,
          color: 'white',
          fillOpacity: opacity,
        });
      });

      // Click to show details
      hexagon.on('click', () => {
        setSelectedLocation(null);
        setSelectedCell(cell);
      });

      // Add tooltip with count
      hexagon.bindTooltip(`${cell.count} contact${cell.count !== 1 ? 's' : ''}`, {
        permanent: false,
        direction: 'center',
        className: 'h3-tooltip',
      });

      hexagonsRef.current.push(hexagon);
    });
  }, [locations, h3Resolution, clearHexagons]);

  // Render markers on the map
  const renderMarkers = useCallback(() => {
    if (!map.current || locations.length === 0) return;

    clearMarkers();

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
        setSelectedCell(null);
        setSelectedLocation(location);
      });

      markersRef.current.push(marker);
    });
  }, [locations, clearMarkers]);

  // Initialize map when locations are ready
  useEffect(() => {
    if (!open || !mapContainer.current || locations.length === 0) return;

    // Clean up existing map
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
    markersRef.current = [];
    hexagonsRef.current = [];

    // Create map
    map.current = L.map(mapContainer.current);

    // Add OpenStreetMap tiles (free, no API key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map.current);

    // Calculate bounds and fit map
    const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng]));
    
    if (locations.length === 1) {
      map.current.setView([locations[0].lat, locations[0].lng], 14);
    } else {
      map.current.fitBounds(bounds, { padding: [50, 50] });
    }

    // Update H3 resolution based on zoom
    map.current.on('zoomend', () => {
      const zoom = map.current?.getZoom() || 10;
      const newResolution = getResolutionForZoom(zoom);
      if (newResolution !== h3Resolution) {
        setH3Resolution(newResolution);
      }
    });

    // Initial render based on view mode
    if (viewMode === 'hexagons') {
      renderHexagons();
    } else {
      renderMarkers();
    }

    return () => {
      clearMarkers();
      clearHexagons();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [locations, open]);

  // Update visualization when view mode or resolution changes
  useEffect(() => {
    if (!map.current || locations.length === 0) return;

    if (viewMode === 'hexagons') {
      clearMarkers();
      renderHexagons();
    } else {
      clearHexagons();
      renderMarkers();
    }
  }, [viewMode, h3Resolution, renderHexagons, renderMarkers, clearMarkers, clearHexagons, locations]);

  const totalAddresses = new Set([
    ...companies.filter(c => c.address?.trim()).map(c => c.address!.trim().toLowerCase()),
    ...persons.filter(p => p.address?.trim()).map(p => p.address!.trim().toLowerCase()),
  ]).size;

  // Get all companies and persons from selected cell
  const selectedCellCompanies = selectedCell?.locations.flatMap(l => l.companies) || [];
  const selectedCellPersons = selectedCell?.locations.flatMap(l => l.persons) || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={totalAddresses === 0}>
          <MapPin className="mr-2 h-4 w-4" />
          Map
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Contacts & Companies Map
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'hexagons' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('hexagons')}
              >
                <Hexagon className="mr-1 h-4 w-4" />
                Hexagons
              </Button>
              <Button
                variant={viewMode === 'markers' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('markers')}
              >
                <Navigation className="mr-1 h-4 w-4" />
                Markers
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Map Container */}
          <div className="flex-1 relative">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading map...</p>
                </div>
              </div>
            ) : locations.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="flex flex-col items-center gap-2 text-center px-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No valid addresses found to display on the map
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div ref={mapContainer} className="absolute inset-0" />
                
                {/* Legend for hexagon view */}
                {viewMode === 'hexagons' && (
                  <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border z-[1000]">
                    <p className="text-xs font-medium mb-2">Density</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(210, 80%, 70%)' }} />
                        <span className="text-xs text-muted-foreground">1 contact</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(210, 80%, 52%)' }} />
                        <span className="text-xs text-muted-foreground">2-5 contacts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(210, 80%, 35%)' }} />
                        <span className="text-xs text-muted-foreground">6+ contacts</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Location Summary Panel - for marker view */}
          {viewMode === 'markers' && selectedLocation && (
            <div className="w-80 border-l bg-card flex flex-col">
              <div className="p-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm truncate flex-1">{selectedLocation.address}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedLocation(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {/* Companies at this location */}
                  {selectedLocation.companies.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Companies ({selectedLocation.companies.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedLocation.companies.map(company => (
                          <CompanyDetailDialog
                            key={company.id}
                            company={company}
                            persons={persons.filter(p => p.companyId === company.id)}
                            onPersonClick={() => {}}
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
                  {selectedLocation.persons.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Contacts ({selectedLocation.persons.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedLocation.persons.map(person => (
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

          {/* Cell Summary Panel - for hexagon view */}
          {viewMode === 'hexagons' && selectedCell && (
            <div className="w-80 border-l bg-card flex flex-col">
              <div className="p-3 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Area Details</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedCell.count} contact{selectedCell.count !== 1 ? 's' : ''} in this area
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedCell(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {/* Companies in this cell */}
                  {selectedCellCompanies.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Companies ({selectedCellCompanies.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedCellCompanies.map(company => (
                          <CompanyDetailDialog
                            key={company.id}
                            company={company}
                            persons={persons.filter(p => p.companyId === company.id)}
                            onPersonClick={() => {}}
                            onUpdate={onRefresh}
                          >
                            <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{company.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{company.address}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </CompanyDetailDialog>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Persons in this cell */}
                  {selectedCellPersons.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Contacts ({selectedCellPersons.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedCellPersons.map(person => (
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
        <div className="p-3 border-t text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {viewMode === 'hexagons' 
              ? `Showing ${hexagonsRef.current.length} hexagon${hexagonsRef.current.length !== 1 ? 's' : ''}`
              : `Showing ${locations.length} location${locations.length !== 1 ? 's' : ''}`
            } • Click to see details
          </span>
          {viewMode === 'hexagons' && (
            <span className="text-muted-foreground">
              H3 Resolution: {h3Resolution}
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
