// Adapter layer that bridges the existing localStorage interfaces with the new database storage
import * as db from "./supabase-storage";
import { supabase } from "@/integrations/supabase/client";

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
  shelfLocation?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  estimateId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  shipToName?: string;
  shipToAddress?: string;
  salesmanName?: string;
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
  paid?: boolean;
  paidAt?: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  shipToName?: string;
  shipToAddress?: string;
  salesmanName?: string;
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
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  address?: string;
  notes: Array<{ text: string; timestamp: string }>;
  createdAt: string;
}

export interface Note {
  id: string;
  text: string;
  timestamp: string;
}

export interface Person {
  id: string;
  companyId?: string;
  userId?: string;
  name: string;
  jobTitle?: string;
  address?: string;
  notes: Note[];
  email?: string;
  phone?: string;
  excavatorLines?: string[];
  createdAt: string;
}

// Convert DB item to local format
function convertItemFromDB(item: db.Item): InventoryItem {
  return {
    id: item.id,
    partNumber: item.partNumber,
    serialNumber: item.serialNumber,
    description: item.description,
    salePrice: item.salePrice || 0,
    cost: item.cost || 0,
    weight: item.weight,
    volume: item.volume,
    warranty: item.warrantyMonths ? `${item.warrantyMonths} months` : undefined,
    minReorderLevel: item.minReorderLevel,
    maxReorderLevel: item.maxReorderLevel,
    status: item.status,
    soldDate: item.dateSold,
    invoiceId: item.soldInInvoiceId,
    createdAt: item.createdAt || new Date().toISOString(),
    shelfLocation: item.shelfLocation,
  };
}

// Convert local item to DB format
function convertItemToDB(item: Partial<InventoryItem>): Partial<db.Item> {
  const warrantyMonths = item.warranty ? parseInt(item.warranty) : undefined;
  
  return {
    partNumber: item.partNumber!,
    serialNumber: item.serialNumber,
    description: item.description!,
    salePrice: item.salePrice,
    cost: item.cost,
    weight: item.weight,
    volume: item.volume,
    warrantyMonths,
    minReorderLevel: item.minReorderLevel,
    maxReorderLevel: item.maxReorderLevel,
    status: item.status!,
    soldInInvoiceId: item.invoiceId,
    dateSold: item.soldDate,
    shelfLocation: item.shelfLocation,
  };
}

// Get unique shelf locations for autocomplete
export const getUniqueShelfLocations = async (): Promise<string[]> => {
  return db.getUniqueShelfLocations();
};

// Items
export const getItems = async (): Promise<InventoryItem[]> => {
  const items = await db.getItems();
  return items.map(convertItemFromDB);
};

export const addItem = async (item: Omit<InventoryItem, "id" | "createdAt">): Promise<InventoryItem> => {
  const dbItem = await db.addItem(convertItemToDB(item) as Omit<db.Item, "id">);
  return convertItemFromDB(dbItem);
};

export const updateItem = async (id: string, updates: Partial<InventoryItem>): Promise<void> => {
  const items = await db.getItems();
  const item = items.find(i => i.id === id);
  if (!item) throw new Error("Item not found");
  
  const updated = { ...item, ...convertItemToDB(updates), id };
  await db.updateItem(updated as db.Item);
};

export const deleteItem = async (id: string): Promise<void> => {
  await db.deleteItem(id);
};

// Companies
export const getCompanies = async (): Promise<Company[]> => {
  const companies = await db.getCompanies();
  return companies.map(c => ({
    ...c,
    createdAt: new Date().toISOString(),
  }));
};

export const addCompany = async (name: string, address?: string): Promise<Company> => {
  const company = await db.addCompany(name, address);
  return {
    ...company,
    createdAt: new Date().toISOString(),
  };
};

export const updateCompany = async (company: Company): Promise<void> => {
  await db.updateCompany(company);
};

export const deleteCompany = async (id: string): Promise<void> => {
  await db.deleteCompany(id);
};

// People
export const getPeople = async (): Promise<Person[]> => {
  const people = await db.getPeople();
  return people.map(p => ({
    id: p.id,
    companyId: p.companyId,
    userId: p.userId,
    name: p.name,
    jobTitle: p.jobTitle,
    address: p.address,
    notes: p.notes.map(n => ({ id: crypto.randomUUID(), ...n })),
    email: p.email,
    phone: p.phone,
    excavatorLines: p.excavatorLines || [],
    createdAt: new Date().toISOString(),
  }));
};

