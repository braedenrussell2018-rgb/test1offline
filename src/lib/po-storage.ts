import { supabase } from "@/integrations/supabase/client";

export interface Vendor {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: any[];
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
  items: any[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
    notes: Array.isArray(v.notes) ? v.notes : [],
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  }));
}

export async function addVendor(vendor: Omit<Vendor, "id" | "createdAt" | "updatedAt">): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .insert({
      name: vendor.name,
      contact_name: vendor.contactName,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      notes: vendor.notes || [],
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
    notes: Array.isArray(data.notes) ? data.notes : [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
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
    items: Array.isArray(po.items) ? po.items : [],
    notes: po.notes || "",
    createdAt: po.created_at,
    updatedAt: po.updated_at,
  }));
}

export async function addPurchaseOrder(po: Omit<PurchaseOrder, "id" | "createdAt" | "updatedAt">): Promise<PurchaseOrder> {
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
      items: po.items,
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
    items: Array.isArray(data.items) ? data.items : [],
    notes: data.notes || "",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updatePurchaseOrder(po: PurchaseOrder): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({
      status: po.status,
      subtotal: po.subtotal,
      shipping: po.shipping,
      tax: po.tax,
      total: po.total,
      items: po.items,
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
    serialNumber: item.serial_number,
    description: item.description,
    quantity: item.quantity,
    unitCost: Number(item.unit_cost),
    totalCost: Number(item.total_cost),
    receivedQuantity: item.received_quantity,
    createdAt: item.created_at,
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
