import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { address } = await req.json();
    if (!address || typeof address !== "string" || address.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Address is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = address.trim();
    const key = trimmed.toLowerCase();

    // Read-through shared cache
    const { data: cached } = await supabaseClient
      .from("geocode_cache")
      .select("lat,lng")
      .eq("address_key", key)
      .maybeSingle();

    if (cached && cached.lat != null && cached.lng != null) {
      return new Response(
        JSON.stringify({ lat: Number(cached.lat), lng: Number(cached.lng), cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "LovableApp/1.1",
        },
      }
    );

    if (!response.ok) {
      // Rate-limit (429) or upstream 5xx → degrade gracefully so client doesn't crash
      const fallbackable = response.status === 429 || response.status >= 500;
      return new Response(
        JSON.stringify({
          lat: null,
          lng: null,
          error: "Geocoding unavailable",
          status: response.status,
          fallback: fallbackable,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = await response.json();
    if (results && results.length > 0) {
      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);

      // Write-through: store for everyone else
      await supabaseClient.from("geocode_cache").upsert({
        address_key: key,
        display_address: trimmed,
        lat,
        lng,
        source: "nominatim",
      }, { onConflict: "address_key" });

      return new Response(
        JSON.stringify({ lat, lng, cached: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ lat: null, lng: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
