
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS advance_deducted numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_payable numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tractor_rate_per_man numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tractor_payable numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tractor_paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tractor_paid_mode public.payment_mode,
  ADD COLUMN IF NOT EXISTS tractor_bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- Fix cross-tenant data access on master tables
DROP POLICY IF EXISTS "Authenticated can read customers" ON public.customers;
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "Authenticated can read vendors" ON public.vendors;
DROP POLICY IF EXISTS "vendors_select" ON public.vendors;
DROP POLICY IF EXISTS "Authenticated can read workers" ON public.workers;
DROP POLICY IF EXISTS "workers_select" ON public.workers;
DROP POLICY IF EXISTS "Authenticated can read tractors" ON public.tractors;
DROP POLICY IF EXISTS "tractors_select" ON public.tractors;

CREATE POLICY "Users read own customers" ON public.customers FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Users read own vendors" ON public.vendors FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Users read own workers" ON public.workers FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Users read own tractors" ON public.tractors FOR SELECT TO authenticated USING (created_by = auth.uid());
