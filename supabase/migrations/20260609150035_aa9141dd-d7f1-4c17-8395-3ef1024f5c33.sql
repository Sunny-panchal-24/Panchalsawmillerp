
-- ENUMS
CREATE TYPE public.payment_mode AS ENUM ('cash','dad_saving','dad_current','sunny_saving');
CREATE TYPE public.customer_type AS ENUM ('waste','finished','both');
CREATE TYPE public.salary_type AS ENUM ('weekly','monthly');
CREATE TYPE public.purchase_type AS ENUM ('A','B');

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- VENDORS
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  village text,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read vendors" ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner/acc manage vendors" ON public.vendors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'));
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CUSTOMERS
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  gstin text,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  type public.customer_type NOT NULL DEFAULT 'both',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner/acc manage customers" ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'));
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TRACTORS
CREATE TABLE public.tractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL,
  default_empty_weight numeric(10,2) NOT NULL DEFAULT 0,
  driver_name text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tractors TO authenticated;
GRANT ALL ON public.tractors TO service_role;
ALTER TABLE public.tractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tractors" ON public.tractors FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner/acc manage tractors" ON public.tractors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'));
CREATE TRIGGER trg_tractors_updated BEFORE UPDATE ON public.tractors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WORKERS
CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  daily_wage numeric(10,2) NOT NULL DEFAULT 0,
  salary_type public.salary_type NOT NULL DEFAULT 'monthly',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read workers" ON public.workers FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner/acc manage workers" ON public.workers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'));
CREATE TRIGGER trg_workers_updated BEFORE UPDATE ON public.workers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PURCHASES
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_no text NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  tractor_id uuid REFERENCES public.tractors(id) ON DELETE SET NULL,
  weight_with_material numeric(10,2) NOT NULL DEFAULT 0,
  empty_weight numeric(10,2) NOT NULL DEFAULT 0,
  net_weight numeric(10,2) NOT NULL DEFAULT 0,
  net_man numeric(12,4) NOT NULL DEFAULT 0,
  ptype public.purchase_type NOT NULL DEFAULT 'A',
  actual_man numeric(12,4) NOT NULL DEFAULT 0,
  rate_per_man numeric(12,2) NOT NULL DEFAULT 0,
  material_cost numeric(14,2) NOT NULL DEFAULT 0,
  forest_expense numeric(12,2) NOT NULL DEFAULT 0,
  chai_pani_expense numeric(12,2) NOT NULL DEFAULT 0,
  tractor_labour numeric(12,2) NOT NULL DEFAULT 0,
  diesel_expense numeric(12,2) NOT NULL DEFAULT 0,
  other_expense numeric(12,2) NOT NULL DEFAULT 0,
  total_cost numeric(14,2) NOT NULL DEFAULT 0,
  cost_per_man numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_mode public.payment_mode,
  remarks text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner/acc read purchases" ON public.purchases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'));
CREATE POLICY "owner/acc manage purchases" ON public.purchases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'));
CREATE TRIGGER trg_purchases_updated BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_purchases_vendor ON public.purchases(vendor_id);
CREATE INDEX idx_purchases_date ON public.purchases(entry_date);

-- VENDOR PAYMENTS
CREATE TABLE public.vendor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL,
  mode public.payment_mode NOT NULL DEFAULT 'cash',
  remarks text,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_payments TO authenticated;
GRANT ALL ON public.vendor_payments TO service_role;
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner/acc read vendor_payments" ON public.vendor_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'));
CREATE POLICY "owner/acc manage vendor_payments" ON public.vendor_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'));
CREATE TRIGGER trg_vendor_payments_updated BEFORE UPDATE ON public.vendor_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_vendor_payments_vendor ON public.vendor_payments(vendor_id);
CREATE INDEX idx_vendor_payments_date ON public.vendor_payments(payment_date);
