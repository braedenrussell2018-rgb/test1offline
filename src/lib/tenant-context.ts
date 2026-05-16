// Shared mutable tenant context, readable from anywhere (React or plain modules).
// Updated by useAuth when the user's profile loads / changes.

let currentTenantId: string | null = null;
const listeners = new Set<(id: string | null) => void>();

export function setCurrentTenantId(id: string | null) {
  if (currentTenantId === id) return;
  currentTenantId = id;
  listeners.forEach((l) => {
    try { l(id); } catch {}
  });
}

export function getCurrentTenantId(): string | null {
  return currentTenantId;
}

/**
 * Use when inserting into a tenant-scoped table.
 * Throws if no tenant is active so we never silently insert NULL.
 */
export function requireTenantId(): string {
  if (!currentTenantId) {
    throw new Error("No active company selected. Please refresh or sign in again.");
  }
  return currentTenantId;
}

export function subscribeTenantId(cb: (id: string | null) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
