
-- =========================================================
-- 1. Update handle_new_user + backfill admin
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'smpanchal9665@gmail.com' THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'owner';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'smpanchal9665@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- =========================================================
-- 2. is_admin helper
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::public.app_role)
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- =========================================================
-- 3. Set defaults on created_by / owner_id
-- =========================================================
ALTER TABLE public.vendors ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.customers ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.workers ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.tractors ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.purchases ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.sales ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.vendor_payments ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.vendor_advances ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.customer_receipts ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.worker_advances ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.worker_salaries ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.expenses ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.bank_accounts ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.company_settings ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- =========================================================
-- 4. Rewrite policies: owner-scoped + admin bypass
-- =========================================================

-- Helper to reduce noise
-- We drop all existing policies per table then re-create clean ones.

DO $$
DECLARE
  r record;
  tables text[] := ARRAY[
    'vendors','customers','workers','tractors',
    'purchases','sales',
    'vendor_payments','vendor_advances','customer_receipts',
    'worker_advances','worker_salaries','expenses'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- vendors, customers, workers, tractors — owner-scoped
CREATE POLICY "own or admin" ON public.vendors FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own or admin" ON public.customers FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own or admin" ON public.workers FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own or admin" ON public.tractors FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own or admin" ON public.purchases FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own or admin" ON public.sales FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own or admin" ON public.vendor_payments FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own or admin" ON public.vendor_advances FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own or admin" ON public.customer_receipts FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own or admin" ON public.worker_advances FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own or admin" ON public.worker_salaries FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "own or admin" ON public.expenses FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- bank_accounts (owner_id)
DROP POLICY IF EXISTS "owner manages own banks" ON public.bank_accounts;
CREATE POLICY "own or admin" ON public.bank_accounts FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_admin(auth.uid()));

-- company_settings
DROP POLICY IF EXISTS "Owners can insert their company" ON public.company_settings;
DROP POLICY IF EXISTS "Owners can update their company" ON public.company_settings;
DROP POLICY IF EXISTS "Owners can view company settings" ON public.company_settings;
CREATE POLICY "own or admin" ON public.company_settings FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_admin(auth.uid()));

-- profiles: user sees own; admin sees all
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "read own or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "update own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "insert own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- user_roles: user sees own; admin sees all; only admin manages
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can delete roles" ON public.user_roles;
CREATE POLICY "read own or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "admin manages" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- 5. Archive tables
-- =========================================================
CREATE TABLE IF NOT EXISTS public.archived_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  period_label TEXT NOT NULL,            -- e.g. '2026-08' or 'FY2026-27'
  archive_type TEXT NOT NULL,            -- 'month' | 'year'
  table_name TEXT NOT NULL,
  row_id UUID,
  payload JSONB NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_data TO authenticated;
GRANT ALL ON public.archived_data TO service_role;
ALTER TABLE public.archived_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin" ON public.archived_data FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS archived_data_owner_period_idx ON public.archived_data (owner_id, period_label);

CREATE TABLE IF NOT EXISTS public.monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  period_label TEXT NOT NULL,            -- '2026-08'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  cash_closing NUMERIC NOT NULL DEFAULT 0,
  bank_closing JSONB NOT NULL DEFAULT '[]'::jsonb,
  vendor_outstanding NUMERIC NOT NULL DEFAULT 0,
  vendor_advance NUMERIC NOT NULL DEFAULT 0,
  customer_outstanding NUMERIC NOT NULL DEFAULT 0,
  worker_advance NUMERIC NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, period_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_closings TO authenticated;
GRANT ALL ON public.monthly_closings TO service_role;
ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin" ON public.monthly_closings FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.yearly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  fy_label TEXT NOT NULL,                -- 'FY2026-27'
  fy_start DATE NOT NULL,
  fy_end DATE NOT NULL,
  cash_closing NUMERIC NOT NULL DEFAULT 0,
  bank_closing JSONB NOT NULL DEFAULT '[]'::jsonb,
  vendor_outstanding NUMERIC NOT NULL DEFAULT 0,
  vendor_advance NUMERIC NOT NULL DEFAULT 0,
  customer_outstanding NUMERIC NOT NULL DEFAULT 0,
  worker_advance NUMERIC NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, fy_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.yearly_closings TO authenticated;
GRANT ALL ON public.yearly_closings TO service_role;
ALTER TABLE public.yearly_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin" ON public.yearly_closings FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.monthly_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  period_label TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_exports TO authenticated;
GRANT ALL ON public.monthly_exports TO service_role;
ALTER TABLE public.monthly_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin" ON public.monthly_exports FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_admin(auth.uid()));
