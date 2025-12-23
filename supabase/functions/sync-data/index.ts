import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SyncPayload {
  action: "register" | "discover" | "sync" | "unregister";
  deviceId: string;
  deviceName: string;
  data?: {
    companies?: any[];
    people?: any[];
    items?: any[];
    vendors?: any[];
  };
}

interface DuplicateResult {
  type: string;
  incoming: any;
  existing: any;
  field: string;
}

// Simple in-memory device registry (will reset on function cold start)
// For production, you'd want to use a database table
const deviceRegistry = new Map<string, { deviceName: string; lastSeen: Date; networkId: string; userId: string }>();

function findDuplicates(incoming: any[], existing: any[], type: string, matchFields: string[]): DuplicateResult[] {
  const duplicates: DuplicateResult[] = [];
  
  for (const incomingItem of incoming) {
    for (const existingItem of existing) {
      // Skip if same ID (same record)
      if (incomingItem.id === existingItem.id) continue;
      
      for (const field of matchFields) {
        const incomingValue = incomingItem[field];
        const existingValue = existingItem[field];
        
        if (incomingValue && existingValue) {
          // Normalize strings for comparison
          const normalizedIncoming = String(incomingValue).toLowerCase().trim();
          const normalizedExisting = String(existingValue).toLowerCase().trim();
          
          if (normalizedIncoming === normalizedExisting) {
            duplicates.push({
              type,
              incoming: incomingItem,
              existing: existingItem,
              field,
            });
            break; // Only report first matching field per pair
          }
        }
      }
    }
  }
  
  return duplicates;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Require authentication for all sync operations
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("Sync request rejected: No authorization header");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to verify auth and use RLS
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.log("Sync request rejected: Invalid authentication token");
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log("User authenticated:", userId);

    const payload: SyncPayload = await req.json();
    const { action, deviceId, deviceName, data } = payload;

    // Get network identifier from request (simplified - uses IP-based grouping)
    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const networkId = clientIP.split(",")[0].trim();

    switch (action) {
      case "register": {
        deviceRegistry.set(deviceId, {
          deviceName,
          lastSeen: new Date(),
          networkId,
          userId,
        });
        
        console.log(`Device registered: ${deviceId} (${deviceName}) by user: ${userId}`);
        
        return new Response(
          JSON.stringify({ success: true, message: "Device registered" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "discover": {
        // Find devices on the same network AND same user (security: don't expose other users' devices)
        const nearbyDevices: { deviceId: string; deviceName: string }[] = [];
        const now = new Date();
        
        for (const [id, info] of deviceRegistry.entries()) {
          // Only show devices on same network, same user, active in last 5 minutes, and not self
          const minutesAgo = (now.getTime() - info.lastSeen.getTime()) / 1000 / 60;
          if (info.networkId === networkId && info.userId === userId && id !== deviceId && minutesAgo < 5) {
            nearbyDevices.push({ deviceId: id, deviceName: info.deviceName });
          }
        }

        // Update last seen for this device
        if (deviceRegistry.has(deviceId)) {
          deviceRegistry.get(deviceId)!.lastSeen = now;
        }

        console.log(`Device discovery: ${deviceId} found ${nearbyDevices.length} nearby devices for user: ${userId}`);

        return new Response(
          JSON.stringify({ devices: nearbyDevices }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "sync": {
        if (!data) {
          return new Response(
            JSON.stringify({ error: "No data provided for sync" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Sync request from device: ${deviceId}, user: ${userId}`);

        const duplicates: DuplicateResult[] = [];
        const syncResults = {
          companies: { added: 0, updated: 0 },
          people: { added: 0, updated: 0 },
          items: { added: 0, updated: 0 },
          vendors: { added: 0, updated: 0 },
        };

        // SECURITY: Use userClient (with RLS) instead of service role
        // This ensures the user can only access data they're authorized to see
        const [companiesRes, peopleRes, itemsRes, vendorsRes] = await Promise.all([
          userClient.from("companies").select("*"),
          userClient.from("people").select("*"),
          userClient.from("items").select("*"),
          userClient.from("vendors").select("*"),
        ]);

        const existingData = {
          companies: companiesRes.data || [],
          people: peopleRes.data || [],
          items: itemsRes.data || [],
          vendors: vendorsRes.data || [],
        };

        // Check for duplicates
        if (data.companies?.length) {
          duplicates.push(...findDuplicates(data.companies, existingData.companies, "company", ["name"]));
        }
        if (data.people?.length) {
          duplicates.push(...findDuplicates(data.people, existingData.people, "person", ["name", "email", "phone"]));
        }
        if (data.items?.length) {
          duplicates.push(...findDuplicates(data.items, existingData.items, "item", ["part_number", "serial_number"]));
        }
        if (data.vendors?.length) {
          duplicates.push(...findDuplicates(data.vendors, existingData.vendors, "vendor", ["name", "email"]));
        }

        // If duplicates found, return them for user review
        if (duplicates.length > 0) {
          console.log(`Found ${duplicates.length} duplicates for device: ${deviceId}`);
          return new Response(
            JSON.stringify({ 
              status: "duplicates_found",
              duplicates,
              message: `Found ${duplicates.length} potential duplicate(s). Please review.`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // SECURITY: Sync only ADDS or UPDATES data - never deletes
        // This prevents one user's deletion from affecting other users
        // Deletions are handled locally and require explicit confirmation before sync
        if (data.companies?.length) {
          const { error } = await userClient.from("companies").upsert(data.companies, { onConflict: "id" });
          if (error) {
            console.error("Companies sync error:", error.message);
          } else {
            syncResults.companies.added = data.companies.length;
          }
        }
        if (data.people?.length) {
          const { error } = await userClient.from("people").upsert(data.people, { onConflict: "id" });
          if (error) {
            console.error("People sync error:", error.message);
          } else {
            syncResults.people.added = data.people.length;
          }
        }
        if (data.items?.length) {
          const { error } = await userClient.from("items").upsert(data.items, { onConflict: "id" });
          if (error) {
            console.error("Items sync error:", error.message);
          } else {
            syncResults.items.added = data.items.length;
          }
        }
        if (data.vendors?.length) {
          const { error } = await userClient.from("vendors").upsert(data.vendors, { onConflict: "id" });
          if (error) {
            console.error("Vendors sync error:", error.message);
          } else {
            syncResults.vendors.added = data.vendors.length;
          }
        }

        console.log(`Sync completed for device: ${deviceId}, user: ${userId}`, syncResults);

        return new Response(
          JSON.stringify({ 
            status: "synced",
            results: syncResults,
            message: "Data synced successfully. Note: Deletions are not synced to protect other users' data."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "unregister": {
        // Only allow unregistering own devices
        const existingDevice = deviceRegistry.get(deviceId);
        if (existingDevice && existingDevice.userId !== userId) {
          return new Response(
            JSON.stringify({ error: "Cannot unregister another user's device" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        deviceRegistry.delete(deviceId);
        console.log(`Device unregistered: ${deviceId} by user: ${userId}`);
        return new Response(
          JSON.stringify({ success: true, message: "Device unregistered" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
