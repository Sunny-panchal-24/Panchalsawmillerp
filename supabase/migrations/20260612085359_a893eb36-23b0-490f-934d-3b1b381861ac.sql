
-- Sales table
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_no text NOT NULL,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  sale_type text NOT NULL CHECK (sale_type IN ('waste','finished')),
  gross_weight numeric NOT NULL DEFAULT 0,
  empty_weight numeric NOT NULL DEFAULT 0,
  net_weight numeric NOT NULL DEFAULT 0,
  cft numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  outstanding numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'credit' CHECK (payment_status IN ('full','partial','credit')),
  payment_mode text,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  remarks text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_owner_all" ON public.sales FOR ALL TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE TRIGGER sales_set_updated BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Customer receipts
CREATE TABLE public.customer_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'cash',
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  remarks text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_receipts TO authenticated;
GRANT ALL ON public.customer_receipts TO service_role;
ALTER TABLE public.customer_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_receipts_owner_all" ON public.customer_receipts FOR ALL TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE TRIGGER customer_receipts_set_updated BEFORE UPDATE ON public.customer_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX sales_customer_idx ON public.sales(customer_id);
CREATE INDEX sales_date_idx ON public.sales(sale_date DESC);
CREATE INDEX cr_customer_idx ON public.customer_receipts(customer_id);
