-- Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal NUMERIC NOT NULL,
  shipping NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create purchase_order_items table for tracking individual items
CREATE TABLE public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  part_number TEXT NOT NULL,
  serial_number TEXT,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  received_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendors
CREATE POLICY "Authenticated users can view all vendors"
  ON public.vendors FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert vendors"
  ON public.vendors FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vendors"
  ON public.vendors FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete vendors"
  ON public.vendors FOR DELETE
  USING (true);

-- RLS Policies for purchase_orders
CREATE POLICY "Authenticated users can view all purchase orders"
  ON public.purchase_orders FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert purchase orders"
  ON public.purchase_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update purchase orders"
  ON public.purchase_orders FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete purchase orders"
  ON public.purchase_orders FOR DELETE
  USING (true);

-- RLS Policies for purchase_order_items
CREATE POLICY "Authenticated users can view all PO items"
  ON public.purchase_order_items FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert PO items"
  ON public.purchase_order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update PO items"
  ON public.purchase_order_items FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete PO items"
  ON public.purchase_order_items FOR DELETE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();