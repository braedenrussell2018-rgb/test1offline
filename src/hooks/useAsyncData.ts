import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

interface UseAsyncDataOptions<T> {
  /** Initial data value */
  initialData?: T;
  /** Whether to load data immediately on mount */
  loadOnMount?: boolean;
  /** Error message to display on failure */
  errorMessage?: string;
  /** Number of retry attempts */
  retryCount?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Cache key for deduplication */
  cacheKey?: string;
  /** Cache duration in ms (default 5 minutes) */
  cacheDuration?: number;
}

interface UseAsyncDataReturn<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  setData: (data: T | ((prev: T | undefined) => T)) => void;
}

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const pendingRequests = new Map<string, Promise<unknown>>();

const DEFAULT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  options: UseAsyncDataOptions<T> = {}
): UseAsyncDataReturn<T> {
  const {
    initialData,
    loadOnMount = true,
    errorMessage = "Failed to load data. Please try again.",
    retryCount = 3,
    retryDelay = 1000,
    cacheKey,
    cacheDuration = DEFAULT_CACHE_DURATION,
  } = options;

  const [data, setDataState] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  const setData = useCallback((newData: T | ((prev: T | undefined) => T)) => {
    if (typeof newData === "function") {
      setDataState((prev) => (newData as (prev: T | undefined) => T)(prev));
    } else {
      setDataState(newData);
    }
  }, []);

  const load = useCallback(async (showToast = true, bypassCache = false) => {
    // Prevent duplicate requests
    if (loadingRef.current) return;

    // Check cache
    if (cacheKey && !bypassCache) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheDuration) {
        setDataState(cached.data as T);
        return;
      }

      // Check for pending request
      const pending = pendingRequests.get(cacheKey);
      if (pending) {
        try {
          const result = await pending;
          if (mountedRef.current) {
            setDataState(result as T);
          }
          return;
        } catch {
          // Let it fall through to retry
        }
      }
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    let lastError: Error | null = null;
    let attempt = 0;

    const fetchPromise = (async () => {
      while (attempt < retryCount) {
        try {
          const result = await fetchFn();
          
          if (!mountedRef.current) return result;

          setDataState(result);
          setError(null);

          // Update cache
          if (cacheKey) {
            cache.set(cacheKey, { data: result, timestamp: Date.now() });
          }

          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          attempt++;
          console.error(`Attempt ${attempt}/${retryCount} failed:`, lastError);

          if (attempt < retryCount) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
          }
        }
      }

      throw lastError;
    })();

    if (cacheKey) {
      pendingRequests.set(cacheKey, fetchPromise);
    }

    try {
      await fetchPromise;
    } catch (err) {
      if (mountedRef.current) {
        const finalError = err instanceof Error ? err : new Error(String(err));
        setError(finalError);
        if (showToast) {
          toast.error(errorMessage);
        }
        console.error("Failed to load data after retries:", finalError);
      }
    } finally {
      if (cacheKey) {
        pendingRequests.delete(cacheKey);
      }
      if (mountedRef.current) {
        setLoading(false);
      }
      loadingRef.current = false;
    }
  }, [fetchFn, errorMessage, retryCount, retryDelay, cacheKey, cacheDuration]);

  const refresh = useCallback(async () => {
    // Bypass cache for refresh
    if (cacheKey) {
      cache.delete(cacheKey);
    }
    await load(true, true);
  }, [load, cacheKey]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (loadOnMount) {
      load(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [loadOnMount]); // Only run on mount, not when load changes

  return { data, loading, error, load, refresh, setData };
}

// Utility to clear cache
export function clearAsyncDataCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// Utility to prefetch data
export async function prefetchAsyncData<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  cacheDuration = DEFAULT_CACHE_DURATION
): Promise<void> {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cacheDuration) {
    return;
  }

  try {
    const data = await fetchFn();
    cache.set(cacheKey, { data, timestamp: Date.now() });
  } catch (error) {
    console.error("Prefetch failed:", error);
  }
}
