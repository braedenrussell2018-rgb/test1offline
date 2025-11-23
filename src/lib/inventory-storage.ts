// This file now uses Lovable Cloud database instead of localStorage
// All data is persisted securely in the database with authentication

export * from './inventory-storage-adapter';
export { inventoryStorage as default } from './inventory-storage-adapter';
