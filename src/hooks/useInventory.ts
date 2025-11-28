import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryStorage, InventoryItem } from "@/lib/inventory-storage";
import { toast } from "@/hooks/use-toast";

export const INVENTORY_QUERY_KEY = ["inventory"];
export const SOLD_ITEMS_QUERY_KEY = ["sold-items"];

export function useInventoryItems() {
  return useQuery({
    queryKey: INVENTORY_QUERY_KEY,
    queryFn: async () => {
      const items = await inventoryStorage.getItems();
      return items.filter(item => item.status !== 'sold');
    },
  });
}

export function useSoldItems() {
  return useQuery({
    queryKey: SOLD_ITEMS_QUERY_KEY,
    queryFn: async () => {
      const items = await inventoryStorage.getItems();
      return items.filter(item => item.status === 'sold' && item.soldDate);
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InventoryItem> }) => {
      await inventoryStorage.updateItem(id, updates);
    },
    onSuccess: () => {
      // Invalidate both queries to refresh the data
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SOLD_ITEMS_QUERY_KEY });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      });
    },
  });
}