export const addPerson = async (person: Omit<Person, "id" | "createdAt">): Promise<Person> => {
  const dbPerson = await db.addPerson({
    name: person.name,
    companyId: person.companyId,
    jobTitle: person.jobTitle,
    email: person.email,
    phone: person.phone,
    address: person.address,
    notes: person.notes || [],
    excavatorLines: person.excavatorLines || [],
  });
  
  return {
    id: dbPerson.id,
    companyId: dbPerson.companyId,
    userId: dbPerson.userId,
    name: dbPerson.name,
    jobTitle: dbPerson.jobTitle,
    address: dbPerson.address,
    notes: dbPerson.notes.map(n => ({ id: crypto.randomUUID(), ...n })),
    email: dbPerson.email,
    phone: dbPerson.phone,
    excavatorLines: dbPerson.excavatorLines || [],
    createdAt: new Date().toISOString(),
  };
};

export const updatePerson = async (person: Person): Promise<void> => {
  await db.updatePerson({
    id: person.id,
    name: person.name,
    companyId: person.companyId,
    jobTitle: person.jobTitle,
    email: person.email,
    phone: person.phone,
    address: person.address,
    notes: person.notes,
    excavatorLines: person.excavatorLines || [],
  });
};

// Get unique excavator lines for autocomplete
export const getUniqueExcavatorLines = async (): Promise<string[]> => {
  return db.getUniqueExcavatorLines();
};

export const deletePerson = async (id: string): Promise<void> => {
  await db.deletePerson(id);
};

// Invoices
export const getInvoices = async (): Promise<Invoice[]> => {
  const invoices = await db.getInvoices();
  return invoices.map(inv => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    customerName: inv.customerName,
    customerEmail: inv.customerEmail,
    customerPhone: inv.customerPhone,
    customerAddress: inv.customerAddress,
    shipToName: inv.shipToName,
    shipToAddress: inv.shipToAddress,
    salesmanName: inv.salesmanName,
    items: inv.items.map((item: any) => ({
      itemId: item.id,
      partNumber: item.partNumber,
      serialNumber: item.serialNumber,
      description: item.description,
      price: item.sellPrice,
    })),
    subtotal: inv.subtotal,
    discount: inv.discount,
    shippingCost: inv.shipping,
    total: inv.total,
    createdAt: inv.createdAt,
    paid: inv.paid || false,
    paidAt: inv.paidAt,
  }));
};

export const addInvoice = async (invoice: Omit<Invoice, "id" | "createdAt">): Promise<Invoice> => {
  const dbInvoice = await db.addInvoice({
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName!,
    customerEmail: invoice.customerEmail,
    customerPhone: invoice.customerPhone,
    customerAddress: invoice.customerAddress,
    shipToName: invoice.shipToName,
    shipToAddress: invoice.shipToAddress,
    salesmanName: invoice.salesmanName,
    items: invoice.items.map(item => ({
      id: item.itemId,
      partNumber: item.partNumber,
      serialNumber: item.serialNumber,
      description: item.description,
      sellPrice: item.price,
    })),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    shipping: invoice.shippingCost,
    total: invoice.total,
    createdAt: new Date().toISOString(),
  });

  return {
    id: dbInvoice.id,
    invoiceNumber: dbInvoice.invoiceNumber,
    customerName: dbInvoice.customerName,
    customerEmail: dbInvoice.customerEmail,
    customerPhone: dbInvoice.customerPhone,
    customerAddress: dbInvoice.customerAddress,
    shipToName: dbInvoice.shipToName,
    shipToAddress: dbInvoice.shipToAddress,
    salesmanName: dbInvoice.salesmanName,
    items: dbInvoice.items.map((item: any) => ({
      itemId: item.id,
      partNumber: item.partNumber,
      serialNumber: item.serialNumber,
      description: item.description,
      price: item.sellPrice,
    })),
    subtotal: dbInvoice.subtotal,
    discount: dbInvoice.discount,
    shippingCost: dbInvoice.shipping,
    total: dbInvoice.total,
    createdAt: dbInvoice.createdAt,
  };
};

