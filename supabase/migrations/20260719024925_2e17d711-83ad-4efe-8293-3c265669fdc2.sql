
DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM ('present','half','absent','weekly_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.worker_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status public.attendance_status NOT NULL,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, attendance_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_attendance TO authenticated;
GRANT ALL ON public.worker_attendance TO service_role;

ALTER TABLE public.worker_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own or admin" ON public.worker_attendance
  FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_worker_attendance_updated
  BEFORE UPDATE ON public.worker_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_worker_attendance_worker_date
  ON public.worker_attendance (worker_id, attendance_date);

ALTER TABLE public.worker_salaries
  ADD COLUMN IF NOT EXISTS extra_work numeric NOT NULL DEFAULT 0;
