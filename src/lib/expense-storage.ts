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
  'fuel',
  'food',
  'tools',
  'office_supplies',
  'travel',
  'maintenance',
  'utilities',
  'other'
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    fuel: 'Fuel',
    food: 'Food',
    tools: 'Tools',
    office_supplies: 'Office Supplies',
    travel: 'Travel',
    maintenance: 'Maintenance',
    utilities: 'Utilities',
    other: 'Other'
  };
  return labels[category] || category;
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
  const fileExt = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `receipts/${fileName}`;

  const { error } = await supabase.storage
    .from('receipts')
    .upload(filePath, file);

  if (error) throw error;

  const { data } = supabase.storage
    .from('receipts')
    .getPublicUrl(filePath);

  return data.publicUrl;
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