export const updateInvoicePaidStatus = async (id: string, paid: boolean): Promise<void> => {
  await db.updateInvoice(id, { 
    paid, 
    paidAt: paid ? new Date().toISOString() : undefined 
  });
};

// Quotes
export const getQuotes = async (): Promise<Quote[]> => {
  const quotes = await db.getQuotes();
  return quotes.map(quote => ({
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    customerPhone: quote.customerPhone,
    customerAddress: quote.customerAddress,
    shipToName: quote.shipToName,
    shipToAddress: quote.shipToAddress,
    salesmanName: quote.salesmanName,
    items: quote.items.map((item: any) => ({
      itemId: item.id,
      partNumber: item.partNumber,
      serialNumber: item.serialNumber,
      description: item.description,
      price: item.sellPrice,
    })),
    subtotal: quote.subtotal,
    discount: quote.discount,
    shippingCost: quote.shipping,
    total: quote.total,
    status: 'pending',
    createdAt: quote.createdAt,
  }));
};

export const addQuote = async (quote: Omit<Quote, "id" | "createdAt">): Promise<Quote> => {
  const dbQuote = await db.addQuote({
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName!,
    customerEmail: quote.customerEmail,
    customerPhone: quote.customerPhone,
    customerAddress: quote.customerAddress,
    shipToName: quote.shipToName,
    shipToAddress: quote.shipToAddress,
    salesmanName: quote.salesmanName,
    items: quote.items.map(item => ({
      id: item.itemId,
      partNumber: item.partNumber,
      serialNumber: item.serialNumber,
      description: item.description,
      sellPrice: item.price,
    })),
    subtotal: quote.subtotal,
    discount: quote.discount,
    shipping: quote.shippingCost,
    total: quote.total,
    createdAt: new Date().toISOString(),
  });

  return {
    id: dbQuote.id,
    quoteNumber: dbQuote.quoteNumber,
    customerName: dbQuote.customerName,
    customerEmail: dbQuote.customerEmail,
    customerPhone: dbQuote.customerPhone,
    customerAddress: dbQuote.customerAddress,
    shipToName: dbQuote.shipToName,
    shipToAddress: dbQuote.shipToAddress,
    salesmanName: dbQuote.salesmanName,
    items: dbQuote.items.map((item: any) => ({
      itemId: item.id,
      partNumber: item.partNumber,
      serialNumber: item.serialNumber,
      description: item.description,
      price: item.sellPrice,
    })),
    subtotal: dbQuote.subtotal,
    discount: dbQuote.discount,
    shippingCost: dbQuote.shipping,
    total: dbQuote.total,
    status: 'pending',
    createdAt: dbQuote.createdAt,
  };
};

export const deleteQuote = async (id: string): Promise<void> => {
  await db.deleteQuote(id);
};

// Helper functions
export const getPersons = getPeople; // Alias for compatibility

export const addNoteToPerson = async (personId: string, noteText: string): Promise<void> => {
  // Use the security definer function to add notes (allows any authenticated user to add notes)
  const { error } = await supabase.rpc('add_note_to_contact', {
    p_person_id: personId,
    p_note_text: noteText
  });
  
  if (error) throw error;
};

export const createInvoice = addInvoice; // Alias for compatibility
export const createQuote = addQuote; // Alias for compatibility

export const updateQuote = async (quote: Quote): Promise<void> => {
  // For now, we'll delete and recreate since we don't have an update function
  // In a real implementation, you'd add an update function to supabase-storage
  await deleteQuote(quote.id);
  await addQuote(quote);
};

// Legacy compatibility - export as default object
export const inventoryStorage = {
  getItems,
  addItem,
  updateItem,
  deleteItem,
  getCompanies,
  addCompany,
  updateCompany,
  deleteCompany,
  getPeople,
  getPersons,
  addPerson,
  updatePerson,
  deletePerson,
  addNoteToPerson,
  getInvoices,
  addInvoice,
  createInvoice,
  updateInvoicePaidStatus,
  getQuotes,
  addQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  getUniqueShelfLocations,
  getUniqueExcavatorLines,
};
