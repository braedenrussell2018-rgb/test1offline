import { supabase } from "@/integrations/supabase/client";

export interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_account_id?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountTransaction {
  id: string;
  account_id: string;
  transaction_date: string;
  amount: number;
  description?: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

export interface BudgetForecast {
  id: string;
  month: string;
  account_id: string;
  forecasted_amount: number;
  actual_amount: number;
  notes?: string;
  generated_by_ai: boolean;
  created_at: string;
  updated_at: string;
}

export const getAccounts = async (): Promise<Account[]> => {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .order('account_number');

  if (error) throw error;
  return data || [];
};

export const getAccountTransactions = async (startDate?: string, endDate?: string): Promise<AccountTransaction[]> => {
  let query = supabase
    .from('account_transactions')
    .select('*')
    .order('transaction_date', { ascending: false });

  if (startDate) query = query.gte('transaction_date', startDate);
  if (endDate) query = query.lte('transaction_date', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const getBudgetForecasts = async (month: string): Promise<BudgetForecast[]> => {
  const { data, error } = await supabase
    .from('budget_forecasts')
    .select('*')
    .eq('month', month);

  if (error) throw error;
  return data || [];
};

export const generateAIForecast = async (month: string): Promise<BudgetForecast[]> => {
  const { data, error } = await supabase.functions.invoke('generate-budget-forecast', {
    body: { month }
  });

  if (error) throw error;
  return data;
};

export const updateActualAmount = async (forecastId: string, actualAmount: number): Promise<void> => {
  const { error } = await supabase
    .from('budget_forecasts')
    .update({ actual_amount: actualAmount })
    .eq('id', forecastId);

  if (error) throw error;
};

export const getAccountBalance = async (accountId: string, upToDate?: string): Promise<number> => {
  let query = supabase
    .from('account_transactions')
    .select('amount')
    .eq('account_id', accountId);

  if (upToDate) query = query.lte('transaction_date', upToDate);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).reduce((sum, t) => sum + Number(t.amount), 0);
};
