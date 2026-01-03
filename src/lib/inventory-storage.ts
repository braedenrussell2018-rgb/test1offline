// This file now uses Lovable Cloud database instead of localStorage
// All data is persisted securely in the database with authentication

export * from './inventory-storage-adapter';
export { inventoryStorage as default } from './inventory-storage-adapter';

// Re-export types needed by other modules
export type { InventoryItem as Item } from './inventory-storage-adapter';

// Vendor type for useDeviceSync
export interface Vendor {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes: Array<{ text: string; timestamp: string }>;
  createdAt: string;
}
