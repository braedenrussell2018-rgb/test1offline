// IndexedDB-based offline storage for the app
const DB_NAME = "inventory_app_offline";
const DB_VERSION = 1;

type StoreName = "companies" | "people" | "items" | "vendors" | "invoices" | "quotes" | "expenses" | "purchase_orders";

interface SyncQueueItem {
  id: string;
  store: StoreName;
  action: "insert" | "update" | "delete";
  data: any;
  timestamp: number;
}

let db: IDBDatabase | null = null;

const STORES: StoreName[] = ["companies", "people", "items", "vendors", "invoices", "quotes", "expenses", "purchase_orders"];

export async function initOfflineDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object stores for each data type
      STORES.forEach((storeName) => {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: "id" });
        }
      });

      // Create sync queue store for pending changes
      if (!database.objectStoreNames.contains("sync_queue")) {
        const syncQueue = database.createObjectStore("sync_queue", { keyPath: "id" });
        syncQueue.createIndex("timestamp", "timestamp", { unique: false });
      }

      // Create metadata store for last sync time, etc.
      if (!database.objectStoreNames.contains("metadata")) {
        database.createObjectStore("metadata", { keyPath: "key" });
      }
    };
  });
}

export async function saveToOffline<T extends { id: string }>(
  storeName: StoreName,
  data: T[]
): Promise<void> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();

    data.forEach((item) => {
      store.put(item);
    });
  });
}

export async function getFromOffline<T>(storeName: StoreName): Promise<T[]> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

export async function deleteFromOffline(storeName: StoreName, id: string): Promise<void> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearOfflineStore(storeName: StoreName): Promise<void> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Sync queue operations for pending changes when offline
export async function addToSyncQueue(item: Omit<SyncQueueItem, "id" | "timestamp">): Promise<void> {
  const database = await initOfflineDB();
  
  const queueItem: SyncQueueItem = {
    ...item,
    id: `${item.store}_${item.data.id}_${Date.now()}`,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["sync_queue"], "readwrite");
    const store = transaction.objectStore("sync_queue");
    const request = store.add(queueItem);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["sync_queue"], "readonly");
    const store = transaction.objectStore("sync_queue");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const items = request.result as SyncQueueItem[];
      // Sort by timestamp
      items.sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
  });
}

export async function clearSyncQueue(): Promise<void> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["sync_queue"], "readwrite");
    const store = transaction.objectStore("sync_queue");
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["sync_queue"], "readwrite");
    const store = transaction.objectStore("sync_queue");
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Metadata operations
export async function setMetadata(key: string, value: any): Promise<void> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["metadata"], "readwrite");
    const store = transaction.objectStore("metadata");
    const request = store.put({ key, value });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getMetadata<T>(key: string): Promise<T | null> {
  const database = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["metadata"], "readonly");
    const store = transaction.objectStore("metadata");
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.value : null);
    };
  });
}

// Check if the app is online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Listen for online/offline events
export function onConnectionChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

// Full cache sync from Supabase
export async function cacheAllData(supabaseClient: any): Promise<{
  success: boolean;
  error?: string;
  counts?: Record<StoreName, number>;
}> {
  try {
    const counts: Record<string, number> = {};

    // Fetch and cache all data types
    const [companies, people, items, vendors, invoices, quotes, expenses, purchaseOrders] = await Promise.all([
      supabaseClient.from("companies").select("*"),
      supabaseClient.from("people").select("*"),
      supabaseClient.from("items").select("*"),
      supabaseClient.from("vendors").select("*"),
      supabaseClient.from("invoices").select("*"),
      supabaseClient.from("quotes").select("*"),
      supabaseClient.from("expenses").select("*"),
      supabaseClient.from("purchase_orders").select("*"),
    ]);

    // Save to IndexedDB
    if (companies.data) {
      await saveToOffline("companies", companies.data);
      counts.companies = companies.data.length;
    }
    if (people.data) {
      await saveToOffline("people", people.data);
      counts.people = people.data.length;
    }
    if (items.data) {
      await saveToOffline("items", items.data);
      counts.items = items.data.length;
    }
    if (vendors.data) {
      await saveToOffline("vendors", vendors.data);
      counts.vendors = vendors.data.length;
    }
    if (invoices.data) {
      await saveToOffline("invoices", invoices.data);
      counts.invoices = invoices.data.length;
    }
    if (quotes.data) {
      await saveToOffline("quotes", quotes.data);
      counts.quotes = quotes.data.length;
    }
    if (expenses.data) {
      await saveToOffline("expenses", expenses.data);
      counts.expenses = expenses.data.length;
    }
    if (purchaseOrders.data) {
      await saveToOffline("purchase_orders", purchaseOrders.data);
      counts.purchase_orders = purchaseOrders.data.length;
    }

    // Update last sync time
    await setMetadata("lastSync", new Date().toISOString());

    return { success: true, counts: counts as Record<StoreName, number> };
  } catch (error) {
    console.error("Failed to cache data:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}
