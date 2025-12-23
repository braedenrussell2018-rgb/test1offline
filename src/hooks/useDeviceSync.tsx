import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Device {
  deviceId: string;
  deviceName: string;
}

interface DuplicateResult {
  type: string;
  incoming: any;
  existing: any;
  field: string;
}

interface SyncData {
  companies?: any[];
  people?: any[];
  items?: any[];
  vendors?: any[];
}

// Generate or retrieve device ID
const getDeviceId = (): string => {
  let deviceId = localStorage.getItem("device_sync_id");
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("device_sync_id", deviceId);
  }
  return deviceId;
};

// Generate device name
const getDeviceName = (): string => {
  let deviceName = localStorage.getItem("device_sync_name");
  if (!deviceName) {
    const platform = /iPad|iPhone|iPod/.test(navigator.userAgent) ? "iOS Device" : "Device";
    deviceName = `${platform} ${Date.now().toString(36).toUpperCase().slice(-4)}`;
    localStorage.setItem("device_sync_name", deviceName);
  }
  return deviceName;
};

export function useDeviceSync() {
  const [deviceId] = useState(getDeviceId);
  const [deviceName, setDeviceName] = useState(getDeviceName);
  const [nearbyDevices, setNearbyDevices] = useState<Device[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateResult[]>([]);
  const [pendingData, setPendingData] = useState<SyncData | null>(null);

  const callSyncFunction = async (payload: any) => {
    const { data, error } = await supabase.functions.invoke("sync-data", {
      body: payload,
    });
    if (error) throw error;
    return data;
  };

  const register = useCallback(async () => {
    try {
      await callSyncFunction({
        action: "register",
        deviceId,
        deviceName,
      });
    } catch (error) {
      console.error("Failed to register device:", error);
    }
  }, [deviceId, deviceName]);

  const unregister = useCallback(async () => {
    try {
      await callSyncFunction({
        action: "unregister",
        deviceId,
        deviceName,
      });
    } catch (error) {
      console.error("Failed to unregister device:", error);
    }
  }, [deviceId, deviceName]);

  const discoverDevices = useCallback(async () => {
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
      toast.error("Failed to discover nearby devices");
    } finally {
      setIsDiscovering(false);
    }
  }, [deviceId, deviceName]);

  const fetchLocalData = async (): Promise<SyncData> => {
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
  };

  const syncData = useCallback(async (dataToSync?: SyncData) => {
    setIsSyncing(true);
    setDuplicates([]);
    
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
        setPendingData(data);
        toast.warning(`Found ${result.duplicates.length} potential duplicate(s)`);
        return { status: "duplicates", duplicates: result.duplicates };
      }

      toast.success("Data synced successfully!");
      return { status: "success", results: result.results };
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Failed to sync data");
      return { status: "error", error };
    } finally {
      setIsSyncing(false);
    }
  }, [deviceId, deviceName]);

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
      // This is a simplified version - in production you'd filter by ID
    }
    // keep_both - both records stay, no action needed
  }, [pendingData]);

  const confirmSync = useCallback(async () => {
    if (!pendingData) return;
    
    // Clear duplicates and force sync
    setDuplicates([]);
    
    // For now, we'll do a simple upsert ignoring duplicates
    setIsSyncing(true);
    try {
      const data = pendingData;
      
      // Upsert all data
      if (data.companies?.length) {
        await supabase.from("companies").upsert(data.companies, { onConflict: "id" });
      }
      if (data.people?.length) {
        await supabase.from("people").upsert(data.people, { onConflict: "id" });
      }
      if (data.items?.length) {
        await supabase.from("items").upsert(data.items, { onConflict: "id" });
      }
      if (data.vendors?.length) {
        await supabase.from("vendors").upsert(data.vendors, { onConflict: "id" });
      }

      toast.success("Data synced successfully!");
      setPendingData(null);
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Failed to sync data");
    } finally {
      setIsSyncing(false);
    }
  }, [pendingData]);

  const updateDeviceName = useCallback((newName: string) => {
    setDeviceName(newName);
    localStorage.setItem("device_sync_name", newName);
  }, []);

  // Register on mount, unregister on unmount
  useEffect(() => {
    register();
    return () => {
      unregister();
    };
  }, [register, unregister]);

  // Periodic discovery while on sync page
  useEffect(() => {
    const interval = setInterval(() => {
      discoverDevices();
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [discoverDevices]);

  return {
    deviceId,
    deviceName,
    updateDeviceName,
    nearbyDevices,
    isDiscovering,
    isSyncing,
    duplicates,
    discoverDevices,
    syncData,
    resolveDuplicate,
    confirmSync,
  };
}
