import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface Note {
  id?: string;
  text: string;
  timestamp: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: Note[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  status: 'pending' | 'received' | 'partial' | 'cancelled';
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  items: POItemSummary[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface POItemSummary {
  itemId?: string;
  partNumber: string;
  serialNumber?: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQuantity?: number;
}

export interface POItem {
  id: string;
  poId: string;
  partNumber: string;
  serialNumber?: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQuantity: number;
  createdAt: string;
}

// Helper to safely convert Json to Note[]
function jsonToNotes(json: Json | null): Note[] {
  if (!json || !Array.isArray(json)) return [];
  return json.map(item => {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>;
      return {
        id: typeof obj.id === 'string' ? obj.id : undefined,
        text: typeof obj.text === 'string' ? obj.text : '',
        timestamp: typeof obj.timestamp === 'string' ? obj.timestamp : new Date().toISOString(),
      };
    }
    return { text: '', timestamp: new Date().toISOString() };
  });
}

// Helper to safely convert Json to POItemSummary[]
function jsonToPOItems(json: Json | null): POItemSummary[] {
  if (!json || !Array.isArray(json)) return [];
  return json.map(item => {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>;
      return {
        itemId: typeof obj.itemId === 'string' ? obj.itemId : undefined,
        partNumber: typeof obj.partNumber === 'string' ? obj.partNumber : '',
        serialNumber: typeof obj.serialNumber === 'string' ? obj.serialNumber : undefined,
        description: typeof obj.description === 'string' ? obj.description : '',
        quantity: typeof obj.quantity === 'number' ? obj.quantity : 0,
        unitCost: typeof obj.unitCost === 'number' ? obj.unitCost : 0,
        totalCost: typeof obj.totalCost === 'number' ? obj.totalCost : 0,
        receivedQuantity: typeof obj.receivedQuantity === 'number' ? obj.receivedQuantity : undefined,
      };
    }
    return { partNumber: '', description: '', quantity: 0, unitCost: 0, totalCost: 0 };
  });
}

// Vendors
export async function getVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('name');
  
  if (error) throw error;
  
  return (data || []).map(v => ({
    id: v.id,
    name: v.name,
    contactName: v.contact_name || "",
    email: v.email || "",
    phone: v.phone || "",
    address: v.address || "",
    notes: jsonToNotes(v.notes),
    createdAt: v.created_at || new Date().toISOString(),
    updatedAt: v.updated_at || new Date().toISOString(),
  }));
}

export async function addVendor(vendor: Omit<Vendor, "id" | "createdAt" | "updatedAt">): Promise<Vendor> {
  const notesJson = (vendor.notes || []) as unknown as Json;
  
  const { data, error } = await supabase
    .from('vendors')
    .insert({
      name: vendor.name,
      contact_name: vendor.contactName,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      notes: notesJson,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    name: data.name,
    contactName: data.contact_name || "",
    email: data.email || "",
    phone: data.phone || "",
    address: data.address || "",
    notes: jsonToNotes(data.notes),
    createdAt: data.created_at || new Date().toISOString(),
    updatedAt: data.updated_at || new Date().toISOString(),
  };
}

// Purchase Orders
export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(po => ({
    id: po.id,
    poNumber: po.po_number,
    vendorId: po.vendor_id || "",
    vendorName: po.vendor_name,
    status: (po.status || 'pending') as 'pending' | 'received' | 'partial' | 'cancelled',
    subtotal: Number(po.subtotal),
    shipping: Number(po.shipping || 0),
    tax: Number(po.tax || 0),
    total: Number(po.total),
    items: jsonToPOItems(po.items),
    notes: po.notes || "",
    createdAt: po.created_at || new Date().toISOString(),
    updatedAt: po.updated_at || new Date().toISOString(),
  }));
}

export async function addPurchaseOrder(po: Omit<PurchaseOrder, "id" | "createdAt" | "updatedAt">): Promise<PurchaseOrder> {
  const itemsJson = po.items as unknown as Json;
  
  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({
      po_number: po.poNumber,
      vendor_id: po.vendorId,
      vendor_name: po.vendorName,
      status: po.status,
      subtotal: po.subtotal,
      shipping: po.shipping,
      tax: po.tax,
      total: po.total,
      items: itemsJson,
      notes: po.notes,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    poNumber: data.po_number,
    vendorId: data.vendor_id || "",
    vendorName: data.vendor_name,
    status: (data.status || 'pending') as 'pending' | 'received' | 'partial' | 'cancelled',
    subtotal: Number(data.subtotal),
    shipping: Number(data.shipping || 0),
    tax: Number(data.tax || 0),
    total: Number(data.total),
    items: jsonToPOItems(data.items),
    notes: data.notes || "",
    createdAt: data.created_at || new Date().toISOString(),
    updatedAt: data.updated_at || new Date().toISOString(),
  };
}

export async function updatePurchaseOrder(po: PurchaseOrder): Promise<void> {
  const itemsJson = po.items as unknown as Json;
  
  const { error } = await supabase
    .from('purchase_orders')
    .update({
      status: po.status,
      subtotal: po.subtotal,
      shipping: po.shipping,
      tax: po.tax,
      total: po.total,
      items: itemsJson,
      notes: po.notes,
    })
    .eq('id', po.id);
  
  if (error) throw error;
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// PO Items
export async function getPOItems(poId: string): Promise<POItem[]> {
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('po_id', poId)
    .order('created_at');
  
  if (error) throw error;
  
  return (data || []).map(item => ({
    id: item.id,
    poId: item.po_id,
    partNumber: item.part_number,
    serialNumber: item.serial_number || undefined,
    description: item.description,
    quantity: item.quantity,
    unitCost: Number(item.unit_cost),
    totalCost: Number(item.total_cost),
    receivedQuantity: item.received_quantity || 0,
    createdAt: item.created_at || new Date().toISOString(),
  }));
}

export async function addPOItems(items: Omit<POItem, "id" | "createdAt">[]): Promise<void> {
  const { error } = await supabase
    .from('purchase_order_items')
    .insert(items.map(item => ({
      po_id: item.poId,
      part_number: item.partNumber,
      serial_number: item.serialNumber,
      description: item.description,
      quantity: item.quantity,
      unit_cost: item.unitCost,
      total_cost: item.totalCost,
      received_quantity: item.receivedQuantity,
    })));
  
  if (error) throw error;
}
