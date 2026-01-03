import { supabase } from "@/integrations/supabase/client";

export interface Expense {
  id: string;
  employeeName: string;
  customerId?: string;
  amount: number;
  expenseDate: string;
  category: string;
  description?: string;
  receiptUrl?: string;
  creditCardLast4?: string;
  createdAt: string;
}

export const EXPENSE_CATEGORIES = [
  // Utilities
  'utilities_electric',
  'utilities_gas',
  'utilities_water',
  'utilities_internet',
  'utilities_phone',
  // Factory/Shop Supplies
  'factory_supplies',
  'tools',
  'equipment_rental',
  // Shipping & Freight
  'shipping_outbound',
  'shipping_inbound',
  'freight',
  // Labor Categories
  'labor_shop',
  'labor_field',
  'labor_delivery',
  'labor_admin',
  'labor_overtime',
  'labor_contract',
  // Vehicle & Travel
  'fuel',
  'vehicle_maintenance',
  'travel',
  // Office & General
  'office_supplies',
  'food',
  'maintenance',
  'insurance',
  'rent',
  'other'
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

// Define category groups for organized display
export const EXPENSE_CATEGORY_GROUPS: Record<string, { label: string; categories: ExpenseCategory[] }> = {
  utilities: {
    label: 'Utilities',
    categories: ['utilities_electric', 'utilities_gas', 'utilities_water', 'utilities_internet', 'utilities_phone']
  },
  factory: {
    label: 'Factory & Shop Supplies',
    categories: ['factory_supplies', 'tools', 'equipment_rental']
  },
  shipping: {
    label: 'Shipping & Freight',
    categories: ['shipping_outbound', 'shipping_inbound', 'freight']
  },
  labor: {
    label: 'Labor',
    categories: ['labor_shop', 'labor_field', 'labor_delivery', 'labor_admin', 'labor_overtime', 'labor_contract']
  },
  vehicle: {
    label: 'Vehicle & Travel',
    categories: ['fuel', 'vehicle_maintenance', 'travel']
  },
  general: {
    label: 'General & Administrative',
    categories: ['office_supplies', 'food', 'maintenance', 'insurance', 'rent', 'other']
  }
};

export const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    // Utilities
    utilities_electric: 'Electric',
    utilities_gas: 'Gas/Propane',
    utilities_water: 'Water/Sewer',
    utilities_internet: 'Internet',
    utilities_phone: 'Phone/Communications',
    // Factory
    factory_supplies: 'Factory Supplies',
    tools: 'Tools',
    equipment_rental: 'Equipment Rental',
    // Shipping
    shipping_outbound: 'Outbound Shipping',
    shipping_inbound: 'Inbound Shipping',
    freight: 'Freight',
    // Labor
    labor_shop: 'Shop Labor',
    labor_field: 'Field Labor',
    labor_delivery: 'Delivery Labor',
    labor_admin: 'Administrative Labor',
    labor_overtime: 'Overtime',
    labor_contract: 'Contract Labor',
    // Vehicle
    fuel: 'Fuel',
    vehicle_maintenance: 'Vehicle Maintenance',
    travel: 'Travel',
    // General
    office_supplies: 'Office Supplies',
    food: 'Food',
    maintenance: 'Facility Maintenance',
    insurance: 'Insurance',
    rent: 'Rent/Lease',
    other: 'Other'
  };
  return labels[category] || category;
};

export const getCategoryGroup = (category: string): string => {
  for (const [groupKey, group] of Object.entries(EXPENSE_CATEGORY_GROUPS)) {
    if (group.categories.includes(category as ExpenseCategory)) {
      return groupKey;
    }
  }
  return 'general';
};

export const getExpenses = async (): Promise<Expense[]> => {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false });

  if (error) throw error;

  return (data || []).map(e => ({
    id: e.id,
    employeeName: e.employee_name,
    customerId: e.customer_id,
    amount: Number(e.amount),
    expenseDate: e.expense_date,
    category: e.category,
    description: e.description,
    receiptUrl: e.receipt_url,
    creditCardLast4: e.credit_card_last4,
    createdAt: e.created_at || new Date().toISOString(),
  }));
};

