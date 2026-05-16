import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Background pre-warm: scan all contact/company addresses and geocode any
// that aren't in the shared cache yet. Rate-limited to Nominatim's 1 req/sec.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Use service role to bypass RLS for the full scan
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let maxToProcess = 200;
    try {
      const body = await req.json();
      if (typeof body?.limit === "number") maxToProcess = Math.min(body.limit, 1000);
    } catch (_) { /* no body */ }

    // Collect distinct addresses from companies + people
    const addrSet = new Set<string>();
    const displayMap = new Map<string, string>();

    const { data: companies } = await supabase
      .from("companies")
      .select("address")
      .not("address", "is", null);
    (companies ?? []).forEach((r: { address: string | null }) => {
      const a = (r.address ?? "").trim();
      if (a) { addrSet.add(a.toLowerCase()); displayMap.set(a.toLowerCase(), a); }
    });

    const { data: people } = await supabase
      .from("people")
      .select("address")
      .not("address", "is", null)
      .is("deleted_at", null);
    (people ?? []).forEach((r: { address: string | null }) => {
      const a = (r.address ?? "").trim();
      if (a) { addrSet.add(a.toLowerCase()); displayMap.set(a.toLowerCase(), a); }
    });

    const allKeys = Array.from(addrSet);
    if (allKeys.length === 0) {
      return new Response(JSON.stringify({ ok: true, scanned: 0, geocoded: 0, missing: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find which ones are already cached (chunk to avoid URL limits)
    const cached = new Set<string>();
    for (let i = 0; i < allKeys.length; i += 200) {
      const chunk = allKeys.slice(i, i + 200);
      const { data } = await supabase
        .from("geocode_cache")
        .select("address_key")
        .in("address_key", chunk);
      (data ?? []).forEach((r: { address_key: string }) => cached.add(r.address_key));
    }

    const missing = allKeys.filter((k) => !cached.has(k));
    const toProcess = missing.slice(0, maxToProcess);

    let geocoded = 0;
    for (const key of toProcess) {
      const address = displayMap.get(key) ?? key;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
          { headers: { Accept: "application/json", "User-Agent": "LovableApp-Prewarm/1.0" } }
        );
        if (res.ok) {
          const results = await res.json();
          if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lng = parseFloat(results[0].lon);
            await supabase.from("geocode_cache").upsert({
              address_key: key,
              display_address: address,
              lat,
              lng,
              source: "nominatim",
            }, { onConflict: "address_key" });
            geocoded++;
          }
        }
      } catch (err) {
        console.error("prewarm geocode failed for", address, err);
      }
      // Nominatim usage policy: max 1 req/sec
      await new Promise((r) => setTimeout(r, 1100));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scanned: allKeys.length,
        already_cached: cached.size,
        missing: missing.length,
        processed: toProcess.length,
        geocoded,
        remaining: Math.max(0, missing.length - toProcess.length),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
