// Push notification utilities for PWA

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission === "denied") {
    console.warn("Notification permission was denied");
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
}

export interface NotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: unknown;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export function showNotification(title: string, options: NotificationOptions = {}): void {
  if (!("Notification" in window)) {
    console.warn("Notifications not supported");
    return;
  }
  
  if (Notification.permission !== "granted") {
    console.warn("Notification permission not granted");
    return;
  }
  
  const defaultOptions: NotificationOptions = {
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: [100, 50, 100],
    ...options,
  };
  
  // Use service worker notifications if available for better background support
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, defaultOptions);
    }).catch((error) => {
      console.error("Service worker notification failed:", error);
      // Fall back to regular notification
      new Notification(title, defaultOptions);
    });
  } else {
    new Notification(title, defaultOptions);
  }
}

// Notification types for the app
export const NotificationTypes = {
  SYNC_COMPLETE: "sync-complete",
  CONFLICT_RESOLVED: "conflict-resolved",
  PEER_CONNECTED: "peer-connected",
  PEER_DISCONNECTED: "peer-disconnected",
  OFFLINE: "offline",
  ONLINE: "online",
  DATA_UPDATED: "data-updated",
} as const;

export type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

// Show a sync notification
export function showSyncNotification(message: string): void {
  showNotification("Sync Update", {
    body: message,
    tag: NotificationTypes.SYNC_COMPLETE,
    silent: true,
  });
}

// Show a peer connection notification
export function showPeerNotification(peerName: string, connected: boolean): void {
  const type = connected ? NotificationTypes.PEER_CONNECTED : NotificationTypes.PEER_DISCONNECTED;
  const message = connected ? `${peerName} is now syncing` : `${peerName} disconnected`;
  
  showNotification("Peer Update", {
    body: message,
    tag: type,
    silent: true,
  });
}

// Show a conflict notification
export function showConflictNotification(storeName: string, resolved: boolean): void {
  const message = resolved 
    ? `A conflict in ${storeName} was automatically resolved`
    : `There's a conflict in ${storeName} that needs attention`;
  
  showNotification("Sync Conflict", {
    body: message,
    tag: NotificationTypes.CONFLICT_RESOLVED,
    requireInteraction: !resolved,
  });
}

// Check if notifications are supported and enabled
export function getNotificationStatus(): {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
} {
  if (!("Notification" in window)) {
    return { supported: false, permission: "unsupported" };
  }
  
  return {
    supported: true,
    permission: Notification.permission,
  };
}

// Request persistent storage (for better offline support)
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    console.warn("Persistent storage not supported");
    return false;
  }
  
  try {
    const isPersisted = await navigator.storage.persist();
    console.log(`Persistent storage: ${isPersisted ? "granted" : "denied"}`);
    return isPersisted;
  } catch (error) {
    console.error("Error requesting persistent storage:", error);
    return false;
  }
}

// Get storage estimate
export async function getStorageEstimate(): Promise<{
  quota?: number;
  usage?: number;
  percentUsed?: number;
}> {
  if (!navigator.storage?.estimate) {
    return {};
  }
  
  try {
    const estimate = await navigator.storage.estimate();
    const percentUsed = estimate.quota && estimate.usage 
      ? (estimate.usage / estimate.quota) * 100 
      : undefined;
    
    return {
      quota: estimate.quota,
      usage: estimate.usage,
      percentUsed,
    };
  } catch (error) {
    console.error("Error getting storage estimate:", error);
    return {};
  }
}
