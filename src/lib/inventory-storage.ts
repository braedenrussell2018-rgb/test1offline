export interface InventoryItem {
  id: string;
  partNumber: string;
  serialNumber?: string;
  description: string;
  salePrice: number;
  cost: number;
  weight?: number;
  volume?: number;
  warranty?: string;
  minReorderLevel?: number;
  maxReorderLevel?: number;
  status: 'available' | 'sold';
  soldDate?: string;
  invoiceId?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shipToAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  items: {
    itemId: string;
    partNumber: string;
    serialNumber?: string;
    description: string;
    price: number;
  }[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  createdAt: string;
}

const INVENTORY_KEY = 'inventory_items';
const INVOICES_KEY = 'invoices';
const INVOICE_COUNTER_KEY = 'invoice_counter';

export const inventoryStorage = {
  getItems: (): InventoryItem[] => {
    const data = localStorage.getItem(INVENTORY_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveItems: (items: InventoryItem[]) => {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
  },

  addItem: (item: Omit<InventoryItem, 'id' | 'createdAt'>) => {
    const items = inventoryStorage.getItems();
    const newItem: InventoryItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    items.push(newItem);
    inventoryStorage.saveItems(items);
    return newItem;
  },

  updateItem: (id: string, updates: Partial<InventoryItem>) => {
    const items = inventoryStorage.getItems();
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      inventoryStorage.saveItems(items);
      return items[index];
    }
    return null;
  },

  deleteItem: (id: string) => {
    const items = inventoryStorage.getItems();
    const filtered = items.filter(item => item.id !== id);
    inventoryStorage.saveItems(filtered);
  },

  getInvoices: (): Invoice[] => {
    const data = localStorage.getItem(INVOICES_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveInvoices: (invoices: Invoice[]) => {
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
  },

  getNextInvoiceNumber: (): string => {
    const counter = localStorage.getItem(INVOICE_COUNTER_KEY);
    const num = counter ? parseInt(counter) : 0;
    const nextNum = num + 1;
    localStorage.setItem(INVOICE_COUNTER_KEY, nextNum.toString());
    return `INV-${String(nextNum).padStart(5, '0')}`;
  },

  createInvoice: (data: {
    items: { itemId: string; partNumber: string; serialNumber?: string; description: string; price: number }[];
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    shipToAddress?: { street: string; city: string; state: string; zip: string };
    discount: number;
    shippingCost: number;
  }) => {
    const invoices = inventoryStorage.getInvoices();
    const subtotal = data.items.reduce((sum, item) => sum + item.price, 0);
    const total = subtotal - data.discount + data.shippingCost;
    
    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      invoiceNumber: inventoryStorage.getNextInvoiceNumber(),
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      shipToAddress: data.shipToAddress,
      items: data.items,
      subtotal,
      discount: data.discount,
      shippingCost: data.shippingCost,
      total,
      createdAt: new Date().toISOString(),
    };
    invoices.push(newInvoice);
    inventoryStorage.saveInvoices(invoices);
    return newInvoice;
  },
};
