
# Plan: Add H3 Hexagonal Visualization to Leaflet Map

## Overview

Enhance the existing Leaflet map with H3 hexagonal clustering while keeping the current infrastructure. This approach:
- **Keeps Leaflet** (already installed and working)
- **Adds H3** for hexagonal spatial indexing
- **Shows hexagons instead of point markers** for better density visualization
- **Remains fully open-source** with no API keys required

## What You'll See

- Contacts/companies grouped into hexagonal cells on the map
- Hexagon colors indicate density (more contacts = darker color)
- Click a hexagon to see all contacts/companies in that area
- Toggle between hexagon view and traditional marker view

---

## Phase 1: Install H3 Library

### Add dependency:
```
h3-js - Uber's open-source hexagonal hierarchical spatial index
```

This is the only new package needed since Leaflet is already installed.

---

## Phase 2: Create H3 Utility Functions

### New file: `src/lib/h3-utils.ts`

Utility functions to handle H3 operations:

| Function | Purpose |
|----------|---------|
| `latLngToH3(lat, lng, resolution)` | Convert coordinates to H3 cell index |
| `h3ToPolygon(h3Index)` | Convert H3 cell to polygon coordinates for Leaflet |
| `groupLocationsByH3(locations, resolution)` | Group contacts into hexagonal cells |
| `getHexagonColor(count, maxCount)` | Calculate color based on density |

### H3 Resolution:
- Use **resolution 7** (~1.2km hexagons) as default
- Adjustable based on zoom level for better UX

---

## Phase 3: Update ContactsMapDialog Component

### File: `src/components/ContactsMapDialog.tsx`

### Changes:

1. **Add H3 imports and state**
   - Import h3-js library
   - Add state for hexagon layer and view mode toggle

2. **Create hexagon layer function**
   - Group geocoded locations by H3 cell
   - Create Leaflet polygon for each hexagon
   - Style polygons based on contact count (color gradient)

3. **Add view mode toggle**
   - Button to switch between "Hexagons" and "Markers" view
   - Preserve existing marker functionality

4. **Update click handling**
   - Click hexagon shows all contacts/companies in that cell
   - Reuse existing sidebar panel for details

5. **Add hexagon styling**
   - Semi-transparent fill colors (blue gradient)
   - White borders between hexagons
   - Hover effect to highlight

### Visual changes:

```text
Current (Point Markers):     New (H3 Hexagons):
     •                           ⬡ ⬡
   •   •                        ⬡ ⬡ ⬡
     •                           ⬡ ⬡
```

---

## Phase 4: Add Legend and Controls

### New UI elements:

1. **Color legend** - Shows what hexagon colors mean
   - Light blue: 1 contact
   - Medium blue: 2-5 contacts  
   - Dark blue: 6+ contacts

2. **View toggle button** - Switch between hexagon/marker views

3. **Resolution slider** (optional) - Adjust hexagon size

---

## Technical Details

### H3 Resolution Guide:

| Resolution | Hexagon Size | Best For |
|------------|--------------|----------|
| 5 | ~8 km | Regional view |
| 7 | ~1.2 km | City/neighborhood |
| 9 | ~175 m | Street level |

### Leaflet + H3 Integration:

```text
Geocoded Locations → Group by H3 Cell → Create Leaflet Polygons → Render on Map
       ↓                    ↓                      ↓
  [lat, lng]         h3Index string        L.polygon(coords)
```

### Performance:
- H3 calculations happen client-side (fast)
- Hexagons reduce visual clutter vs many markers
- Polygon rendering is efficient in Leaflet

---

## Files to Modify

| File | Action |
|------|--------|
| `package.json` | Add h3-js dependency |
| `src/lib/h3-utils.ts` | Create new utility file |
| `src/components/ContactsMapDialog.tsx` | Add hexagon layer alongside markers |

---

## Benefits of This Approach

| Aspect | Benefit |
|--------|---------|
| **Minimal changes** | Keeps existing Leaflet setup |
| **Progressive enhancement** | Markers still work, hexagons are additive |
| **Better visualization** | See contact density at a glance |
| **Open source** | H3 is MIT licensed, no API keys |
| **Performance** | Fewer polygons than individual markers for large datasets |
