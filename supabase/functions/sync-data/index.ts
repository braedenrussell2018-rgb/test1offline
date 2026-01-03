import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SyncPayload {
  action: "register" | "discover" | "sync" | "unregister" | "confirm_deletions";
  deviceId: string;
  deviceName: string;
  data?: {
    companies?: unknown[];
    people?: unknown[];
    items?: unknown[];
    vendors?: unknown[];
  };
  deletionIds?: {
    companies?: string[];
    people?: string[];
    items?: string[];
    vendors?: string[];
  };
}

interface DuplicateResult {
  type: string;
  incoming: unknown;
  existing: unknown;
  field: string;
}

interface DeletionInfo {
  type: string;
  id: string;
  name: string;
  deletedAt?: string;
}

// Simple in-memory device registry (will reset on function cold start)
// For production, you'd want to use a database table
const deviceRegistry = new Map<string, { deviceName: string; lastSeen: Date; networkId: string; userId: string }>();

function findDuplicates(incoming: unknown[], existing: unknown[], type: string, matchFields: string[]): DuplicateResult[] {
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
    const { action, deviceId, deviceName, data, deletionIds } = payload;

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
        const deletedByOthers: DeletionInfo[] = [];
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

        // Detect items that exist locally but not in the database (deleted by others)
        const existingCompanyIds = new Set(existingData.companies.map((c: unknown) => c.id));
        const existingPeopleIds = new Set(existingData.people.map((p: unknown) => p.id));
        const existingItemIds = new Set(existingData.items.map((i: unknown) => i.id));
        const existingVendorIds = new Set(existingData.vendors.map((v: unknown) => v.id));

        // Check what the user has locally that no longer exists in the database
        if (data.companies?.length) {
          for (const company of data.companies) {
            if (!existingCompanyIds.has(company.id)) {
              deletedByOthers.push({
                type: "company",
                id: company.id,
                name: company.name || "Unknown Company",
              });
            }
          }
        }
        if (data.people?.length) {
          for (const person of data.people) {
            if (!existingPeopleIds.has(person.id)) {
              deletedByOthers.push({
                type: "person",
                id: person.id,
                name: person.name || "Unknown Person",
              });
            }
          }
        }
        if (data.items?.length) {
          for (const item of data.items) {
            if (!existingItemIds.has(item.id)) {
              deletedByOthers.push({
                type: "item",
                id: item.id,
                name: item.description || item.part_number || "Unknown Item",
              });
            }
          }
        }
        if (data.vendors?.length) {
          for (const vendor of data.vendors) {
            if (!existingVendorIds.has(vendor.id)) {
              deletedByOthers.push({
                type: "vendor",
                id: vendor.id,
                name: vendor.name || "Unknown Vendor",
              });
            }
          }
        }

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
              deletedByOthers,
              message: `Found ${duplicates.length} potential duplicate(s). Please review.`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // SECURITY: Sync only ADDS or UPDATES data - never deletes
        // Filter out items that were deleted by others (don't re-create them)
        const deletedCompanyIds = new Set(deletedByOthers.filter(d => d.type === "company").map(d => d.id));
        const deletedPeopleIds = new Set(deletedByOthers.filter(d => d.type === "person").map(d => d.id));
        const deletedItemIds = new Set(deletedByOthers.filter(d => d.type === "item").map(d => d.id));
        const deletedVendorIds = new Set(deletedByOthers.filter(d => d.type === "vendor").map(d => d.id));

        const companiesToSync = data.companies?.filter((c: unknown) => !deletedCompanyIds.has(c.id)) || [];
        const peopleToSync = data.people?.filter((p: unknown) => !deletedPeopleIds.has(p.id)) || [];
        const itemsToSync = data.items?.filter((i: unknown) => !deletedItemIds.has(i.id)) || [];
        const vendorsToSync = data.vendors?.filter((v: unknown) => !deletedVendorIds.has(v.id)) || [];

        if (companiesToSync.length) {
          const { error } = await userClient.from("companies").upsert(companiesToSync, { onConflict: "id" });
          if (error) {
            console.error("Companies sync error:", error.message);
          } else {
            syncResults.companies.added = companiesToSync.length;
          }
        }
        if (peopleToSync.length) {
          const { error } = await userClient.from("people").upsert(peopleToSync, { onConflict: "id" });
          if (error) {
            console.error("People sync error:", error.message);
          } else {
            syncResults.people.added = peopleToSync.length;
          }
        }
        if (itemsToSync.length) {
          const { error } = await userClient.from("items").upsert(itemsToSync, { onConflict: "id" });
          if (error) {
            console.error("Items sync error:", error.message);
          } else {
            syncResults.items.added = itemsToSync.length;
          }
        }
        if (vendorsToSync.length) {
          const { error } = await userClient.from("vendors").upsert(vendorsToSync, { onConflict: "id" });
          if (error) {
            console.error("Vendors sync error:", error.message);
          } else {
            syncResults.vendors.added = vendorsToSync.length;
          }
        }

        console.log(`Sync completed for device: ${deviceId}, user: ${userId}`, syncResults);

        // If there are items deleted by others, inform the user
        if (deletedByOthers.length > 0) {
          return new Response(
            JSON.stringify({ 
              status: "synced_with_deletions",
              results: syncResults,
              deletedByOthers,
              message: `Data synced. ${deletedByOthers.length} item(s) were deleted by another user. Review them below.`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            status: "synced",
            results: syncResults,
            message: "Data synced successfully."
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "confirm_deletions": {
        // User has confirmed they want to delete these items locally
        // This action just acknowledges the deletion confirmation
        // The actual local deletion happens on the client side
        console.log(`User ${userId} confirmed deletions for device: ${deviceId}`, deletionIds);
        
        return new Response(
          JSON.stringify({ 
            status: "deletions_confirmed",
            message: "Deletions confirmed. You can now remove these items from your local data."
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
