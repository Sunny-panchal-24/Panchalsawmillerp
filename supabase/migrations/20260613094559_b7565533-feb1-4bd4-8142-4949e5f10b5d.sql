CREATE TYPE public.expense_type AS ENUM ('maintenance', 'other');

CREATE TABLE public.expenses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expense_type public.expense_type NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_mode TEXT NOT NULL DEFAULT 'cash',
    bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own expenses"
ON public.expenses
FOR ALL
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_expenses_updated_at();