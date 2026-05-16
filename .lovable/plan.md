# Fix Map Bugs

Two issues to resolve in both the CRM map dialog (`ContactsMapDialog`) and the full-page map (`/map` / `MapView`):

1. **Clicking a contact/company in the side panel doesn't open them** — the side-panel cards wrap each result in a nested `PersonDetailDialog` / `CompanyDetailDialog`. Those dialogs render inside the outer map dialog and get swallowed by its overlay/focus trap, so the screen just dims.
2. **Map can't be click-dragged** — only the +/− and arrow controls move it. Leaflet's default drag isn't engaging because the container's `touch-action` / `cursor` aren't being set and the map is being mounted before its container has its final size in some cases.

## What we'll change

### 1. Open contact in a new tab (per your choice)

Replace the nested dialog triggers in the map side panel and the Failed-Addresses list with plain buttons that call `window.open(...)` to a deep-link URL.

- New URL params on the CRM page:
  - `/crm?person=<id>` → auto-opens that person's `PersonDetailDialog`
  - `/crm?company=<id>` → auto-opens that company's `CompanyDetailDialog`
- `src/pages/CRM.tsx` will read those params on mount, find the matching record, and open the appropriate dialog. The map and route planner stay untouched in the other tab.
- Same change applies to the search-result dropdown (currently only flies the map — will now also offer "Open" via a small icon, while clicking the row still flies the map and opens the side panel).

Files touched:
- `src/components/ContactsMapDialog.tsx`
- `src/pages/MapView.tsx`
- `src/pages/CRM.tsx` (read deep-link params, open the right dialog)

### 2. Restore click-and-drag panning

Make sure Leaflet's drag handler actually attaches and the container accepts pointer drags:

- Initialize the map with explicit interaction options: `dragging: true`, `tap: true`, `scrollWheelZoom: true`, `touchZoom: true`, `inertia: true`.
- Add a small CSS rule so the Leaflet container uses the grab cursor and disables browser pan gestures that steal the drag:

```text
.leaflet-container { cursor: grab; touch-action: none; }
.leaflet-container:active { cursor: grabbing; }
.leaflet-dragging .leaflet-container,
.leaflet-dragging .leaflet-container .leaflet-interactive { cursor: grabbing !important; }
```

- Call `map.dragging.enable()` after init as a safety net, and re-`invalidateSize()` once on first paint and on dialog open / fullscreen change (the dialog already wires fullscreen, we'll also fire it when the side panel toggles so the map width change doesn't desync the drag origin).

Files touched:
- `src/hooks/useContactsMap.ts` (init options + post-init enable + invalidate triggers)
- `src/index.css` (cursor + touch-action rules, scoped to `.leaflet-container`)

## Out of scope (tell me if you want these too)

- Route Planner click hijack behavior, fullscreen sizing edge cases, H3 selection, refresh button, geocoding accuracy. You said the two above are the priority — happy to file follow-ups.

## Technical notes

- Deep-link param handling in `CRM.tsx` uses `useSearchParams`; after opening the dialog we clear the param with `setSearchParams({}, { replace: true })` so reloading doesn't reopen it unexpectedly.
- We keep the existing `<CompanyDetailDialog>` / `<PersonDetailDialog>` usages everywhere else in the app — only the map's two side panels and the Failed-Addresses list switch to `window.open`.
- `touch-action: none` on `.leaflet-container` is the documented Leaflet recommendation and is safe because Leaflet handles its own touch gestures.
