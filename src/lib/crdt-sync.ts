// CRDT-based sync using Yjs for conflict-free data replication
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import { supabase } from "@/integrations/supabase/client";

// Type definitions for our data
export interface CRDTItem {
  id: string;
  data: unknown;
  updatedAt: number;
  deletedAt?: number;
}

export type StoreName = "companies" | "people" | "items" | "vendors" | "invoices" | "quotes" | "expenses" | "purchase_orders";

const STORES: StoreName[] = ["companies", "people", "items", "vendors", "invoices", "quotes", "expenses", "purchase_orders"];

// Singleton Y.Doc instance
let ydoc: Y.Doc | null = null;
let indexeddbProvider: IndexeddbPersistence | null = null;
let webrtcProvider: WebrtcProvider | null = null;

// Event listeners
type SyncEventType = "synced" | "peers-changed" | "conflict-resolved" | "data-changed";
const eventListeners: Map<SyncEventType, Set<(data?: unknown) => void>> = new Map();

function emit(event: SyncEventType, data?: unknown) {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach(cb => cb(data));
  }
}

export function onSyncEvent(event: SyncEventType, callback: (data?: unknown) => void): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(callback);
  return () => {
    eventListeners.get(event)?.delete(callback);
  };
}

// Initialize CRDT sync
export async function initCRDTSync(roomName?: string): Promise<Y.Doc> {
  if (ydoc) return ydoc;

  ydoc = new Y.Doc();

  // Set up IndexedDB persistence for offline storage
  indexeddbProvider = new IndexeddbPersistence("inventory-crdt-db", ydoc);
  
  indexeddbProvider.on("synced", () => {
    console.log("CRDT: Loaded from IndexedDB");
    emit("synced", { source: "indexeddb" });
  });

  // Set up WebRTC for peer-to-peer sync
  // Use a room name based on user session or shared key
  const room = roomName || generateRoomName();
  
  webrtcProvider = new WebrtcProvider(room, ydoc, {
    signaling: ["wss://signaling.yjs.dev"], // Public signaling server
  });

  webrtcProvider.on("synced", () => {
    console.log("CRDT: Synced with peers via WebRTC");
    emit("synced", { source: "webrtc" });
  });

  webrtcProvider.on("peers", (event: { webrtcPeers: string[], bcPeers: string[] }) => {
    const peerCount = event.webrtcPeers.length + event.bcPeers.length;
    console.log(`CRDT: ${peerCount} peer(s) connected`);
    emit("peers-changed", { count: peerCount, peers: [...event.webrtcPeers, ...event.bcPeers] });
  });

  // Initialize Y.Maps for each store
  STORES.forEach(storeName => {
    ydoc!.getMap(storeName);
  });

  // Observe changes for each store
  STORES.forEach(storeName => {
    const ymap = ydoc!.getMap(storeName);
    ymap.observe((event) => {
      emit("data-changed", { store: storeName, changes: event.changes });
    });
  });

  return ydoc;
}

