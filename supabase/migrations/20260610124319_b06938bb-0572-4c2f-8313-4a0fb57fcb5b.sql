
-- 1. Dynamic bank accounts
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  opening_balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages own banks" ON public.bank_accounts
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Drop fixed bank columns from company_settings (keep opening_cash)
ALTER TABLE public.company_settings
  DROP COLUMN IF EXISTS opening_dad_saving,
  DROP COLUMN IF EXISTS opening_dad_current,
  DROP COLUMN IF EXISTS opening_sunny_saving;

-- 3. Add bank_account_id to purchases & vendor_payments (nullable = cash)
ALTER TABLE public.purchases
  ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.vendor_payments
  ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- 4. Vendor master extra fields
ALTER TABLE public.vendors
  ADD COLUMN mobile text,
  ADD COLUMN notes text,
  ADD COLUMN opening_advance numeric NOT NULL DEFAULT 0;

-- 5. Customer master extra fields
ALTER TABLE public.customers
  ADD COLUMN mobile text,
  ADD COLUMN notes text;

-- 6. Tractor master extra fields
ALTER TABLE public.tractors
  ADD COLUMN driver_mobile text,
  ADD COLUMN notes text;

-- 7. Worker master extra fields
ALTER TABLE public.workers
  ADD COLUMN mobile text,
  ADD COLUMN opening_advance numeric NOT NULL DEFAULT 0,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- 8. Vendor advances table (separate from purchase-linked payments)
CREATE TABLE public.vendor_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  advance_date date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  remarks text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_advances TO authenticated;
GRANT ALL ON public.vendor_advances TO service_role;
ALTER TABLE public.vendor_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners and accountants manage advances" ON public.vendor_advances
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'accountant'));
CREATE TRIGGER vendor_advances_updated_at BEFORE UPDATE ON public.vendor_advances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
