import { useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, X, GripVertical, Navigation, Trash2, Clock, Route as RouteIcon, Loader2 } from "lucide-react";
import { GeocodedLocation } from "@/hooks/useContactsMap";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";

export interface RouteStop {
  location: GeocodedLocation;
  label: string;
}

export interface RoutePlannerHandle {
  addStop: (location: GeocodedLocation) => void;
}

interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
  geometry: { coordinates: [number, number][] };
}

interface RoutePlannerProps {
  locations: GeocodedLocation[];
  map: React.RefObject<L.Map | null>;
  routeLayerRef: React.RefObject<L.LayerGroup | null>;
  getCompanyName: (companyId?: string) => string;
}

export const RoutePlanner = forwardRef<RoutePlannerHandle, RoutePlannerProps>(function RoutePlanner({ locations, map, routeLayerRef, getCompanyName }, ref) {
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const clearRouteFromMap = useCallback(() => {
    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers();
    }
  }, [routeLayerRef]);

  const addStop = useCallback((location: GeocodedLocation) => {
    const label = location.companies.length > 0
      ? location.companies[0].name
      : location.persons.length > 0
        ? location.persons[0].name
        : location.address;
    setStops(prev => [...prev, { location, label }]);
    setRouteInfo(null);
    clearRouteFromMap();
  }, [clearRouteFromMap]);

  useImperativeHandle(ref, () => ({ addStop }), [addStop]);

  const removeStop = useCallback((index: number) => {
    setStops(prev => prev.filter((_, i) => i !== index));
    setRouteInfo(null);
    clearRouteFromMap();
  }, []);

  const clearAllStops = useCallback(() => {
    setStops([]);
    setRouteInfo(null);
    clearRouteFromMap();
  }, []);


  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setStops(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
    setDragIndex(index);
    setRouteInfo(null);
    clearRouteFromMap();
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const calculateRoute = useCallback(async () => {
    if (stops.length < 2) return;
    setIsCalculating(true);

    try {
      const coordinates = stops.map(s => [s.location.lng, s.location.lat]);

      const { data, error } = await supabase.functions.invoke('route-proxy', {
        body: { coordinates },
      });

      if (error) throw error;

      if (data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0];
        const info: RouteInfo = {
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry,
        };
        setRouteInfo(info);
        drawRouteOnMap(info);
      } else {
        console.error('OSRM error:', data);
      }
    } catch (err) {
      console.error('Route calculation failed:', err);
    } finally {
      setIsCalculating(false);
    }
  }, [stops]);

  const drawRouteOnMap = useCallback((info: RouteInfo) => {
    if (!routeLayerRef.current || !map.current) return;
    routeLayerRef.current.clearLayers();

    // Draw the route polyline
    const coords = info.geometry.coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
    const polyline = L.polyline(coords, {
      color: 'hsl(220, 70%, 50%)',
      weight: 5,
      opacity: 0.8,
      dashArray: undefined,
    });
    polyline.addTo(routeLayerRef.current);

    // Add numbered stop markers
    stops.forEach((stop, i) => {
      const icon = L.divIcon({
        className: 'route-stop-marker',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:hsl(220,70%,50%);border-radius:50%;color:white;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${i + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([stop.location.lat, stop.location.lng], { icon }).addTo(routeLayerRef.current!);
    });

    // Fit bounds to route
    map.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  }, [stops, map, routeLayerRef]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDistance = (meters: number) => {
    const miles = meters / 1609.344;
    return `${miles.toFixed(1)} mi`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-1">
          <RouteIcon className="h-4 w-4" /> Route Planner
        </h3>
        {stops.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAllStops}>
            Clear All
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {stops.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Click markers on the map to add stops to your route, or use the search to find locations.
            </p>
          )}

          {stops.map((stop, i) => (
            <div
              key={`${stop.location.lat}-${stop.location.lng}-${i}`}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/30 transition-colors cursor-grab active:cursor-grabbing ${dragIndex === i ? 'opacity-50' : ''}`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <Badge variant="outline" className="h-6 w-6 p-0 flex items-center justify-center shrink-0 text-xs font-bold">
                {i + 1}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{stop.label}</p>
                <p className="text-xs text-muted-foreground truncate">{stop.location.address}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeStop(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {stops.length >= 2 && (
        <div className="p-3 border-t space-y-2">
          <Button
            className="w-full"
            size="sm"
            onClick={calculateRoute}
            disabled={isCalculating}
          >
            {isCalculating ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Calculating...</>
            ) : (
              <><Navigation className="h-4 w-4 mr-1" /> Calculate Route</>
            )}
          </Button>

          {routeInfo && (
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
              <span className="flex items-center gap-1">
                <RouteIcon className="h-3 w-3" /> {formatDistance(routeInfo.distance)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatDuration(routeInfo.duration)}
              </span>
            </div>
          )}
        </div>
      )}

      {stops.length === 1 && (
        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground text-center">Add at least one more stop to calculate a route.</p>
        </div>
      )}
    </div>
  );
});