// Generate a room name (shared between devices of the same user)
function generateRoomName(): string {
  // Use a stored room key or generate one
  let roomKey = localStorage.getItem("crdt_room_key");
  if (!roomKey) {
    roomKey = `inventory-room-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem("crdt_room_key", roomKey);
  }
  return roomKey;
}

// Get or create the room key (for sharing with other devices)
export function getRoomKey(): string {
  return generateRoomName();
}

// Join a specific room (for syncing with another device)
export async function joinRoom(roomKey: string): Promise<void> {
  localStorage.setItem("crdt_room_key", roomKey);
  
  // Reinitialize with new room
  await destroyCRDTSync();
  await initCRDTSync(roomKey);
}

// Get data from CRDT store
export function getCRDTData<T>(storeName: StoreName): T[] {
  if (!ydoc) return [];
  
  const ymap = ydoc.getMap(storeName);
  const items: T[] = [];
  
  ymap.forEach((value: unknown) => {
    const item = value as CRDTItem;
    if (!item.deletedAt) {
      items.push(item.data as T);
    }
  });
  
  return items;
}

// Set data in CRDT store (handles conflicts automatically)
export function setCRDTData<T extends { id: string }>(storeName: StoreName, item: T): void {
  if (!ydoc) return;
  
  const ymap = ydoc.getMap(storeName);
  const existingItem = ymap.get(item.id) as CRDTItem | undefined;
  
  const now = Date.now();
  const crdtItem: CRDTItem = {
    id: item.id,
    data: item,
    updatedAt: now,
  };
  
  // Check for conflicts (if item was updated elsewhere more recently)
  if (existingItem && existingItem.updatedAt > now - 1000) {
    // Merge strategy: keep both changes by merging fields
    const existingData = existingItem.data as Record<string, unknown>;
    const mergedData = { ...existingData, ...item };
    crdtItem.data = mergedData;
    emit("conflict-resolved", { store: storeName, item: mergedData, strategy: "merge" });
  }
  
  ymap.set(item.id, crdtItem);
}

// Delete data from CRDT store (soft delete for sync)
export function deleteCRDTData(storeName: StoreName, id: string): void {
  if (!ydoc) return;
  
  const ymap = ydoc.getMap(storeName);
  const existingItem = ymap.get(id) as CRDTItem | undefined;
  
  if (existingItem) {
    // Soft delete - mark as deleted but keep for sync
    const deletedItem: CRDTItem = {
      ...existingItem,
      deletedAt: Date.now(),
    };
    ymap.set(id, deletedItem);
  }
}

// Bulk set data (for initial sync from server)
export function bulkSetCRDTData<T extends { id: string }>(storeName: StoreName, items: T[]): void {
  if (!ydoc) return;
  
  ydoc.transact(() => {
    const ymap = ydoc!.getMap(storeName);
    items.forEach(item => {
      const crdtItem: CRDTItem = {
        id: item.id,
        data: item,
        updatedAt: Date.now(),
      };
      ymap.set(item.id, crdtItem);
    });
  });
}

// Sync CRDT data to Supabase (when online)
export async function syncCRDTToSupabase(): Promise<{ success: boolean; error?: string }> {
  if (!ydoc) return { success: false, error: "CRDT not initialized" };
  
  try {
    for (const storeName of STORES) {
      const items = getCRDTData<Record<string, unknown>>(storeName);
      
      if (items.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase
          .from(storeName)
          .upsert(items as any, { onConflict: "id" });
        
        if (error) {
          console.error(`Failed to sync ${storeName}:`, error);
          throw error;
        }
      }
      
      // Handle deletions
      const ymap = ydoc.getMap(storeName);
      const deletedIds: string[] = [];
      ymap.forEach((value: unknown, key) => {
        const item = value as CRDTItem;
        if (item.deletedAt) {
          deletedIds.push(key);
        }
      });
      
      if (deletedIds.length > 0) {
        const { error } = await supabase
          .from(storeName)
          .delete()
          .in("id", deletedIds);
        
        if (error) {
          console.error(`Failed to delete from ${storeName}:`, error);
        } else {
          // Clean up deleted items from CRDT after successful server delete
          ydoc.transact(() => {
            deletedIds.forEach(id => ymap.delete(id));
          });
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

// Load data from Supabase into CRDT (initial load)
export async function loadFromSupabase(): Promise<{ success: boolean; error?: string }> {
  if (!ydoc) return { success: false, error: "CRDT not initialized" };
  
  try {
    const results = await Promise.all([
      supabase.from("companies").select("*"),
      supabase.from("people").select("*"),
      supabase.from("items").select("*"),
      supabase.from("vendors").select("*"),
      supabase.from("invoices").select("*"),
      supabase.from("quotes").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("purchase_orders").select("*"),
    ]);
    
    ydoc.transact(() => {
      STORES.forEach((storeName, index) => {
        const data = results[index].data || [];
        data.forEach((item: Record<string, unknown>) => {
          const ymap = ydoc!.getMap(storeName);
          const itemId = String(item.id || '');
          const existingItem = ymap.get(itemId) as CRDTItem | undefined;
          
          // Only update if server version is newer or item doesn't exist locally
          const updatedAt = item.updated_at || item.created_at;
          const serverTime = updatedAt ? new Date(String(updatedAt)).getTime() : 0;
          if (!existingItem || serverTime > existingItem.updatedAt) {
            const crdtItem: CRDTItem = {
              id: itemId,
              data: item,
              updatedAt: serverTime || Date.now(),
            };
            ymap.set(itemId, crdtItem);
          }
        });
      });
    });
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

// Get connection status
export function getCRDTStatus(): {
  initialized: boolean;
  indexeddbSynced: boolean;
  webrtcConnected: boolean;
  peerCount: number;
  roomKey: string;
} {
  return {
    initialized: !!ydoc,
    indexeddbSynced: indexeddbProvider?.synced ?? false,
    webrtcConnected: webrtcProvider?.connected ?? false,
    peerCount: webrtcProvider?.awareness.getStates().size ?? 0,
    roomKey: getRoomKey(),
  };
}

// Clean up on unmount
export async function destroyCRDTSync(): Promise<void> {
  if (webrtcProvider) {
    webrtcProvider.destroy();
    webrtcProvider = null;
  }
  
  if (indexeddbProvider) {
    await indexeddbProvider.destroy();
    indexeddbProvider = null;
  }
  
  if (ydoc) {
    ydoc.destroy();
    ydoc = null;
  }
}

// Get peer awareness (for showing who's connected)
export function getPeerAwareness(): Map<number, unknown> {
  if (!webrtcProvider) return new Map();
  return webrtcProvider.awareness.getStates();
}

// Set local awareness state (name, cursor position, etc.)
export function setLocalAwareness(state: Record<string, unknown>): void {
  if (!webrtcProvider) return;
  webrtcProvider.awareness.setLocalStateField("user", state);
}
