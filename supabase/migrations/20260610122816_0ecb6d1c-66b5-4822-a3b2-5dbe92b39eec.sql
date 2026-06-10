
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  owner_name text NOT NULL,
  mobile text,
  village text,
  opening_cash numeric NOT NULL DEFAULT 0,
  opening_dad_saving numeric NOT NULL DEFAULT 0,
  opening_dad_current numeric NOT NULL DEFAULT 0,
  opening_sunny_saving numeric NOT NULL DEFAULT 0,
  setup_completed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view company settings"
ON public.company_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Owners can insert their company"
ON public.company_settings FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update their company"
ON public.company_settings FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner'))
WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER trg_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
