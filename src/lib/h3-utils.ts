import { latLngToCell, cellToBoundary, gridDisk } from "h3-js";

export interface H3Location {
  lat: number;
  lng: number;
  address: string;
  companies: any[];
  persons: any[];
}

export interface H3Cell {
  h3Index: string;
  polygon: [number, number][];
  locations: H3Location[];
  count: number;
}

/**
 * Convert lat/lng coordinates to H3 cell index
 */
export function latLngToH3(lat: number, lng: number, resolution: number = 7): string {
  return latLngToCell(lat, lng, resolution);
}

/**
 * Convert H3 cell index to polygon coordinates for Leaflet
 * Returns array of [lat, lng] pairs
 */
export function h3ToPolygon(h3Index: string): [number, number][] {
  const boundary = cellToBoundary(h3Index);
  // H3 returns [lat, lng] pairs, which is what Leaflet expects
  return boundary.map(([lat, lng]) => [lat, lng] as [number, number]);
}

/**
 * Group locations by H3 cell
 */
export function groupLocationsByH3(
  locations: H3Location[],
  resolution: number = 7
): Map<string, H3Cell> {
  const cells = new Map<string, H3Cell>();

  for (const location of locations) {
    const h3Index = latLngToH3(location.lat, location.lng, resolution);
    
    if (cells.has(h3Index)) {
      const cell = cells.get(h3Index)!;
      cell.locations.push(location);
      cell.count = cell.locations.reduce(
        (sum, loc) => sum + loc.companies.length + loc.persons.length,
        0
      );
    } else {
      cells.set(h3Index, {
        h3Index,
        polygon: h3ToPolygon(h3Index),
        locations: [location],
        count: location.companies.length + location.persons.length,
      });
    }
  }

  return cells;
}

/**
 * Get hexagon fill color based on count (density)
 * Uses HSL for consistent theming
 */
export function getHexagonColor(count: number, maxCount: number): string {
  // Normalize count to 0-1 range
  const normalized = Math.min(count / Math.max(maxCount, 1), 1);
  
  // Blue gradient: light to dark
  // Lightness ranges from 70% (light) to 35% (dark)
  const lightness = 70 - (normalized * 35);
  
  return `hsl(210, 80%, ${lightness}%)`;
}

/**
 * Get hexagon opacity based on count
 */
export function getHexagonOpacity(count: number, maxCount: number): number {
  const normalized = Math.min(count / Math.max(maxCount, 1), 1);
  // Opacity ranges from 0.4 to 0.8
  return 0.4 + (normalized * 0.4);
}

/**
 * Get appropriate H3 resolution based on zoom level
 */
export function getResolutionForZoom(zoom: number): number {
  if (zoom <= 5) return 3;
  if (zoom <= 7) return 4;
  if (zoom <= 9) return 5;
  if (zoom <= 11) return 6;
  if (zoom <= 13) return 7;
  if (zoom <= 15) return 8;
  return 9;
}

/**
 * Get density label for legend
 */
export function getDensityLabel(count: number): string {
  if (count === 1) return "1 contact";
  if (count <= 5) return "2-5 contacts";
  if (count <= 10) return "6-10 contacts";
  return "10+ contacts";
}
