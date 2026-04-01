

# Add Fullscreen / Pop-out Mode for CRM Map

## Overview

Add a button to the CRM map that expands it to fill the entire screen (browser fullscreen API), plus add a dedicated `/map` route that renders the map as its own standalone page.

## Changes

### 1. Fullscreen toggle in `ContactsMapDialog.tsx`
- Add a `Maximize2` / `Minimize2` icon button to the map toolbar
- Use the browser Fullscreen API (`element.requestFullscreen()`) on the dialog content element
- Listen for `fullscreenchange` event to toggle icon state
- When entering/exiting fullscreen, call `map.current.invalidateSize()` so Leaflet redraws correctly

### 2. New standalone map page `src/pages/MapView.tsx`
- A full-page component that renders the map outside of a dialog (no `Dialog` wrapper)
- Reuses the same geocoding, H3, and marker logic from `ContactsMapDialog`
- Loads companies/persons from the database directly (same queries as CRM page)
- Takes up 100vh with the map container filling the available space below the nav bar
- Include a "Back to CRM" button

### 3. Extract shared map logic
- Move core map initialization, geocoding, H3 overlay, and marker rendering into a shared hook `src/hooks/useContactsMap.ts`
- Both `ContactsMapDialog` and `MapView` consume this hook to avoid code duplication

### 4. Add route in `App.tsx`
- Add `/map` route wrapped with `RoleProtectedRoute` for owner/employee/developer roles

### 5. Add pop-out button in `ContactsMapDialog.tsx`
- A `ExternalLink` icon button next to the fullscreen button
- Uses `window.open('/map', '_blank')` or `navigate('/map')` to open the standalone page

## File Summary

| Action | File |
|--------|------|
| Create | `src/hooks/useContactsMap.ts` — shared map logic extracted from dialog |
| Create | `src/pages/MapView.tsx` — standalone full-page map |
| Modify | `src/components/ContactsMapDialog.tsx` — add fullscreen toggle + pop-out button, refactor to use shared hook |
| Modify | `src/App.tsx` — add `/map` route |

