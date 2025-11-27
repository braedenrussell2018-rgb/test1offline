import { supabase } from "@/integrations/supabase/client";

export interface Item {
  id: string;
  partNumber: string;
  description: string;
  status: "available" | "sold";
  salePrice?: number;
  cost?: number;
  weight?: number;
  volume?: number;
  warrantyMonths?: number;
  serialNumber?: string;
  minReorderLevel?: number;
  maxReorderLevel?: number;
  soldInInvoiceId?: string;
  dateSold?: string;
  shelfLocation?: string;
}

export interface Company {
  id: string;
  name: string;
  address?: string;
  notes: Array<{ text: string; timestamp: string }>;
}

export interface Person {
  id: string;
  name: string;
  companyId?: string;
  userId?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes: Array<{ text: string; timestamp: string }>;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  shipToName?: string;
  shipToAddress?: string;
  salesmanName?: string;
  items: Array<{
    id: string;
    partNumber: string;
    description: string;
    sellPrice: number;
    serialNumber?: string;
  }>;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  createdAt: string;
  paid?: boolean;
  paidAt?: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  shipToName?: string;
  shipToAddress?: string;
  salesmanName?: string;
  items: Array<{
    id: string;
    partNumber: string;
    description: string;
    sellPrice: number;
    serialNumber?: string;
  }>;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  createdAt: string;
}

// Companies
export const getCompanies = async (): Promise<Company[]> => {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    address: row.address,
    notes: (row.notes as Array<{ text: string; timestamp: string }>) || [],
  }));
};

export const addCompany = async (name: string, address?: string): Promise<Company> => {
  const { data, error } = await supabase
    .from("companies")
    .insert({ name, address, notes: [] })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    address: data.address,
    notes: (data.notes as Array<{ text: string; timestamp: string }>) || [],
  };
};

export const updateCompany = async (company: Company): Promise<void> => {
  const { error } = await supabase
    .from("companies")
    .update({
      name: company.name,
      address: company.address,
      notes: company.notes,
    })
    .eq("id", company.id);

  if (error) throw error;
};

export const deleteCompany = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

// People
export const getPeople = async (): Promise<Person[]> => {
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    companyId: row.company_id,
    userId: row.user_id,
    jobTitle: row.job_title,
    email: row.email,
    phone: row.phone,
    address: row.address,
    notes: (row.notes as Array<{ text: string; timestamp: string }>) || [],
  }));
};

export const addPerson = async (person: Omit<Person, "id">): Promise<Person> => {
  // Get current user id
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from("people")
    .insert({
      name: person.name,
      company_id: person.companyId,
      user_id: user?.id,
      job_title: person.jobTitle,
      email: person.email,
      phone: person.phone,
      address: person.address,
      notes: person.notes || [],
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    companyId: data.company_id,
    userId: data.user_id,
    jobTitle: data.job_title,
    email: data.email,
    phone: data.phone,
    address: data.address,
    notes: (data.notes as Array<{ text: string; timestamp: string }>) || [],
  };
};

export const updatePerson = async (person: Person): Promise<void> => {
  const { error } = await supabase
    .from("people")
    .update({
      name: person.name,
      company_id: person.companyId,
      job_title: person.jobTitle,
      email: person.email,
      phone: person.phone,
      address: person.address,
      notes: person.notes,
    })
    .eq("id", person.id);

  if (error) throw error;
};

export const deletePerson = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("people")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

// Items
export const getItems = async (): Promise<Item[]> => {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    partNumber: row.part_number,
    description: row.description,
    status: row.status as "available" | "sold",
    salePrice: row.sale_price ? Number(row.sale_price) : undefined,
    cost: row.cost ? Number(row.cost) : undefined,
    weight: row.weight ? Number(row.weight) : undefined,
    volume: row.volume ? Number(row.volume) : undefined,
    warrantyMonths: row.warranty_months,
    serialNumber: row.serial_number,
    minReorderLevel: row.min_reorder_level,
    maxReorderLevel: row.max_reorder_level,
    soldInInvoiceId: row.sold_in_invoice_id,
    dateSold: row.date_sold,
    shelfLocation: row.shelf_location,
  }));
};