export const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> => {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      employee_name: expense.employeeName,
      customer_id: expense.customerId || null,
      amount: expense.amount,
      expense_date: expense.expenseDate,
      category: expense.category,
      description: expense.description || null,
      receipt_url: expense.receiptUrl || null,
      credit_card_last4: expense.creditCardLast4 || null,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    employeeName: data.employee_name,
    customerId: data.customer_id,
    amount: Number(data.amount),
    expenseDate: data.expense_date,
    category: data.category,
    description: data.description,
    receiptUrl: data.receipt_url,
    creditCardLast4: data.credit_card_last4,
    createdAt: data.created_at || new Date().toISOString(),
  };
};

export const updateExpense = async (id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>): Promise<Expense> => {
  const updateData: Record<string, unknown> = {};
  
  if (updates.employeeName !== undefined) updateData.employee_name = updates.employeeName;
  if (updates.customerId !== undefined) updateData.customer_id = updates.customerId || null;
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.expenseDate !== undefined) updateData.expense_date = updates.expenseDate;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.description !== undefined) updateData.description = updates.description || null;
  if (updates.receiptUrl !== undefined) updateData.receipt_url = updates.receiptUrl || null;
  if (updates.creditCardLast4 !== undefined) updateData.credit_card_last4 = updates.creditCardLast4 || null;

  const { data, error } = await supabase
    .from('expenses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    employeeName: data.employee_name,
    customerId: data.customer_id,
    amount: Number(data.amount),
    expenseDate: data.expense_date,
    category: data.category,
    description: data.description,
    receiptUrl: data.receipt_url,
    creditCardLast4: data.credit_card_last4,
    createdAt: data.created_at || new Date().toISOString(),
  };
};

export const deleteExpense = async (id: string): Promise<void> => {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
};

export const getExpensesByCustomerId = async (customerId: string): Promise<Expense[]> => {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('customer_id', customerId)
    .order('expense_date', { ascending: false });

  if (error) throw error;

  return (data || []).map(e => ({
    id: e.id,
    employeeName: e.employee_name,
    customerId: e.customer_id,
    amount: Number(e.amount),
    expenseDate: e.expense_date,
    category: e.category,
    description: e.description,
    receiptUrl: e.receipt_url,
    creditCardLast4: e.credit_card_last4,
    createdAt: e.created_at || new Date().toISOString(),
  }));
};

export const uploadReceipt = async (file: File): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileExt = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${user.id}/${fileName}`;

  const { error } = await supabase.storage
    .from('receipts')
    .upload(filePath, file);

  if (error) throw error;

  // Use signed URL instead of public URL for security
  const { data: signedData, error: signError } = await supabase.storage
    .from('receipts')
    .createSignedUrl(filePath, 86400); // 24 hours expiry

  if (signError) throw signError;

  return signedData.signedUrl;
};

// Helper to get a fresh signed URL for viewing receipts
export const getReceiptSignedUrl = async (receiptPath: string): Promise<string> => {
  // Extract the path from a full URL if needed
  let path = receiptPath;
  if (receiptPath.includes('/storage/v1/object/')) {
    const match = receiptPath.match(/receipts\/(.+)$/);
    if (match) path = match[1];
  }
  
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(path, 3600); // 1 hour for viewing
  
  if (error) throw error;
  return data.signedUrl;
};

export const scanReceipt = async (imageBase64: string): Promise<{
  total: number | null;
  date: string | null;
  creditCardLast4: string | null;
  category: ExpenseCategory | null;
  vendor: string | null;
  description: string | null;
}> => {
  const { data, error } = await supabase.functions.invoke('scan-receipt', {
    body: { imageBase64 }
  });

  if (error) throw error;
  return data;
};