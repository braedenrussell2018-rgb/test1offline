-- Create account types enum
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- Create chart of accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_type account_type NOT NULL,
  parent_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create account transactions table
CREATE TABLE public.account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  transaction_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  reference_type TEXT, -- 'invoice', 'expense', 'manual'
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create budget forecasts table
CREATE TABLE public.budget_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  forecasted_amount NUMERIC NOT NULL,
  actual_amount NUMERIC DEFAULT 0,
  notes TEXT,
  generated_by_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(month, account_id)
);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts
CREATE POLICY "Authenticated users can view all accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert accounts"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update accounts"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete accounts"
  ON public.accounts FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for account_transactions
CREATE POLICY "Authenticated users can view all transactions"
  ON public.account_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert transactions"
  ON public.account_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update transactions"
  ON public.account_transactions FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete transactions"
  ON public.account_transactions FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for budget_forecasts
CREATE POLICY "Authenticated users can view all forecasts"
  ON public.budget_forecasts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert forecasts"
  ON public.budget_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update forecasts"
  ON public.budget_forecasts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete forecasts"
  ON public.budget_forecasts FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_accounts_type ON public.accounts(account_type);
CREATE INDEX idx_account_transactions_date ON public.account_transactions(transaction_date);
CREATE INDEX idx_account_transactions_account_id ON public.account_transactions(account_id);
CREATE INDEX idx_budget_forecasts_month ON public.budget_forecasts(month);

-- Create trigger for updated_at
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_forecasts_updated_at
  BEFORE UPDATE ON public.budget_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert standard chart of accounts
INSERT INTO public.accounts (account_number, account_name, account_type, description) VALUES
-- Assets
('1000', 'Cash', 'asset', 'Cash and cash equivalents'),
('1100', 'Accounts Receivable', 'asset', 'Money owed by customers'),
('1200', 'Inventory', 'asset', 'Products available for sale'),
('1300', 'Prepaid Expenses', 'asset', 'Expenses paid in advance'),
('1400', 'Fixed Assets', 'asset', 'Long-term assets'),
-- Liabilities
('2000', 'Accounts Payable', 'liability', 'Money owed to vendors'),
('2100', 'Short-term Debt', 'liability', 'Debt due within one year'),
('2200', 'Long-term Debt', 'liability', 'Debt due after one year'),
-- Equity
('3000', 'Owner Equity', 'equity', 'Owner contributions and retained earnings'),
('3100', 'Retained Earnings', 'equity', 'Cumulative net income'),
-- Revenue
('4000', 'Sales Revenue', 'revenue', 'Revenue from sales'),
('4100', 'Service Revenue', 'revenue', 'Revenue from services'),
-- Expenses
('5000', 'Cost of Goods Sold', 'expense', 'Direct costs of products sold'),
('6000', 'Operating Expenses', 'expense', 'General operating expenses'),
('6100', 'Salaries and Wages', 'expense', 'Employee compensation'),
('6200', 'Rent', 'expense', 'Rent expenses'),
('6300', 'Utilities', 'expense', 'Utility expenses'),
('6400', 'Marketing', 'expense', 'Marketing and advertising'),
('6500', 'Travel', 'expense', 'Travel expenses'),
('6600', 'Office Supplies', 'expense', 'Office supply expenses');