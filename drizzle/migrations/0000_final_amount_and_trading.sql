ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS calculated_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS material_calculated numeric NOT NULL DEFAULT 0;

CREATE TABLE public.trading_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  kind text NOT NULL CHECK (kind IN ('buy','sell')),
  party text NOT NULL,
  qty numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  calculated_amount numeric NOT NULL DEFAULT 0,
  final_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_entries TO authenticated;
GRANT ALL ON public.trading_entries TO service_role;
ALTER TABLE public.trading_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages trading" ON public.trading_entries FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER trading_entries_updated BEFORE UPDATE ON public.trading_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();