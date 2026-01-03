// React hook for CRDT-based sync
import { useState, useEffect, useCallback, useRef } from "react";
import {
  initCRDTSync,
  destroyCRDTSync,
  getCRDTData,
  setCRDTData,
  deleteCRDTData,
  bulkSetCRDTData,
  syncCRDTToSupabase,
  loadFromSupabase,
  getCRDTStatus,
  getRoomKey,
  joinRoom,
  onSyncEvent,
  setLocalAwareness,
  getPeerAwareness,
  StoreName,
} from "@/lib/crdt-sync";
import { toast } from "sonner";
import { requestNotificationPermission, showNotification } from "@/lib/push-notifications";

interface UseCRDTSyncOptions {
  autoSync?: boolean;
  syncIntervalMs?: number;
  deviceName?: string;
}

interface PeerInfo {
  id: number;
  name: string;
  lastSeen: Date;
}

export function useCRDTSync(options: UseCRDTSyncOptions = {}) {
  const { autoSync = true, syncIntervalMs = 30000, deviceName } = options;
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [roomKey, setRoomKey] = useState<string>("");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize CRDT sync
  useEffect(() => {
    const init = async () => {
      try {
        await initCRDTSync();
        setIsInitialized(true);
        setRoomKey(getRoomKey());
        
        // Set device name in awareness
        if (deviceName) {
          setLocalAwareness({ name: deviceName });
        }
        
        // Load initial data from server if online
        if (navigator.onLine) {
          await loadFromSupabase();
        }
      } catch (error) {
        console.error("Failed to initialize CRDT sync:", error);
        toast.error("Failed to initialize sync");
      }
    };
    
    init();
    
    return () => {
      destroyCRDTSync();
    };
  }, [deviceName]);
  
  // Set up event listeners
  useEffect(() => {
    const unsubSynced = onSyncEvent("synced", (data: { source?: string } | undefined) => {
      setLastSyncTime(new Date());
      if (data?.source === "webrtc" && notificationsEnabled) {
        showNotification("Sync Complete", {
          body: "Your data has been synced with other devices",
          tag: "sync-complete",
        });
      }
    });
    
    const unsubPeers = onSyncEvent("peers-changed", (data: { count?: number } | undefined) => {
      setPeerCount(data?.count || 0);
      
      // Update peer info from awareness
      const awarenessStates = getPeerAwareness();
      const peerInfos: PeerInfo[] = [];
      awarenessStates.forEach((state: { user?: { name?: string } }, id: number) => {
        if (state.user?.name) {
          peerInfos.push({
            id,
            name: state.user.name,
            lastSeen: new Date(),
          });
        }
      });
      setPeers(peerInfos);
    });
    
    const unsubConflict = onSyncEvent("conflict-resolved", (data: { store?: string } | undefined) => {
      console.log("Conflict resolved:", data);
      if (notificationsEnabled) {
        showNotification("Conflict Resolved", {
          body: `A conflict in ${data?.store} was automatically resolved`,
          tag: "conflict-resolved",
        });
      }
    });
    
    const unsubDataChanged = onSyncEvent("data-changed", () => {
      // Data changed, could trigger UI refresh
    });
    
    return () => {
      unsubSynced();
      unsubPeers();
      unsubConflict();
      unsubDataChanged();
    };
  }, [notificationsEnabled]);
  
  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back online!");
      // Auto-sync when coming back online
      syncToServer();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You're offline. Changes will sync when back online.");
    };
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  
  // Auto-sync interval
  useEffect(() => {
    if (autoSync && isOnline && isInitialized) {
      syncIntervalRef.current = setInterval(() => {
        syncToServer();
      }, syncIntervalMs);
      
      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [autoSync, isOnline, isInitialized, syncIntervalMs]);
  
  // Sync to Supabase server
  const syncToServer = useCallback(async () => {
    if (!isOnline || !isInitialized || isSyncing) return;
    
    setIsSyncing(true);
    try {
      const result = await syncCRDTToSupabase();
      if (result.success) {
        setLastSyncTime(new Date());
      } else {
        console.error("Sync failed:", result.error);
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isInitialized, isSyncing]);
  
  // Load from server
  const refreshFromServer = useCallback(async () => {
    if (!isOnline || !isInitialized) return;
    
    setIsSyncing(true);
    try {
      const result = await loadFromSupabase();
      if (result.success) {
        setLastSyncTime(new Date());
        toast.success("Data refreshed from server");
      } else {
        toast.error("Failed to refresh: " + result.error);
      }
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isInitialized]);
  
  // Get data from a specific store
  const getData = useCallback(<T,>(storeName: StoreName): T[] => {
    if (!isInitialized) return [];
    return getCRDTData<T>(storeName);
  }, [isInitialized]);
  
  // Set data in a specific store
  const setData = useCallback(<T extends { id: string }>(storeName: StoreName, item: T) => {
    if (!isInitialized) return;
    setCRDTData(storeName, item);
  }, [isInitialized]);
  
  // Delete data from a specific store
  const deleteData = useCallback((storeName: StoreName, id: string) => {
    if (!isInitialized) return;
    deleteCRDTData(storeName, id);
  }, [isInitialized]);
  
  // Bulk set data
  const bulkSetData = useCallback(<T extends { id: string }>(storeName: StoreName, items: T[]) => {
    if (!isInitialized) return;
    bulkSetCRDTData(storeName, items);
  }, [isInitialized]);
  
  // Join a sync room (for connecting to another device)
  const connectToRoom = useCallback(async (newRoomKey: string) => {
    try {
      await joinRoom(newRoomKey);
      setRoomKey(newRoomKey);
      toast.success("Connected to sync room");
    } catch (error) {
      console.error("Failed to join room:", error);
      toast.error("Failed to connect to sync room");
    }
  }, []);
  
  // Enable push notifications
  const enableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      toast.success("Notifications enabled");
    } else {
      toast.error("Notification permission denied");
    }
    return granted;
  }, []);
  
  // Get current status
  const getStatus = useCallback(() => {
    return getCRDTStatus();
  }, []);
  
  return {
    // State
    isInitialized,
    isOnline,
    isSyncing,
    peerCount,
    peers,
    roomKey,
    lastSyncTime,
    notificationsEnabled,
    
    // Actions
    syncToServer,
    refreshFromServer,
    getData,
    setData,
    deleteData,
    bulkSetData,
    connectToRoom,
    enableNotifications,
    getStatus,
  };
}
