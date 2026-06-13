import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/workers/salary")({
  component: WorkerSalaryWizard,
});

type Worker = { id: string; name: string; daily_wage: number };
type Bank = { id: string; name: string };
type Advance = { id: string; amount: number; advance_date: string };

function WorkerSalaryWizard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [periodLabel, setPeriodLabel] = useState(() => {
    const d = new Date();
    return d.toLocaleString("en", { month: "long", year: "numeric" });
  });
  const [presentDays, setPresentDays] = useState("");
  const [wage, setWage] = useState("");
  const [pendingAdvance, setPendingAdvance] = useState(0);
  const [advanceAction, setAdvanceAction] = useState<"deduct" | "pending">("deduct");
  const [advanceToDeduct, setAdvanceToDeduct] = useState("");
  const [payChoice, setPayChoice] = useState<"now" | "later">("now");
  const [paidAmount, setPaidAmount] = useState("");
  const [mode, setMode] = useState<string>("cash");
  const [bankId, setBankId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [w, b] = await Promise.all([
        supabase.from("workers").select("id,name,daily_wage").eq("is_active", true).order("name"),
        supabase.from("bank_accounts").select("id,name").eq("is_active", true).order("name"),
      ]);
      setWorkers((w.data ?? []) as Worker[]);
      setBanks((b.data ?? []) as Bank[]);
    })();
  }, []);

  const worker = workers.find((w) => w.id === workerId);

  // Load outstanding advance for worker (advances not yet deducted via prior salaries)
  useEffect(() => {
    if (!workerId) return;
    (async () => {
      const [advRes, salRes, wRes] = await Promise.all([
        supabase.from("worker_advances").select("amount").eq("worker_id", workerId),
        supabase.from("worker_salaries").select("advance_deducted").eq("worker_id", workerId),
        supabase.from("workers").select("opening_advance").eq("id", workerId).maybeSingle(),
      ]);
      const opening = Number(wRes.data?.opening_advance ?? 0);
      const given = (advRes.data ?? []).reduce((s, a: any) => s + Number(a.amount ?? 0), 0);
      const adjusted = (salRes.data ?? []).reduce((s, a: any) => s + Number(a.advance_deducted ?? 0), 0);
      const remaining = Math.max(0, opening + given - adjusted);
      setPendingAdvance(remaining);
      setAdvanceToDeduct(remaining.toFixed(2));
      setWage(String(worker?.daily_wage ?? ""));
    })();
  }, [workerId, worker?.daily_wage]);

  const gross = useMemo(() => Number(presentDays || 0) * Number(wage || 0), [presentDays, wage]);
  const advDeduct = useMemo(() => advanceAction === "deduct" ? Math.min(Number(advanceToDeduct || 0), pendingAdvance, gross) : 0, [advanceAction, advanceToDeduct, pendingAdvance, gross]);
  const netPayable = useMemo(() => Math.max(0, gross - advDeduct), [gross, advDeduct]);
  const paid = payChoice === "now" ? Number(paidAmount || 0) : 0;
  const outstanding = Math.max(0, netPayable - paid);

  const save = async () => {
    if (!workerId) return toast.error("Select worker");
    if (Number(presentDays) <= 0) return toast.error("Enter present days");
    setSaving(true);
    const { error } = await supabase.from("worker_salaries").insert({
      worker_id: workerId,
      period_label: periodLabel,
      present_days: Number(presentDays),
      daily_wage: Number(wage),
      gross_salary: gross,
      advance_deducted: advDeduct,
      net_payable: netPayable,
      paid_amount: paid,
      payment_mode: payChoice === "now" ? mode : null,
      bank_account_id: payChoice === "now" && mode === "bank" ? bankId || null : null,
      outstanding,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salary saved");
    navigate({ to: "/workers" });
  };

  return (
    <AppShell title="Salary" backTo="/workers">
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">Step {step} of 5</div>

        {step === 1 && (
          <div className="space-y-3">
            <Label className="text-base">Select Worker</Label>
            {workers.length === 0 && <div className="text-muted-foreground">No active workers.</div>}
            {workers.map((w) => (
              <button key={w.id} type="button"
                onClick={() => { setWorkerId(w.id); setStep(2); }}
                className={`block w-full rounded-lg border-2 p-4 text-left ${workerId === w.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <div className="text-lg font-semibold">{w.name}</div>
                <div className="text-sm text-muted-foreground">Daily Wage: ₹{Number(w.daily_wage).toFixed(2)}</div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Label>Period</Label>
            <Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} className="h-12" />
            <Label>Present Days</Label>
            <Input type="number" inputMode="decimal" value={presentDays} onChange={(e) => setPresentDays(e.target.value)} className="h-14 text-xl" autoFocus />
            <Label>Daily Wage</Label>
            <Input type="number" inputMode="decimal" value={wage} onChange={(e) => setWage(e.target.value)} className="h-12" />
            <div className="rounded-lg bg-muted p-3 text-base">
              {presentDays || 0} × ₹{Number(wage || 0).toFixed(2)} = <strong>₹{gross.toFixed(2)}</strong>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1 h-12" disabled={!presentDays || !wage} onClick={() => setStep(3)}>Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label className="text-base">Advance Adjustment</Label>
            <div className="rounded-lg bg-muted p-3 text-sm">
              Pending Advance: <strong>₹{pendingAdvance.toFixed(2)}</strong>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAdvanceAction("deduct")}
                className={`rounded-lg border-2 p-4 ${advanceAction === "deduct" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <div className="font-semibold">Deduct Now</div>
              </button>
              <button type="button" onClick={() => setAdvanceAction("pending")}
                className={`rounded-lg border-2 p-4 ${advanceAction === "pending" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <div className="font-semibold">Keep Pending</div>
              </button>
            </div>
            {advanceAction === "deduct" && (
              <>
                <Label>Amount to Deduct</Label>
                <Input type="number" inputMode="decimal" value={advanceToDeduct} onChange={(e) => setAdvanceToDeduct(e.target.value)} className="h-12" />
              </>
            )}
            <div className="rounded-lg bg-muted p-3 text-sm">
              Gross: ₹{gross.toFixed(2)} − Advance: ₹{advDeduct.toFixed(2)} = <strong>Net ₹{netPayable.toFixed(2)}</strong>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1 h-12" onClick={() => setStep(4)}>Next</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <Label className="text-base">Payment</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setPayChoice("now"); setPaidAmount(netPayable.toFixed(2)); }}
                className={`rounded-lg border-2 p-4 ${payChoice === "now" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <div className="font-semibold">Pay Now</div>
              </button>
              <button type="button" onClick={() => { setPayChoice("later"); setPaidAmount("0"); }}
                className={`rounded-lg border-2 p-4 ${payChoice === "later" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <div className="font-semibold">Pay Later</div>
              </button>
            </div>
            {payChoice === "now" && (
              <>
                <Label>Amount Paid</Label>
                <Input type="number" inputMode="decimal" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="h-12" />
                <Label>Payment Mode</Label>
                <div className="grid grid-cols-1 gap-2">
                  <button type="button" onClick={() => { setMode("cash"); setBankId(""); }}
                    className={`rounded-lg border-2 p-3 text-left ${mode === "cash" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>Cash</button>
                  {banks.map((b) => (
                    <button key={b.id} type="button" onClick={() => { setMode("bank"); setBankId(b.id); }}
                      className={`rounded-lg border-2 p-3 text-left ${mode === "bank" && bankId === b.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>{b.name}</button>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(3)}>Back</Button>
              <Button className="flex-1 h-12" onClick={() => setStep(5)}>Next</Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4 space-y-1">
              <div className="text-lg font-semibold">{worker?.name}</div>
              <div className="text-sm">{periodLabel}</div>
              <div className="text-sm">Present: {presentDays} × ₹{Number(wage).toFixed(2)} = ₹{gross.toFixed(2)}</div>
              <div className="text-sm">Advance Deducted: ₹{advDeduct.toFixed(2)}</div>
              <div className="text-base font-semibold">Net Payable: ₹{netPayable.toFixed(2)}</div>
              <div className="text-sm">Paid: ₹{paid.toFixed(2)} {payChoice === "now" ? `(${mode === "cash" ? "Cash" : banks.find((b) => b.id === bankId)?.name ?? "Bank"})` : ""}</div>
              {outstanding > 0 && <div className="text-sm text-rose-600 font-medium">Outstanding: ₹{outstanding.toFixed(2)}</div>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(4)}>Back</Button>
              <Button className="flex-1 h-12" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
