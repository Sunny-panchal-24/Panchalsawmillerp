import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wallet, Calculator, Eye, Trash2, CalendarCheck, BookOpen, Pencil } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { EditRecordDialog } from "@/components/EditRecordDialog";

export const Route = createFileRoute("/_authenticated/workers/")({
  component: WorkersIndex,
});

type AdvRow = {
  id: string;
  advance_date: string;
  amount: number;
  payment_mode: string;
  workers: { name: string } | null;
};
type SalRow = {
  id: string;
  worker_id: string;
  period_label: string;
  present_days: number;
  daily_wage: number;
  gross_salary: number;
  advance_deducted: number;
  net_payable: number;
  paid_amount: number;
  outstanding: number;
  workers: { name: string } | null;
};

function WorkersIndex() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [chooser, setChooser] = useState(true);
  const [tab, setTab] = useState<"advances" | "salaries">("salaries");
  const [advances, setAdvances] = useState<AdvRow[]>([]);
  const [salaries, setSalaries] = useState<SalRow[]>([]);
  const [editAdv, setEditAdv] = useState<AdvRow | null>(null);
  const [editSal, setEditSal] = useState<SalRow | null>(null);

  const load = async () => {
    const [a, s] = await Promise.all([
      supabase.from("worker_advances").select("id,advance_date,amount,payment_mode,notes,workers(name)").order("advance_date", { ascending: false }).limit(100),
      supabase.from("worker_salaries").select("id,worker_id,period_label,present_days,daily_wage,gross_salary,advance_deducted,net_payable,paid_amount,outstanding,workers(name)").order("created_at", { ascending: false }).limit(100),
    ]);
    setAdvances((a.data ?? []) as unknown as AdvRow[]);
    setSalaries((s.data ?? []) as unknown as SalRow[]);
  };
  useEffect(() => { load(); }, []);

  const delAdv = async (id: string) => {
    if (!confirm(t("confirm_delete") || "Delete?")) return;
    const { error } = await supabase.from("worker_advances").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted") || "Deleted"); load();
  };
  const delSal = async (id: string) => {
    if (!confirm(t("confirm_delete") || "Delete?")) return;
    const { error } = await supabase.from("worker_salaries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted") || "Deleted"); load();
  };

  return (
    <AppShell title={t("workers")}>
      <div className="mb-3 flex gap-2">
        <Button variant={tab === "salaries" ? "default" : "outline"} className="flex-1 h-12" onClick={() => setTab("salaries")}>Salaries</Button>
        <Button variant={tab === "advances" ? "default" : "outline"} className="flex-1 h-12" onClick={() => setTab("advances")}>Advances</Button>
      </div>

      {tab === "salaries" ? (
        <div className="space-y-2">
          {salaries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">{t("no_records") || "No records"}</div>
          ) : salaries.map((r) => (
            <SalaryRow key={r.id} r={r} onEdit={() => setEditSal(r)} onDelete={() => delSal(r.id)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {advances.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">{t("no_records") || "No records"}</div>
          ) : advances.map((r) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => setEditAdv(r)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditAdv(r); }}
              className="rounded-lg border bg-card p-3 cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">{r.advance_date} · {r.payment_mode}</div>
                  <div className="text-base font-semibold">{r.workers?.name ?? "—"}</div>
                  <div className="text-sm">Amount: <strong>₹{Number(r.amount).toFixed(2)}</strong></div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="outline" onClick={(e) => { e.stopPropagation(); setEditAdv(r); }} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={(e) => { e.stopPropagation(); delAdv(r.id); }} aria-label={t("delete")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={chooser} onOpenChange={(o) => { if (!o) setChooser(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">{t("what_do_you_want") || "What do you want to do?"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setChooser(false); navigate({ to: "/workers/attendance" }); }}
              className="flex items-center gap-3 rounded-xl border-2 border-sky-600 bg-sky-50 dark:bg-sky-950/30 p-5 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-600 text-white">
                <CalendarCheck className="h-7 w-7" />
              </div>
              <div className="text-lg font-bold">Mark Attendance</div>
            </button>
            <button
              type="button"
              onClick={() => { setChooser(false); navigate({ to: "/workers/salary" }); }}
              className="flex items-center gap-3 rounded-xl border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-5 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Calculator className="h-7 w-7" />
              </div>
              <div className="text-lg font-bold">Pay Salary</div>
            </button>
            <button
              type="button"
              onClick={() => { setChooser(false); navigate({ to: "/workers/advance" }); }}
              className="flex items-center gap-3 rounded-xl border-2 border-rose-600 bg-rose-50 dark:bg-rose-950/30 p-5 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-rose-600 text-white">
                <Wallet className="h-7 w-7" />
              </div>
              <div className="text-lg font-bold">Give Advance</div>
            </button>
            <button
              type="button"
              onClick={() => setChooser(false)}
              className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-5 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <Eye className="h-7 w-7" />
              </div>
              <div className="text-lg font-bold">View Records</div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SalaryRow({ r, onDelete }: { r: SalRow; onDelete: () => void }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{r.period_label}</div>
          <div className="text-base font-semibold">{r.workers?.name ?? "—"}</div>
          <div className="text-sm">
            {r.present_days} × ₹{Number(r.daily_wage).toFixed(2)} = <strong>₹{Number(r.gross_salary).toFixed(2)}</strong>
          </div>
          <div className="text-sm text-muted-foreground">
            Adv: ₹{Number(r.advance_deducted).toFixed(2)} · Net: ₹{Number(r.net_payable).toFixed(2)} · Paid: ₹{Number(r.paid_amount).toFixed(2)}
          </div>
          {Number(r.outstanding) > 0 && (
            <div className="text-sm text-rose-600 font-medium">Outstanding: ₹{Number(r.outstanding).toFixed(2)}</div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Link to="/workers/$workerId/ledger" params={{ workerId: r.worker_id }}>
            <Button size="icon" variant="outline" aria-label="Ledger"><BookOpen className="h-4 w-4" /></Button>
          </Link>
          <Button size="icon" variant="destructive" onClick={onDelete} aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
