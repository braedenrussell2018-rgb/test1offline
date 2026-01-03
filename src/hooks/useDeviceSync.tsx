import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  initOfflineDB,
  saveToOffline,
  getFromOffline,
  cacheAllData,
  getSyncQueue,
  clearSyncQueue,
  setMetadata,
  getMetadata,
  isOnline,
  onConnectionChange,
} from "@/lib/offline-storage";
import type { Company, Person, Item, Vendor } from "@/lib/inventory-storage";

interface Device {
  deviceId: string;
  deviceName: string;
}

interface DuplicateResult {
  type: string;
  incoming: Company | Person | Item | Vendor;
  existing: Company | Person | Item | Vendor;
  field: string;
}

interface DeletionInfo {
  type: string;
  id: string;
  name: string;
}

interface SyncData {
  companies?: Company[];
  people?: Person[];
  items?: Item[];
  vendors?: Vendor[];
}

// Generate or retrieve device ID
const getDeviceId = (): string => {
  try {
    let deviceId = localStorage.getItem("device_sync_id");
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("device_sync_id", deviceId);
    }
    return deviceId;
  } catch (e) {
    // Fallback if localStorage is not available
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

// Generate device name
const getDeviceName = (): string => {
  try {
    let deviceName = localStorage.getItem("device_sync_name");
    if (!deviceName) {
      const platform = /iPad|iPhone|iPod/.test(navigator.userAgent) ? "iOS Device" : "Device";
      deviceName = `${platform} ${Date.now().toString(36).toUpperCase().slice(-4)}`;
      localStorage.setItem("device_sync_name", deviceName);
    }
    return deviceName;
  } catch (e) {
    return "Unknown Device";
  }
};

export function useDeviceSync() {
  const [deviceId] = useState(getDeviceId);
  const [deviceName, setDeviceName] = useState(getDeviceName);
  const [nearbyDevices, setNearbyDevices] = useState<Device[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateResult[]>([]);
  const [deletedByOthers, setDeletedByOthers] = useState<DeletionInfo[]>([]);
  const [pendingData, setPendingData] = useState<SyncData | null>(null);
  const [online, setOnline] = useState(isOnline());
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isCaching, setIsCaching] = useState(false);

  // Initialize offline DB on mount
  useEffect(() => {
    initOfflineDB().catch((err) => {
      console.error("Failed to initialize offline DB:", err);
    });

    // Load last sync time
    getMetadata<string>("lastSync").then(setLastSync).catch(console.error);

    // Load pending changes count
    getSyncQueue().then((queue) => setPendingChanges(queue.length)).catch(console.error);

    // Listen for connection changes
    const unsubscribe = onConnectionChange((isOnline) => {
      setOnline(isOnline);
      if (isOnline) {
        toast.success("Back online!");
        // Auto-sync pending changes when coming back online
        processPendingChanges();
      } else {
        toast.warning("You're offline. Changes will be saved locally.");
      }
    });

    return unsubscribe;
  }, []);

  const processPendingChanges = async () => {
    try {
      const queue = await getSyncQueue();
      if (queue.length === 0) return;

      for (const item of queue) {
        try {
          if (item.action === "insert" || item.action === "update") {
            await supabase.from(item.store).upsert(item.data, { onConflict: "id" });
          } else if (item.action === "delete") {
            await supabase.from(item.store).delete().eq("id", item.data.id);
          }
        } catch (err) {
          console.error(`Failed to sync item ${item.id}:`, err);
        }
      }

      await clearSyncQueue();
      setPendingChanges(0);
      toast.success("Pending changes synced!");
    } catch (err) {
      console.error("Failed to process pending changes:", err);
    }
  };

  const callSyncFunction = async (payload: SyncData) => {
    try {
      const { data, error } = await supabase.functions.invoke("sync-data", {
        body: payload,
      });
      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }
      return data;
    } catch (err) {
      console.error("Failed to call sync function:", err);
      throw err;
    }
  };

  const register = useCallback(async () => {
    if (!online) return;
    try {
      await callSyncFunction({
        action: "register",
        deviceId,
        deviceName,
      });
    } catch (error) {
      console.error("Failed to register device:", error);
    }
  }, [deviceId, deviceName, online]);

  const unregister = useCallback(async () => {
    if (!online) return;
    try {
      await callSyncFunction({
        action: "unregister",
        deviceId,
        deviceName,
      });
    } catch (error) {
      console.error("Failed to unregister device:", error);
    }
  }, [deviceId, deviceName, online]);

  const discoverDevices = useCallback(async () => {
    if (!online) {
      toast.error("You're offline. Cannot discover devices.");
      return;
    }

    setIsDiscovering(true);
    try {
      const result = await callSyncFunction({
        action: "discover",
        deviceId,
        deviceName,
      });
      setNearbyDevices(result.devices || []);
    } catch (error) {
      console.error("Failed to discover devices:", error);
      // Don't show toast for every discovery failure
    } finally {
      setIsDiscovering(false);
    }
  }, [deviceId, deviceName, online]);

  const fetchLocalData = async (): Promise<SyncData> => {
    // Try to get data from Supabase first, fall back to offline storage
    if (online) {
      try {
        const [companies, people, items, vendors] = await Promise.all([
          supabase.from("companies").select("*"),
          supabase.from("people").select("*"),
          supabase.from("items").select("*"),
          supabase.from("vendors").select("*"),
        ]);

        return {
          companies: companies.data || [],
          people: people.data || [],
          items: items.data || [],
          vendors: vendors.data || [],
        };
      } catch (err) {
        console.error("Failed to fetch from Supabase, using offline data:", err);
      }
    }

    // Fall back to offline storage
    const [companies, people, items, vendors] = await Promise.all([
      getFromOffline("companies"),
      getFromOffline("people"),
      getFromOffline("items"),
      getFromOffline("vendors"),
    ]);

    return { companies, people, items, vendors };
  };

  const cacheDataForOffline = useCallback(async () => {
    setIsCaching(true);
    try {
      const result = await cacheAllData(supabase);
      if (result.success) {
        setLastSync(new Date().toISOString());
        toast.success("Data cached for offline use!");
        return true;
      } else {
        toast.error("Failed to cache data: " + result.error);
        return false;
      }
    } catch (err) {
      console.error("Failed to cache data:", err);
      toast.error("Failed to cache data for offline use");
      return false;
    } finally {
      setIsCaching(false);
    }
  }, []);

  const syncData = useCallback(async (dataToSync?: SyncData) => {
    if (!online) {
      toast.error("You're offline. Cannot sync to other devices.");
      return { status: "offline" };
    }

    setIsSyncing(true);
    setDuplicates([]);
    setDeletedByOthers([]);
    
    try {
      const data = dataToSync || await fetchLocalData();
      
      const result = await callSyncFunction({
        action: "sync",
        deviceId,
        deviceName,
        data,
      });

      if (result.status === "duplicates_found") {
        setDuplicates(result.duplicates);
        if (result.deletedByOthers?.length) {
          setDeletedByOthers(result.deletedByOthers);
        }
        setPendingData(data);
        toast.warning(`Found ${result.duplicates.length} potential duplicate(s)`);
        return { status: "duplicates", duplicates: result.duplicates, deletedByOthers: result.deletedByOthers };
      }

      if (result.status === "synced_with_deletions") {
        setDeletedByOthers(result.deletedByOthers || []);
        toast.info(`Sync complete. ${result.deletedByOthers?.length || 0} item(s) were deleted by another user.`);
        // Cache the synced data locally
        await cacheDataForOffline();
        return { status: "synced_with_deletions", results: result.results, deletedByOthers: result.deletedByOthers };
      }

      // Cache the synced data locally
      await cacheDataForOffline();

      toast.success("Data synced successfully!");
      return { status: "success", results: result.results };
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Failed to sync data. Please try again.");
      return { status: "error", error };
    } finally {
      setIsSyncing(false);
    }
  }, [deviceId, deviceName, online, cacheDataForOffline]);

  const confirmDeletions = useCallback(async (idsToDelete: DeletionInfo[]) => {
    if (!online) {
      toast.error("You're offline. Cannot confirm deletions.");
      return false;
    }

    try {
      // Group by type
      const deletionIds: { companies?: string[]; people?: string[]; items?: string[]; vendors?: string[] } = {};
      
      for (const item of idsToDelete) {
        if (item.type === "company") {
          if (!deletionIds.companies) deletionIds.companies = [];
          deletionIds.companies.push(item.id);
        } else if (item.type === "person") {
          if (!deletionIds.people) deletionIds.people = [];
          deletionIds.people.push(item.id);
        } else if (item.type === "item") {
          if (!deletionIds.items) deletionIds.items = [];
          deletionIds.items.push(item.id);
        } else if (item.type === "vendor") {
          if (!deletionIds.vendors) deletionIds.vendors = [];
          deletionIds.vendors.push(item.id);
        }
      }

      // Notify the server
      await callSyncFunction({
        action: "confirm_deletions",
        deviceId,
        deviceName,
        deletionIds,
      });

      // Remove from local offline storage
      // The items won't be re-uploaded on next sync since they're no longer in local data
      setDeletedByOthers([]);
      
      // Refresh cache to remove deleted items
      await cacheDataForOffline();

      toast.success(`${idsToDelete.length} item(s) removed from your local data.`);
      return true;
    } catch (error) {
      console.error("Failed to confirm deletions:", error);
      toast.error("Failed to process deletions.");
      return false;
    }
  }, [deviceId, deviceName, online, cacheDataForOffline]);

  const dismissDeletions = useCallback(() => {
    // User chooses to keep their local copies - do nothing, just clear the list
    setDeletedByOthers([]);
    toast.info("Keeping your local copies. They may be re-uploaded on next sync.");
  }, []);

  const resolveDuplicate = useCallback((index: number, action: "keep_existing" | "keep_incoming" | "keep_both") => {
    setDuplicates(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });

    if (action === "keep_incoming" && pendingData) {
      // Data will be synced with the incoming version
    } else if (action === "keep_existing") {
      // Remove the incoming item from pending data
    }
    // keep_both - both records stay
  }, [pendingData]);

  const confirmSync = useCallback(async () => {
    if (!pendingData) return;
    if (!online) {
      toast.error("You're offline. Cannot complete sync.");
      return;
    }
    
    setDuplicates([]);
    setIsSyncing(true);
    
    try {
      const data = pendingData;
      
      // Upsert all data
      const promises = [];
      if (data.companies?.length) {
        promises.push(supabase.from("companies").upsert(data.companies, { onConflict: "id" }));
      }
      if (data.people?.length) {
        promises.push(supabase.from("people").upsert(data.people, { onConflict: "id" }));
      }
      if (data.items?.length) {
        promises.push(supabase.from("items").upsert(data.items, { onConflict: "id" }));
      }
      if (data.vendors?.length) {
        promises.push(supabase.from("vendors").upsert(data.vendors, { onConflict: "id" }));
      }

      await Promise.all(promises);

      // Cache the synced data locally
      await cacheDataForOffline();

      toast.success("Data synced successfully!");
      setPendingData(null);
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Failed to sync data");
    } finally {
      setIsSyncing(false);
    }
  }, [pendingData, online, cacheDataForOffline]);

  const updateDeviceName = useCallback((newName: string) => {
    setDeviceName(newName);
    try {
      localStorage.setItem("device_sync_name", newName);
    } catch (e) {
      console.error("Failed to save device name:", e);
    }
  }, []);

  // Register on mount, unregister on unmount
  useEffect(() => {
    if (online) {
      register();
    }
    return () => {
      if (online) {
        unregister();
      }
    };
  }, [register, unregister, online]);

  // Periodic discovery while on sync page (only when online)
  useEffect(() => {
    if (!online) return;

    const interval = setInterval(() => {
      discoverDevices();
    }, 15000); // Every 15 seconds

    return () => clearInterval(interval);
  }, [discoverDevices, online]);

  return {
    deviceId,
    deviceName,
    updateDeviceName,
    nearbyDevices,
    isDiscovering,
    isSyncing,
    isCaching,
    duplicates,
    deletedByOthers,
    discoverDevices,
    syncData,
    resolveDuplicate,
    confirmSync,
    confirmDeletions,
    dismissDeletions,
    online,
    lastSync,
    pendingChanges,
    cacheDataForOffline,
  };
}
