import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/workers/advance")({
  component: WorkerAdvanceWizard,
});

type Worker = { id: string; name: string; daily_wage: number };
type Bank = { id: string; name: string };

function WorkerAdvanceWizard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [workerId, setWorkerId] = useState<string>("");
  const [amount, setAmount] = useState("");
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

  const save = async () => {
    if (!workerId || !amount || Number(amount) <= 0) return toast.error("Fill all fields");
    setSaving(true);
    const { error } = await supabase.from("worker_advances").insert({
      worker_id: workerId,
      amount: Number(amount),
      payment_mode: mode,
      bank_account_id: mode === "cash" ? null : bankId || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Advance saved");
    navigate({ to: "/workers" });
  };

  return (
    <AppShell title="Worker Advance" backTo="/workers">
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">Step {step} of 3</div>

        {step === 1 && (
          <div className="space-y-3">
            <Label className="text-base">Select Worker</Label>
            <div className="grid grid-cols-1 gap-2">
              {workers.length === 0 && <div className="text-muted-foreground">No active workers. Add from Masters.</div>}
              {workers.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => { setWorkerId(w.id); setStep(2); }}
                  className={`rounded-lg border-2 p-4 text-left active:scale-[0.98] ${workerId === w.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                >
                  <div className="text-lg font-semibold">{w.name}</div>
                  <div className="text-sm text-muted-foreground">Daily Wage: ₹{Number(w.daily_wage).toFixed(2)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Label className="text-base">Advance Amount</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-14 text-xl" placeholder="0.00" autoFocus />
            <div className="text-sm text-muted-foreground">Worker: <strong>{worker?.name}</strong></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1 h-12" disabled={!amount || Number(amount) <= 0} onClick={() => setStep(3)}>Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label className="text-base">Payment Mode</Label>
            <div className="grid grid-cols-1 gap-2">
              <button type="button" onClick={() => { setMode("cash"); setBankId(""); }}
                className={`rounded-lg border-2 p-4 text-left ${mode === "cash" ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <div className="text-lg font-semibold">Cash</div>
              </button>
              {banks.map((b) => (
                <button key={b.id} type="button" onClick={() => { setMode("bank"); setBankId(b.id); }}
                  className={`rounded-lg border-2 p-4 text-left ${mode === "bank" && bankId === b.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                  <div className="text-lg font-semibold">{b.name}</div>
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-sm">Worker: <strong>{worker?.name}</strong></div>
              <div className="text-sm">Amount: <strong>₹{Number(amount || 0).toFixed(2)}</strong></div>
              <div className="text-sm">Mode: <strong>{mode === "cash" ? "Cash" : banks.find((b) => b.id === bankId)?.name ?? "—"}</strong></div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1 h-12" disabled={saving || (mode === "bank" && !bankId)} onClick={save}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
