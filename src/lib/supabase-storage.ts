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
  createdAt?: string;
}

export interface Company {
  id: string;
  name: string;
  address?: string;
  notes: Array<{ text: string; timestamp: string }>;
}

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  address?: string;
}

export interface Person {
  id: string;
  name: string;
  companyId?: string;
  branchId?: string;
  userId?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes: Array<{ text: string; timestamp: string }>;
  excavatorLines?: string[];
  createdAt?: string;
  updatedAt?: string;
  createdByName?: string;
  updatedByName?: string;
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
  status?: 'draft' | 'finalized';
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
  return (data || []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    address: row.address as string | undefined,
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

// Branches
export const getBranches = async (): Promise<Branch[]> => {
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id),
    companyId: String(row.company_id),
    name: String(row.name),
    address: row.address as string | undefined,
  }));
};

export const getBranchesByCompany = async (companyId: string): Promise<Branch[]> => {
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id),
    companyId: String(row.company_id),
    name: String(row.name),
    address: row.address as string | undefined,
  }));
};

export const addBranch = async (branch: Omit<Branch, "id">): Promise<Branch> => {
  const { data, error } = await supabase
    .from("branches")
    .insert({
      company_id: branch.companyId,
      name: branch.name,
      address: branch.address,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    companyId: data.company_id,
    name: data.name,
    address: data.address,
  };
};

export const updateBranch = async (branch: Branch): Promise<void> => {
  const { error } = await supabase
    .from("branches")
    .update({
      name: branch.name,
      address: branch.address,
    })
    .eq("id", branch.id);

  if (error) throw error;
};

export const deleteBranch = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("branches")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

// People
export const getPeople = async (): Promise<Person[]> => {
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Collect unique user IDs from created_by and updated_by
  const userIds = new Set<string>();
  (data || []).forEach((row: any) => {
    if (row.created_by) userIds.add(row.created_by);
    if (row.updated_by) userIds.add(row.updated_by);
  });

  // Fetch profile names for those user IDs
  let nameMap: Record<string, string> = {};
  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", Array.from(userIds));
    profiles?.forEach((p) => { nameMap[p.user_id] = p.full_name; });
  }

  return (data || []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name),
    companyId: row.company_id as string | undefined,
    branchId: row.branch_id as string | undefined,
    userId: row.user_id as string | undefined,
    jobTitle: row.job_title as string | undefined,
    email: row.email as string | undefined,
    phone: row.phone as string | undefined,
    address: row.address as string | undefined,
    notes: (row.notes as Array<{ text: string; timestamp: string }>) || [],
    excavatorLines: (row.excavator_lines as string[]) || [],
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
    createdByName: row.created_by ? nameMap[row.created_by] || undefined : undefined,
    updatedByName: row.updated_by ? nameMap[row.updated_by] || undefined : undefined,
  }));
};

export const addPerson = async (person: Omit<Person, "id">): Promise<Person> => {
  // Get current user id
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from("people")
    .insert({
      name: person.name,
      company_id: person.companyId || null, // Convert empty string to null
      branch_id: person.branchId || null, // Convert empty string to null
      user_id: user?.id,
      job_title: person.jobTitle || null,
      email: person.email || null,
      phone: person.phone || null,
      address: person.address || null,
      notes: person.notes || [],
      excavator_lines: person.excavatorLines || [],
      created_by: user?.id || null,
      updated_by: user?.id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    companyId: data.company_id,
    branchId: data.branch_id,
    userId: data.user_id,
    jobTitle: data.job_title,
    email: data.email,
    phone: data.phone,
    address: data.address,
    notes: (data.notes as Array<{ text: string; timestamp: string }>) || [],
    excavatorLines: (data.excavator_lines as string[]) || [],
  };
};

export const updatePerson = async (person: Person): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("people")
    .update({
      name: person.name,
      company_id: person.companyId || null,
      branch_id: person.branchId || null,
      job_title: person.jobTitle || null,
      email: person.email || null,
      phone: person.phone || null,
      address: person.address || null,
      notes: person.notes,
      excavator_lines: person.excavatorLines || [],
      updated_by: user?.id || null,
    })
    .eq("id", person.id);

  if (error) throw error;
};

// Get unique excavator lines for autocomplete
export const getUniqueExcavatorLines = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("people")
    .select("excavator_lines")
    .is("deleted_at", null); // Filter out soft-deleted contacts

  if (error) throw error;
  const lines = new Set<string>();
  (data || []).forEach(row => {
    const excavatorLines = row.excavator_lines as string[] | null;
    if (excavatorLines) {
      excavatorLines.forEach(line => lines.add(line));
    }
  });
  return Array.from(lines).sort();
};

export const deletePerson = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("people")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

