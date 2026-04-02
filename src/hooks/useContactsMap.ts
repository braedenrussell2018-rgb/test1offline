import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { latLngToCell, cellToBoundary } from "h3-js";
import { Company, Person } from "@/lib/inventory-storage";
import { supabase } from "@/integrations/supabase/client";

export interface GeocodedLocation {
  address: string;
  lat: number;
  lng: number;
  companies: Company[];
  persons: Person[];
}

export interface H3Cell {
  h3Index: string;
  count: number;
  companies: Company[];
  persons: Person[];
  boundary: [number, number][];
}

export interface FailedLocation {
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
export const getHexColor = (count: number, maxCount: number): string => {
  const ratio = Math.min(count / Math.max(maxCount, 1), 1);
  const hue = (1 - ratio) * 240;
  return `hsl(${hue}, 70%, 50%)`;
};

// Geocode cache persistence
const CACHE_KEY = "crm_geocode_cache";
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const loadGeocodeCache = (): Map<string, CachedGeocode> => {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (!saved) return new Map();
    const parsed = JSON.parse(saved);
    const now = Date.now();
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

const geocodeCache = loadGeocodeCache();

interface UseContactsMapOptions {
  companies: Company[];
  persons: Person[];
  active: boolean; // whether the map is currently visible (dialog open or page mounted)
}

export function useContactsMap({ companies, persons, active }: UseContactsMapOptions) {
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
  const [h3Resolution, setH3Resolution] = useState(7);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const h3LayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasFittedRef = useRef(false);

  const getCompanyName = useCallback((companyId?: string) => {
    if (!companyId) return "No Company";
    const company = companies.find(c => c.id === companyId);
    return company?.name || "Unknown Company";
  }, [companies]);

  const totalAddresses = useMemo(() => new Set([
    ...companies.filter(c => c.address?.trim()).map(c => c.address!.trim().toLowerCase()),
    ...persons.filter(p => p.address?.trim()).map(p => p.address!.trim().toLowerCase()),
  ]).size, [companies, persons]);

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

  const maxCellCount = useMemo(() => Math.max(...h3Cells.map(c => c.count), 1), [h3Cells]);

  const selectedData = selectedH3Cell || selectedLocation;

  const geocodeAddress = async (address: string, signal: AbortSignal): Promise<CachedGeocode | null> => {
    const cacheKey = address.trim().toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached;
    }
    try {
      const { data, error } = await supabase.functions.invoke('geocode-proxy', {
        body: { address: address.trim() },
      });
      if (signal.aborted) return null;
      if (error) return null;
      if (data && data.lat != null && data.lng != null) {
        const geocoded: CachedGeocode = { lat: data.lat, lng: data.lng, timestamp: Date.now() };
        geocodeCache.set(cacheKey, geocoded);
        saveGeocodeCache(geocodeCache);
        return geocoded;
      }
      return null;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(`Failed to geocode: ${address}`, err);
      return null;
    }
  };

  const startGeocoding = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    setIsLoading(true);
    setIsLoadingMinimized(false);
    setGeocodeProgress(0);

    const addressMap = new Map<string, { companies: Company[]; persons: Person[] }>();
    companies.forEach(company => {
      if (company.address?.trim()) {
        const key = company.address.trim().toLowerCase();
        if (!addressMap.has(key)) addressMap.set(key, { companies: [], persons: [] });
        addressMap.get(key)!.companies.push(company);
      }
    });
    persons.forEach(person => {
      if (person.address?.trim()) {
        const key = person.address.trim().toLowerCase();
        if (!addressMap.has(key)) addressMap.set(key, { companies: [], persons: [] });
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
    let processed = 0;
    let failed = 0;

    for (const [address, data] of addressMap) {
      const cacheKey = address.trim().toLowerCase();
      const cached = geocodeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        geocodedLocations.push({
          address: data.companies[0]?.address || data.persons[0]?.address || address,
          lat: cached.lat, lng: cached.lng,
          companies: data.companies, persons: data.persons,
        });
        processed++;
      } else {
        uncachedEntries.push([address, data]);
      }
    }

    if (geocodedLocations.length > 0) {
      setLocations([...geocodedLocations]);
      setGeocodeStatus(`Loaded ${geocodedLocations.length} locations from cache...`);
      setGeocodeProgress((processed / addressTotal) * 100);
      if (uncachedEntries.length === 0) {
        setIsLoading(false);
        setGeocodeStatus(`Done: ${geocodedLocations.length} locations mapped`);
        return;
      }
    }

    if (uncachedEntries.length > 0) {
      setGeocodeStatus(`Fetching ${uncachedEntries.length} new addresses...`);
      for (const [address, data] of uncachedEntries) {
        if (signal.aborted) break;
        const geocoded = await geocodeAddress(data.companies[0]?.address || data.persons[0]?.address || address, signal);
        if (geocoded) {
          geocodedLocations.push({
            address: data.companies[0]?.address || data.persons[0]?.address || address,
            lat: geocoded.lat, lng: geocoded.lng,
            companies: data.companies, persons: data.persons,
          });
        } else {
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
                    lat: fallbackGeocoded.lat, lng: fallbackGeocoded.lng,
                    companies: data.companies, persons: data.persons,
                  });
                  fallbackSuccess = true;
                }
              }
            }
          }
          if (!fallbackSuccess) {
            failed++;
            currentFailed.push({ address: fullAddress, companies: data.companies, persons: data.persons, reason: "Could not locate address" });
          }
        }
        processed++;
        setGeocodeProgress((processed / addressTotal) * 100);
        setGeocodeStatus(`Processed ${processed}/${addressTotal} (${geocodedLocations.length} mapped, ${failed} failed)`);
        if (processed % 5 === 0 || processed === addressTotal) {
          setLocations([...geocodedLocations]);
          setFailedLocations([...currentFailed]);
        }
        if (!signal.aborted) await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!signal.aborted) {
      setLocations([...geocodedLocations]);
      setFailedLocations([...currentFailed]);
      setGeocodeStatus(`Done: ${geocodedLocations.length} locations mapped`);
      setIsLoading(false);
    }
  }, [companies, persons]);

  // Start geocoding when active
  useEffect(() => {
    if (active) {
      startGeocoding();
    } else {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setSelectedLocation(null);
      setSelectedH3Cell(null);
    }
  }, [active, startGeocoding]);

  // Initialize map
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      if (!mapContainer.current) return;
      if (!map.current) {
        map.current = L.map(mapContainer.current);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        }).addTo(map.current);
        h3LayerRef.current = L.layerGroup().addTo(map.current);
        routeLayerRef.current = L.layerGroup().addTo(map.current);
      }
      map.current.invalidateSize();
    }, 100);
    return () => {
      clearTimeout(timer);
      if (!active && map.current) {
        map.current.remove();
        map.current = null;
        h3LayerRef.current = null;
        markersRef.current = [];
      }
    };
  }, [active]);

  // Resize handling
  useEffect(() => {
    if (isLoadingMinimized && map.current) {
      setTimeout(() => map.current?.invalidateSize(), 100);
    }
  }, [isLoadingMinimized]);

  // Update markers
  useEffect(() => {
    if (!map.current || locations.length === 0) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:hsl(var(--primary));border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;cursor:pointer;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    locations.forEach(location => {
      const marker = L.marker([location.lat, location.lng], { icon: customIcon }).addTo(map.current!);
      marker.on('click', () => { setSelectedLocation(location); setSelectedH3Cell(null); });
      markersRef.current.push(marker);
    });
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

  // Update H3 overlay
  useEffect(() => {
    if (!h3LayerRef.current || !map.current) return;
    h3LayerRef.current.clearLayers();
    if (!showH3Overlay || h3Cells.length === 0) return;
    h3Cells.forEach(cell => {
      const color = getHexColor(cell.count, maxCellCount);
      const polygon = L.polygon(cell.boundary, { color, fillColor: color, fillOpacity: 0.4, weight: 2, opacity: 0.8, bubblingMouseEvents: true });
      polygon.bindTooltip(`${cell.count} contact${cell.count !== 1 ? 's' : ''}`, { permanent: false, direction: 'center' });
      polygon.on('click', () => { setSelectedH3Cell(cell); setSelectedLocation(null); });
      polygon.addTo(h3LayerRef.current!);
    });
  }, [h3Cells, showH3Overlay, maxCellCount]);

  const invalidateSize = useCallback(() => {
    setTimeout(() => map.current?.invalidateSize(), 100);
  }, []);

  const cleanup = useCallback(() => {
    if (map.current) {
      map.current.remove();
      map.current = null;
      h3LayerRef.current = null;
      routeLayerRef.current = null;
      markersRef.current = [];
    }
  }, []);

  return {
    // State
    locations,
    selectedLocation,
    setSelectedLocation,
    selectedH3Cell,
    setSelectedH3Cell,
    selectedData,
    failedLocations,
    showFailedDialog,
    setShowFailedDialog,
    isLoading,
    isLoadingMinimized,
    setIsLoadingMinimized,
    geocodeProgress,
    geocodeStatus,
    showH3Overlay,
    setShowH3Overlay,
    h3Resolution,
    setH3Resolution,
    totalAddresses,
    maxCellCount,
    // Refs
    mapContainer,
    map,
    routeLayerRef,
    // Actions
    startGeocoding,
    getCompanyName,
    invalidateSize,
    cleanup,
  };
}
