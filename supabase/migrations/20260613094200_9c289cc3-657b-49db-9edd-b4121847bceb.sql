
-- Worker advances
CREATE TABLE public.worker_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  advance_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_mode text NOT NULL DEFAULT 'cash',
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_advances TO authenticated;
GRANT ALL ON public.worker_advances TO service_role;
ALTER TABLE public.worker_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own worker_advances" ON public.worker_advances FOR ALL
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE TRIGGER trg_worker_advances_updated BEFORE UPDATE ON public.worker_advances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Worker salaries
CREATE TABLE public.worker_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  period_label text NOT NULL,
  period_start date,
  period_end date,
  present_days numeric NOT NULL DEFAULT 0,
  daily_wage numeric NOT NULL DEFAULT 0,
  gross_salary numeric NOT NULL DEFAULT 0,
  advance_deducted numeric NOT NULL DEFAULT 0,
  net_payable numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  payment_mode text,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  outstanding numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_salaries TO authenticated;
GRANT ALL ON public.worker_salaries TO service_role;
ALTER TABLE public.worker_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own worker_salaries" ON public.worker_salaries FOR ALL
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE TRIGGER trg_worker_salaries_updated BEFORE UPDATE ON public.worker_salaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
