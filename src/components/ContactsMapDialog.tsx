import { useState, useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
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
import { MapPin, Building2, User, X, Loader2, AlertCircle } from "lucide-react";
import { Company, Person } from "@/lib/inventory-storage";
import { PersonDetailDialog } from "./PersonDetailDialog";
import { CompanyDetailDialog } from "./CompanyDetailDialog";
import { supabase } from "@/integrations/supabase/client";

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

export function ContactsMapDialog({ companies, persons, onRefresh }: ContactsMapDialogProps) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<GeocodedLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GeocodedLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const getCompanyName = useCallback((companyId?: string) => {
    if (!companyId) return "No Company";
    const company = companies.find(c => c.id === companyId);
    return company?.name || "Unknown Company";
  }, [companies]);

  // Fetch Mapbox token from edge function
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data?.token || null);
      } catch (err) {
        console.error('Failed to fetch Mapbox token:', err);
        setMapboxToken(null);
      } finally {
        setTokenLoading(false);
      }
    };
    fetchToken();
  }, []);

  // Geocode addresses when dialog opens
  useEffect(() => {
    if (!open || !mapboxToken) return;

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
          // Use more lenient search types and fuzzy matching
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&limit=1&fuzzyMatch=true&types=address,place,locality,neighborhood,postcode,region`
          );
          const result = await response.json();
          
          if (result.features && result.features.length > 0) {
            const [lng, lat] = result.features[0].center;
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
  }, [open, companies, persons, mapboxToken]);

  // Initialize map when locations are ready
  useEffect(() => {
    if (!open || !mapContainer.current || !mapboxToken || locations.length === 0) return;

    // Clean up existing map
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
    markersRef.current = [];

    mapboxgl.accessToken = mapboxToken;

    // Calculate bounds
    const bounds = new mapboxgl.LngLatBounds();
    locations.forEach(loc => bounds.extend([loc.lng, loc.lat]));

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      bounds: locations.length > 1 ? bounds : undefined,
      center: locations.length === 1 ? [locations[0].lng, locations[0].lat] : undefined,
      zoom: locations.length === 1 ? 14 : undefined,
      fitBoundsOptions: { padding: 50 },
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Add markers
    locations.forEach(location => {
      const el = document.createElement("div");
      el.className = "cursor-pointer";
      el.innerHTML = `
        <div class="flex items-center justify-center w-8 h-8 bg-primary rounded-full shadow-lg border-2 border-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      `;

      el.addEventListener("click", () => {
        setSelectedLocation(location);
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.lng, location.lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [locations, open, mapboxToken]);

  const totalAddresses = new Set([
    ...companies.filter(c => c.address?.trim()).map(c => c.address!.trim().toLowerCase()),
    ...persons.filter(p => p.address?.trim()).map(p => p.address!.trim().toLowerCase()),
  ]).size;

  if (tokenLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Map
      </Button>
    );
  }

  if (!mapboxToken) {
    return (
      <Button variant="outline" disabled>
        <MapPin className="mr-2 h-4 w-4" />
        Map (No Token)
      </Button>
    );
  }

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
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Contacts & Companies Map
          </DialogTitle>
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
              <div ref={mapContainer} className="absolute inset-0" />
            )}
          </div>

          {/* Location Summary Panel */}
          {selectedLocation && (
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
        </div>

        {/* Footer */}
        <div className="p-3 border-t text-xs text-muted-foreground">
          Showing {locations.length} location{locations.length !== 1 ? "s" : ""} • 
          Click a marker to see details
        </div>
      </DialogContent>
    </Dialog>
  );
}