export const addItem = async (item: Omit<Item, "id">): Promise<Item> => {
  const { data, error } = await supabase
    .from("items")
    .insert({
      part_number: item.partNumber,
      description: item.description,
      status: item.status,
      sale_price: item.salePrice,
      cost: item.cost,
      weight: item.weight,
      volume: item.volume,
      warranty_months: item.warrantyMonths,
      serial_number: item.serialNumber,
      min_reorder_level: item.minReorderLevel,
      max_reorder_level: item.maxReorderLevel,
      shelf_location: item.shelfLocation,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    partNumber: data.part_number,
    description: data.description,
    status: data.status as "available" | "sold",
    salePrice: data.sale_price ? Number(data.sale_price) : undefined,
    cost: data.cost ? Number(data.cost) : undefined,
    weight: data.weight ? Number(data.weight) : undefined,
    volume: data.volume ? Number(data.volume) : undefined,
    warrantyMonths: data.warranty_months,
    serialNumber: data.serial_number,
    minReorderLevel: data.min_reorder_level,
    maxReorderLevel: data.max_reorder_level,
    shelfLocation: data.shelf_location,
  };
};

export const updateItem = async (item: Item): Promise<void> => {
  const { error } = await supabase
    .from("items")
    .update({
      part_number: item.partNumber,
      description: item.description,
      status: item.status,
      sale_price: item.salePrice,
      cost: item.cost,
      weight: item.weight,
      volume: item.volume,
      warranty_months: item.warrantyMonths,
      serial_number: item.serialNumber,
      min_reorder_level: item.minReorderLevel,
      max_reorder_level: item.maxReorderLevel,
      sold_in_invoice_id: item.soldInInvoiceId,
      date_sold: item.dateSold,
      shelf_location: item.shelfLocation,
    })
    .eq("id", item.id);

  if (error) throw error;
};

// Get unique shelf locations for autocomplete
export const getUniqueShelfLocations = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("items")
    .select("shelf_location")
    .not("shelf_location", "is", null);

  if (error) throw error;
  const locations = new Set<string>();
  (data || []).forEach(row => {
    if (row.shelf_location) {
      locations.add(row.shelf_location);
    }
  });
  return Array.from(locations).sort();
};

export const deleteItem = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

// Invoices
export const getInvoices = async (): Promise<Invoice[]> => {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    customerAddress: row.customer_address,
    shipToName: row.ship_to_name,
    shipToAddress: row.ship_to_address,
    salesmanName: row.salesman_name,
    items: row.items as any[],
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    shipping: Number(row.shipping),
    total: Number(row.total),
    createdAt: row.created_at,
    paid: row.paid || false,
    paidAt: row.paid_at,
  }));
};

export const addInvoice = async (invoice: Omit<Invoice, "id">): Promise<Invoice> => {
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      invoice_number: invoice.invoiceNumber,
      customer_name: invoice.customerName,
      customer_email: invoice.customerEmail,
      customer_phone: invoice.customerPhone,
      customer_address: invoice.customerAddress,
      ship_to_name: invoice.shipToName,
      ship_to_address: invoice.shipToAddress,
      salesman_name: invoice.salesmanName,
      items: invoice.items,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      shipping: invoice.shipping,
      total: invoice.total,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    invoiceNumber: data.invoice_number,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    customerPhone: data.customer_phone,
    customerAddress: data.customer_address,
    shipToName: data.ship_to_name,
    shipToAddress: data.ship_to_address,
    salesmanName: data.salesman_name,
    items: data.items as any[],
    subtotal: Number(data.subtotal),
    discount: Number(data.discount),
    shipping: Number(data.shipping),
    total: Number(data.total),
    createdAt: data.created_at,
  };
};

export const updateInvoice = async (id: string, updates: { paid?: boolean; paidAt?: string }): Promise<void> => {
  const { error } = await supabase
    .from("invoices")
    .update({
      paid: updates.paid,
      paid_at: updates.paidAt,
    })
    .eq("id", id);

  if (error) throw error;
};

// Quotes
export const getQuotes = async (): Promise<Quote[]> => {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    quoteNumber: row.quote_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    customerAddress: row.customer_address,
    shipToName: row.ship_to_name,
    shipToAddress: row.ship_to_address,
    salesmanName: row.salesman_name,
    items: row.items as any[],
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    shipping: Number(row.shipping),
    total: Number(row.total),
    createdAt: row.created_at,
  }));
};

export const addQuote = async (quote: Omit<Quote, "id">): Promise<Quote> => {
  const { data, error } = await supabase
    .from("quotes")
    .insert({
      quote_number: quote.quoteNumber,
      customer_name: quote.customerName,
      customer_email: quote.customerEmail,
      customer_phone: quote.customerPhone,
      customer_address: quote.customerAddress,
      ship_to_name: quote.shipToName,
      ship_to_address: quote.shipToAddress,
      salesman_name: quote.salesmanName,
      items: quote.items,
      subtotal: quote.subtotal,
      discount: quote.discount,
      shipping: quote.shipping,
      total: quote.total,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    quoteNumber: data.quote_number,
    customerName: data.customer_name,
    customerEmail: data.customer_email,
    customerPhone: data.customer_phone,
    customerAddress: data.customer_address,
    shipToName: data.ship_to_name,
    shipToAddress: data.ship_to_address,
    salesmanName: data.salesman_name,
    items: data.items as any[],
    subtotal: Number(data.subtotal),
    discount: Number(data.discount),
    shipping: Number(data.shipping),
    total: Number(data.total),
    createdAt: data.created_at,
  };
};

export const deleteQuote = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", id);

  if (error) throw error;
};