// Items - fetch all items using pagination to avoid the 1000 row limit
export const getItems = async (): Promise<Item[]> => {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData.map((row) => ({
    id: String(row.id),
    partNumber: String(row.part_number),
    description: String(row.description),
    status: row.status as "available" | "sold",
    salePrice: row.sale_price ? Number(row.sale_price) : undefined,
    cost: row.cost ? Number(row.cost) : undefined,
    weight: row.weight ? Number(row.weight) : undefined,
    volume: row.volume ? Number(row.volume) : undefined,
    warrantyMonths: row.warranty_months as number | undefined,
    serialNumber: row.serial_number as string | undefined,
    minReorderLevel: row.min_reorder_level as number | undefined,
    maxReorderLevel: row.max_reorder_level as number | undefined,
    soldInInvoiceId: row.sold_in_invoice_id as string | undefined,
    dateSold: row.date_sold as string | undefined,
    shelfLocation: row.shelf_location as string | undefined,
    createdAt: row.created_at as string | undefined,
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
  return (data || []).map((row) => ({
    id: String(row.id),
    invoiceNumber: String(row.invoice_number),
    customerName: String(row.customer_name),
    customerEmail: row.customer_email as string | undefined,
    customerPhone: row.customer_phone as string | undefined,
    customerAddress: row.customer_address as string | undefined,
    shipToName: row.ship_to_name as string | undefined,
    shipToAddress: row.ship_to_address as string | undefined,
    salesmanName: row.salesman_name as string | undefined,
    items: row.items as Array<{ id: string; partNumber: string; description: string; sellPrice: number; serialNumber?: string }>,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    shipping: Number(row.shipping),
    total: Number(row.total),
    createdAt: String(row.created_at),
    paid: Boolean(row.paid),
    paidAt: row.paid_at as string | undefined,
    status: (row as any).status as 'draft' | 'finalized' | undefined,
  }));
};

export const addInvoice = async (invoice: Omit<Invoice, "id">, status: 'draft' | 'finalized' = 'finalized'): Promise<Invoice> => {
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
      status: status,
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
    items: data.items as Array<{ id: string; partNumber: string; description: string; sellPrice: number; serialNumber?: string }>,
    subtotal: Number(data.subtotal),
    discount: Number(data.discount),
    shipping: Number(data.shipping),
    total: Number(data.total),
    createdAt: data.created_at,
    status: (data as any).status as 'draft' | 'finalized',
  };
};

export const updateInvoice = async (id: string, updates: {
  paid?: boolean;
  paidAt?: string;
  salesmanName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shipToAddress?: string;
  items?: Array<{ id: string; partNumber: string; description: string; sellPrice: number; serialNumber?: string }>;
  subtotal?: number;
  discount?: number;
  shipping?: number;
  total?: number;
  status?: 'draft' | 'finalized';
}): Promise<void> => {
  const updateData: Record<string, unknown> = {};
  if (updates.paid !== undefined) updateData.paid = updates.paid;
  if (updates.paidAt !== undefined) updateData.paid_at = updates.paidAt;
  if (updates.salesmanName !== undefined) updateData.salesman_name = updates.salesmanName;
  if (updates.customerName !== undefined) updateData.customer_name = updates.customerName;
  if (updates.customerEmail !== undefined) updateData.customer_email = updates.customerEmail;
  if (updates.customerPhone !== undefined) updateData.customer_phone = updates.customerPhone;
  if (updates.shipToAddress !== undefined) updateData.ship_to_address = updates.shipToAddress;
  if (updates.items !== undefined) updateData.items = updates.items;
  if (updates.subtotal !== undefined) updateData.subtotal = updates.subtotal;
  if (updates.discount !== undefined) updateData.discount = updates.discount;
  if (updates.shipping !== undefined) updateData.shipping = updates.shipping;
  if (updates.total !== undefined) updateData.total = updates.total;
  if (updates.status !== undefined) updateData.status = updates.status;

  const { error } = await supabase
    .from("invoices")
    .update(updateData)
    .eq("id", id);

  if (error) throw error;
};

export const deleteInvoice = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

export const updateQuoteSalesman = async (id: string, salesmanName: string): Promise<void> => {
  const { error } = await supabase
    .from("quotes")
    .update({ salesman_name: salesmanName })
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
  return (data || []).map((row) => ({
    id: String(row.id),
    quoteNumber: String(row.quote_number),
    customerName: String(row.customer_name),
    customerEmail: row.customer_email as string | undefined,
    customerPhone: row.customer_phone as string | undefined,
    customerAddress: row.customer_address as string | undefined,
    shipToName: row.ship_to_name as string | undefined,
    shipToAddress: row.ship_to_address as string | undefined,
    salesmanName: row.salesman_name as string | undefined,
    items: row.items as Array<{ id: string; partNumber: string; description: string; sellPrice: number; serialNumber?: string }>,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    shipping: Number(row.shipping),
    total: Number(row.total),
    createdAt: String(row.created_at),
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
    items: data.items as Array<{ id: string; partNumber: string; description: string; sellPrice: number; serialNumber?: string }>,
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
