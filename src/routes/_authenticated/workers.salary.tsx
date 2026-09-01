import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsAdmin } from "@/hooks/use-admin";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/workers/salary")({
  component: WorkerSalaryWizard,
});

type Worker = { id: string; name: string; daily_wage: number; salary_type: string };
type Bank = { id: string; name: string };

// Wednesday-first payment window: Wed(3), Thu(4), Fri(5), Sat(6), Sun(0), Mon(1), Tue(2)
function isPaymentDayAllowed(today: Date, lastPaidOn: Date | null): boolean {
  // If never paid, allow.
  if (!lastPaidOn) return true;
  // Find the most recent Wednesday on/before today
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const dow = t.getDay(); // Sun=0..Sat=6
  const daysSinceWed = (dow + 4) % 7; // Wed=3 → 0
  const cycleStart = new Date(t);
  cycleStart.setDate(t.getDate() - daysSinceWed);
  // Allow if last payment was strictly before this cycle's Wednesday
  const lp = new Date(lastPaidOn);
  lp.setHours(0, 0, 0, 0);
  return lp < cycleStart;
}

function WorkerSalaryWizard() {
  const { t: _t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [workerId, setWorkerId] = useState("");
  const today = new Date();
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    const dow = d.getDay();
    const daysSinceWed = (dow + 4) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - daysSinceWed - 7);
    return start.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodLabel, setPeriodLabel] = useState(() => today.toLocaleString("en", { month: "long", year: "numeric" }));

  const [presentDays, setPresentDays] = useState("0");
  const [halfDays, setHalfDays] = useState("0");
  const [absentDays, setAbsentDays] = useState("0");
  const [woDays, setWoDays] = useState("0");
  const [wage, setWage] = useState("");
  const [extraWork, setExtraWork] = useState("0");

  const [pendingAdvance, setPendingAdvance] = useState(0);
  const [periodAdvance, setPeriodAdvance] = useState(0);
  const [advanceAction, setAdvanceAction] = useState<"deduct" | "pending">("deduct");
  const [advanceToDeduct, setAdvanceToDeduct] = useState("");


  const [payChoice, setPayChoice] = useState<"now" | "later">("now");
  const [paidAmount, setPaidAmount] = useState("");
  const [mode, setMode] = useState<string>("cash");
  const [bankId, setBankId] = useState<string>("");
  const [overrideDay, setOverrideDay] = useState(false);
  const { isAdmin } = useIsAdmin();
  const [lastPaidOn, setLastPaidOn] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [w, b] = await Promise.all([
        supabase.from("workers").select("id,name,daily_wage,salary_type").eq("is_active", true).order("name"),
        supabase.from("bank_accounts").select("id,name").eq("is_active", true).order("name"),
      ]);
      setWorkers((w.data ?? []) as Worker[]);
      setBanks((b.data ?? []) as Bank[]);
    })();
  }, []);

  const worker = workers.find((w) => w.id === workerId);

  // Load attendance-based counts + advance balance + last paid
  useEffect(() => {
    if (!workerId) return;
    (async () => {
      const [advRes, salRes, wRes, attRes, lastRes] = await Promise.all([
        supabase.from("worker_advances").select("amount,advance_date").eq("worker_id", workerId),
        supabase.from("worker_salaries").select("advance_deducted").eq("worker_id", workerId),
        supabase.from("workers").select("opening_advance,daily_wage").eq("id", workerId).maybeSingle(),
        supabase.from("worker_attendance").select("status").eq("worker_id", workerId)
          .gte("attendance_date", periodStart).lte("attendance_date", periodEnd),
        supabase.from("worker_salaries").select("created_at,period_end").eq("worker_id", workerId)
          .gt("paid_amount", 0).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const opening = Number(wRes.data?.opening_advance ?? 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const given = (advRes.data ?? []).reduce((s, a: any) => s + Number(a.amount ?? 0), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inPeriod = (advRes.data ?? []).filter((a: any) => a.advance_date >= periodStart && a.advance_date <= periodEnd)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((s: number, a: any) => s + Number(a.amount ?? 0), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adjusted = (salRes.data ?? []).reduce((s, a: any) => s + Number(a.advance_deducted ?? 0), 0);
      const remaining = Math.max(0, opening + given - adjusted);
      setPendingAdvance(remaining);
      setPeriodAdvance(inPeriod);
      setAdvanceToDeduct(Math.min(inPeriod || remaining, remaining).toFixed(2));

      setWage(String(wRes.data?.daily_wage ?? worker?.daily_wage ?? ""));

      let p = 0, h = 0, a = 0, wo = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (attRes.data ?? []).forEach((r: any) => {
        if (r.status === "present") p++;
        else if (r.status === "half") h++;
        else if (r.status === "absent") a++;
        else if (r.status === "weekly_off") wo++;
      });
      setPresentDays(String(p));
      setHalfDays(String(h));
      setAbsentDays(String(a));
      setWoDays(String(wo));

      if (lastRes.data) {
        const d = lastRes.data.period_end ?? lastRes.data.created_at?.slice(0, 10);
        setLastPaidOn(d ? new Date(d) : null);
      } else {
        setLastPaidOn(null);
      }
    })();
  }, [workerId, periodStart, periodEnd, worker?.daily_wage]);

  const effectiveDays = useMemo(() => Number(presentDays || 0) + 0.5 * Number(halfDays || 0), [presentDays, halfDays]);
  const gross = useMemo(() => effectiveDays * Number(wage || 0) + Number(extraWork || 0), [effectiveDays, wage, extraWork]);
  const advDeduct = useMemo(() => advanceAction === "deduct" ? Math.min(Number(advanceToDeduct || 0), pendingAdvance, gross) : 0, [advanceAction, advanceToDeduct, pendingAdvance, gross]);
  const netPayable = useMemo(() => Math.max(0, gross - advDeduct), [gross, advDeduct]);
  const paid = payChoice === "now" ? Number(paidAmount || 0) : 0;
  const outstanding = Math.max(0, netPayable - paid);
  const carryAdvance = Math.max(0, (advanceAction === "deduct" ? Math.min(Number(advanceToDeduct || 0), pendingAdvance) : 0) - advDeduct);
  const excessPaid = Math.max(0, paid - netPayable);

  const dayAllowed = useMemo(() => isPaymentDayAllowed(new Date(), lastPaidOn), [lastPaidOn]);
  const payBlocked = payChoice === "now" && !dayAllowed && !(overrideDay && isAdmin);

  const save = async () => {
    if (!workerId) return toast.error("Select worker");
    if (payBlocked) return toast.error("Payment blocked — tick override to force");
    setSaving(true);
    const { error } = await supabase.from("worker_salaries").insert({
      worker_id: workerId,
      period_label: periodLabel,
      period_start: periodStart,
      period_end: periodEnd,
      present_days: effectiveDays,
      daily_wage: Number(wage),
      gross_salary: gross,
      extra_work: Number(extraWork || 0),
      advance_deducted: advDeduct,
      net_payable: netPayable,
      paid_amount: Math.min(paid, netPayable),
      payment_mode: payChoice === "now" ? mode : null,
      bank_account_id: payChoice === "now" && mode === "bank" ? bankId || null : null,
      outstanding,
    });
    if (!error && excessPaid > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Amount paid beyond payable salary is recorded as a fresh advance.
        await supabase.from("worker_advances").insert({
          worker_id: workerId,
          advance_date: periodEnd,
          amount: excessPaid,
          payment_mode: mode,
          bank_account_id: mode === "bank" ? bankId || null : null,
          notes: `Excess salary payment (${periodLabel})`,
          created_by: user.id,
        });
      }
    }
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
                <div className="text-sm text-muted-foreground">₹{Number(w.daily_wage).toFixed(2)}/day · {w.salary_type}</div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Label>Period Label</Label>
            <Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} className="h-12" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>From</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-12" />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-12" />
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div>Present (from attendance): <strong>{presentDays}</strong></div>
              <div>Half Days: <strong>{halfDays}</strong> (= {(Number(halfDays) * 0.5).toFixed(1)} days)</div>
              <div>Absent: <strong>{absentDays}</strong> · Weekly Off: <strong>{woDays}</strong></div>
              <div>Effective Days: <strong>{effectiveDays}</strong></div>
            </div>
            <Label>Daily Wage</Label>
            <Input type="number" inputMode="decimal" value={wage} onChange={(e) => setWage(e.target.value)} className="h-12" />
            <Label>Extra Work (₹)</Label>
            <Input type="number" inputMode="decimal" value={extraWork} onChange={(e) => setExtraWork(e.target.value)} className="h-12" />
            <div className="rounded-lg bg-muted p-3 text-base">
              {effectiveDays} × ₹{Number(wage || 0).toFixed(2)} + ₹{Number(extraWork || 0).toFixed(2)} = <strong>₹{gross.toFixed(2)}</strong>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1 h-12" disabled={!wage} onClick={() => setStep(3)}>Next</Button>
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
            {payChoice === "now" && !dayAllowed && (
              <div className="rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                <div className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  ⚠ Salary already paid this cycle (last: {lastPaidOn?.toISOString().slice(0, 10)}). Next cycle starts on Wednesday.
                </div>
                {isAdmin ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={overrideDay} onCheckedChange={(v) => setOverrideDay(!!v)} />
                    Override day rule (admin)
                  </label>
                ) : (
                  <div className="text-xs text-muted-foreground">Override available to admin only.</div>
                )}
              </div>
            )}
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
              <div className="text-sm">{periodLabel} ({periodStart} → {periodEnd})</div>
              <div className="text-sm">Effective: {effectiveDays} × ₹{Number(wage).toFixed(2)} = ₹{(effectiveDays * Number(wage || 0)).toFixed(2)}</div>
              {Number(extraWork) > 0 && <div className="text-sm">Extra Work: ₹{Number(extraWork).toFixed(2)}</div>}
              <div className="text-sm">Advance Deducted: ₹{advDeduct.toFixed(2)}</div>
              <div className="text-base font-semibold">Net Payable: ₹{netPayable.toFixed(2)}</div>
              <div className="text-sm">Paid: ₹{paid.toFixed(2)} {payChoice === "now" ? `(${mode === "cash" ? "Cash" : banks.find((b) => b.id === bankId)?.name ?? "Bank"})` : ""}</div>
              {outstanding > 0 && <div className="text-sm text-rose-600 font-medium">Outstanding: ₹{outstanding.toFixed(2)}</div>}
              {payBlocked && <div className="text-sm text-rose-600 font-medium">⚠ Payment blocked by day rule</div>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(4)}>Back</Button>
              <Button className="flex-1 h-12" disabled={saving || payBlocked} onClick={save}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
