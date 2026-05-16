## Goal

Make the map open with locations already plotted instead of geocoding addresses one by one each time. Today the cache is in each user's browser (`localStorage`) — every device, every fresh login, every cleared cache starts from zero and re-hits OpenStreetMap at 1 req/sec.

The fix: store geocoded coordinates on the server (Lovable Cloud), shared by all employees, and pre-warm them in the background so addresses are already resolved by the time anyone opens the map.

## How it works

```text
   New / updated contact address
              │
              ▼
   ┌──────────────────────┐         ┌──────────────────────┐
   │  geocode-proxy fn    │ ───────▶│  geocode_cache table │
   │  (writes on success) │         │  (shared, server)    │
   └──────────────────────┘         └──────────────────────┘
              ▲                                │
              │ miss                           │ bulk read on open
              │                                ▼
   ┌──────────────────────────────────────────────────┐
   │  Map page / dialog                                │
   │  1. Load all rows from geocode_cache (1 query)    │
   │  2. Plot instantly                                │
   │  3. Only call geocode-proxy for addresses missing │
   └──────────────────────────────────────────────────┘
              ▲
              │ nightly
   ┌──────────────────────┐
   │  prewarm-geocodes    │  scans contacts/companies,
   │  cron edge function  │  geocodes any address not yet cached
   └──────────────────────┘
```

## Plan

**1. New table `geocode_cache`**
- Columns: `address_key` (text, primary key — lowercased trimmed address), `display_address` (text), `lat` (numeric), `lng` (numeric), `source` (text, e.g. `nominatim`), `created_at`, `updated_at`.
- RLS: internal users (owner / employee / developer) can read and insert; only owner/developer can delete. No PII — just addresses and coords.

**2. Edge function `geocode-proxy` — write-through cache**
- Before calling Nominatim, look up `address_key` in `geocode_cache`. If found, return it (skip the network call entirely).
- After a successful Nominatim lookup, upsert into `geocode_cache`. This is the single place writes happen, so every user benefits from every other user's lookups.

**3. Client `useContactsMap` — read shared cache first**
- On `startGeocoding`, run one `select address_key, lat, lng from geocode_cache` query and merge results into the existing in-memory map.
- Then proceed with the current loop — but the "uncached" list will usually be empty, so the map paints immediately.
- Keep the localStorage cache as a fast path for offline / repeat opens, but server is the source of truth.

**4. New edge function `prewarm-geocodes` (scheduled)**
- Pulls every distinct non-empty address from `companies` and `people`.
- Diffs against `geocode_cache`.
- Geocodes the missing ones at 1 req/sec (Nominatim's limit) and stores them.
- Scheduled via `pg_cron` to run nightly (e.g. 3 AM). Also runnable on demand from the map's Refresh button.

**5. Manual "Pre-warm now" button (optional, small)**
- On `/map` and the CRM map dialog, add a small action that invokes `prewarm-geocodes` so an admin can warm the cache after a big import without waiting for the cron.

## Files touched

- `supabase/migrations/*` — create `geocode_cache` + RLS + indexes; enable `pg_cron` / `pg_net` if not already; schedule cron.
- `supabase/functions/geocode-proxy/index.ts` — read-then-write against `geocode_cache`.
- `supabase/functions/prewarm-geocodes/index.ts` — new function.
- `supabase/config.toml` — register the new function.
- `src/hooks/useContactsMap.ts` — fetch shared cache at the top of `startGeocoding`, merge before the loop.
- `src/components/ContactsMapDialog.tsx` and `src/pages/MapView.tsx` — optional "Pre-warm" button wired to the new function.

## Out of scope

- Switching geocoder providers (Mapbox/Google) — staying on Nominatim.
- Background geocoding triggered automatically on every contact insert (would need a DB trigger calling an edge function; the nightly cron + on-demand button covers it without that complexity).
- Forward-geocoding addresses entered through `AddressAutocomplete` (those already include lat/lon from the search — separate optimization).
