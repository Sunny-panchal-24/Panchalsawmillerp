CREATE TABLE public.manual_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adjust_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_adjustments TO authenticated;
GRANT ALL ON public.manual_adjustments TO service_role;

ALTER TABLE public.manual_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin manages manual adjustments"
ON public.manual_adjustments FOR ALL TO authenticated
USING (auth.uid() = created_by OR public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = created_by OR public.is_admin(auth.uid()));

CREATE TRIGGER manual_adjustments_updated_at
BEFORE UPDATE ON public.manual_adjustments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();