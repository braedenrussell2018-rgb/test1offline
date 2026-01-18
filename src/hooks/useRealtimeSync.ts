import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { toast } from "sonner";

type TableName = "companies" | "people" | "items" | "quotes" | "invoices" | "branches";

interface UseRealtimeSyncOptions {
  tables: TableName[];
  onDataChange: () => void;
  showToasts?: boolean;
}

const tableDisplayNames: Record<TableName, string> = {
  companies: "Company",
  people: "Contact",
  items: "Item",
  quotes: "Quote",
  invoices: "Invoice",
  branches: "Branch",
};

export function useRealtimeSync({ tables, onDataChange, showToasts = true }: UseRealtimeSyncOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced refresh to batch rapid changes
  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onDataChange();
    }, 300);
  }, [onDataChange]);

  useEffect(() => {
    // Create a single channel for all tables
    const channel = supabase.channel("crm-realtime-sync");

    // Subscribe to each table
    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const displayName = tableDisplayNames[table];
          
          if (showToasts) {
            switch (payload.eventType) {
              case "INSERT":
                toast.info(`New ${displayName.toLowerCase()} added`, {
                  description: "Data synced from another user",
                  duration: 3000,
                });
                break;
              case "UPDATE":
                toast.info(`${displayName} updated`, {
                  description: "Data synced from another user",
                  duration: 3000,
                });
                break;
              case "DELETE":
                toast.info(`${displayName} removed`, {
                  description: "Data synced from another user",
                  duration: 3000,
                });
                break;
            }
          }

          // Trigger debounced refresh
          debouncedRefresh();
        }
      );
    });

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("Realtime sync connected");
      } else if (status === "CHANNEL_ERROR") {
        console.error("Realtime sync error");
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [tables, debouncedRefresh, showToasts]);

  return {
    isConnected: channelRef.current?.state === "joined",
  };
}
