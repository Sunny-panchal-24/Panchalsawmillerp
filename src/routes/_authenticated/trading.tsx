import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RowActions } from "@/components/RowActions";
import { money } from "@/lib/summary";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trading")({
  head: () => ({ meta: [{ title: "Trading Account — Panchal Sawmill" }] }),
  component: TradingPage,
});

type Entry = {
  id: string; entry_date: string; kind: "buy" | "sell"; party: string; qty: number; rate: number;
  calculated_amount: number; final_amount: number; paid_amount: number; bank_account_id: string | null; remarks: string | null;
};
type Bank = { id: string; name: string };
const CASH = "__cash";
const n = (v: unknown) => Number(v ?? 0) || 0;

function TradingPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Entry[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const blank = { kind: "buy" as "buy" | "sell", date: today, party: "", qty: "", rate: "", final: "", paid: "", mode: CASH, remarks: "" };
  const [f, setF] = useState(blank);

  const load = async () => {
    const [{ data }, { data: b }] = await Promise.all([
      supabase.from("trading_entries").select("*").order("entry_date", { ascending: false }),
      supabase.from("bank_accounts").select("id,name").eq("is_active", true).order("name"),
    ]);
    setRows((data ?? []) as Entry[]);
    setBanks((b ?? []) as Bank[]);
  };
  useEffect(() => { load(); }, []);

  const calc = n(f.qty) * n(f.rate);
  const finalAmt = f.final.trim() !== "" ? n(f.final) : calc;
  const eff = n(f.qty) > 0 ? finalAmt / n(f.qty) : 0;

  const sum = useMemo(() => {
    const buys = rows.filter((r) => r.kind === "buy");
    const sells = rows.filter((r) => r.kind === "sell");
    const bq = buys.reduce((s, r) => s + n(r.qty), 0);
    const bv = buys.reduce((s, r) => s + n(r.final_amount), 0);
    const sq = sells.reduce((s, r) => s + n(r.qty), 0);
    const sv = sells.reduce((s, r) => s + n(r.final_amount), 0);
    const avgBuy = bq > 0 ? bv / bq : 0;
    const avgSell = sq > 0 ? sv / sq : 0;
    // Profit on what was sold, valued at average buy rate
    return { bq, bv, sq, sv, avgBuy, avgSell, stock: bq - sq, profit: sv - sq * avgBuy };
  }, [rows]);

  const startNew = () => { setF(blank); setEditId(null); setStep(0); setOpen(true); };
  const startEdit = (r: Entry) => {
    setF({
      kind: r.kind, date: r.entry_date, party: r.party, qty: String(r.qty), rate: String(r.rate),
      final: Math.abs(n(r.calculated_amount) - n(r.final_amount)) > 0.001 ? String(r.final_amount) : "",
      paid: String(r.paid_amount), mode: r.bank_account_id ?? CASH, remarks: r.remarks ?? "",
    });
    setEditId(r.id); setStep(0); setOpen(true);
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("trading_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted")); load();
  };

  const save = async () => {
    const payload = {
      kind: f.kind, entry_date: f.date, party: f.party.trim(), qty: n(f.qty), rate: n(f.rate),
      calculated_amount: calc, final_amount: finalAmt, paid_amount: Math.min(n(f.paid), finalAmt),
      bank_account_id: f.mode === CASH ? null : f.mode, remarks: f.remarks.trim() || null,
    };
    const { error } = editId
      ? await supabase.from("trading_entries").update(payload).eq("id", editId)
      : await supabase.from("trading_entries").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); setOpen(false); load();
  };

  const steps: { valid: boolean; body: React.ReactNode }[] = [
    { valid: true, body: (
      <div className="grid gap-2">
        <Button className="h-14 text-lg" variant={f.kind === "buy" ? "default" : "outline"} onClick={() => { setF({ ...f, kind: "buy" }); setStep(1); }}>{t("trading_buy")}</Button>
        <Button className="h-14 text-lg" variant={f.kind === "sell" ? "default" : "outline"} onClick={() => { setF({ ...f, kind: "sell" }); setStep(1); }}>{t("trading_sell")}</Button>
      </div>) },
    { valid: !!f.date && f.party.trim().length > 0, body: (
      <div className="space-y-3">
        <div><Label>{t("date")}</Label><Input type="date" className="h-12 text-base" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div><Label>{t("party_name")}</Label><Input className="h-12 text-base" value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} /></div>
      </div>) },
    { valid: n(f.qty) > 0 && finalAmt > 0, body: (
      <div className="space-y-3">
        <div><Label>{t("quantity_cft")}</Label><Input type="number" inputMode="decimal" className="h-12 text-base" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></div>
        <div><Label>{t("rate_per_cft")}</Label><Input type="number" inputMode="decimal" className="h-12 text-base" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></div>
        <div className="rounded-lg bg-muted p-3">{t("calculated_amount")}: <strong>{money(calc)}</strong></div>
        <div><Label>{t("final_amount_settled")}</Label><Input type="number" inputMode="decimal" placeholder={calc.toFixed(2)} className="h-12 text-base" value={f.final} onChange={(e) => setF({ ...f, final: e.target.value })} /></div>
        <div className="rounded-lg bg-primary/10 p-3">
          <div>{t("total")}: <strong>{money(finalAmt)}</strong></div>
          <div>{t("effective_rate")}: <strong>₹{eff.toFixed(3)}</strong> / CFT</div>
        </div>
      </div>) },
    { valid: true, body: (
      <div className="space-y-3">
        <div className="rounded-lg bg-muted p-3">{t("total")}: <strong>{money(finalAmt)}</strong></div>
        <div><Label>{t("paid")}</Label><Input type="number" inputMode="decimal" placeholder="0" className="h-12 text-base" value={f.paid} onChange={(e) => setF({ ...f, paid: e.target.value })} /></div>
        <div className="flex flex-wrap gap-2">
          <Button variant={f.mode === CASH ? "default" : "outline"} onClick={() => setF({ ...f, mode: CASH })}>{t("cash")}</Button>
          {banks.map((b) => <Button key={b.id} variant={f.mode === b.id ? "default" : "outline"} onClick={() => setF({ ...f, mode: b.id })}>{b.name}</Button>)}
        </div>
        <div><Label>{t("remarks")}</Label><Input className="h-12 text-base" value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></div>
      </div>) },
  ];

  return (
    <AppShell title={t("trading_account")}>
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <Stat label={t("total_bought")} value={`${sum.bq} CFT · ${money(sum.bv)}`} />
        <Stat label={t("total_sold")} value={`${sum.sq} CFT · ${money(sum.sv)}`} />
        <Stat label={t("avg_buy_rate")} value={`₹${sum.avgBuy.toFixed(2)}`} />
        <Stat label={t("avg_sell_rate")} value={`₹${sum.avgSell.toFixed(2)}`} />
        <Stat label={t("stock_cft")} value={String(+sum.stock.toFixed(2))} />
        <Stat label={t("trading_profit")} value={money(sum.profit)} strong />
      </div>
      <Button className="mb-4 h-14 w-full text-lg" onClick={startNew}>+ {t("new")}</Button>
      <div className="space-y-2">
        {rows.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("no_records")}</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-xl border bg-card p-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{t(r.kind === "buy" ? "trading_buy" : "trading_sell")}</div>
              <div className="truncate text-sm">{r.party} · {n(r.qty)} CFT · ₹{(n(r.qty) > 0 ? n(r.final_amount) / n(r.qty) : 0).toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">{r.entry_date} · {t("paid")} {money(r.paid_amount)}{r.remarks ? ` · ${r.remarks}` : ""}</div>
            </div>
            <div className="shrink-0 font-bold">{money(r.final_amount)}</div>
            <RowActions title={r.party} onEdit={() => startEdit(r)} onDelete={() => remove(r.id)} />
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("trading_account")} · {step + 1}/{steps.length}</DialogTitle></DialogHeader>
          {steps[step].body}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="h-12 flex-1" onClick={() => (step === 0 ? setOpen(false) : setStep(step - 1))}>{t("back")}</Button>
            {step > 0 && (step < steps.length - 1
              ? <Button className="h-12 flex-1" disabled={!steps[step].valid} onClick={() => setStep(step + 1)}>{t("next")}</Button>
              : <Button className="h-12 flex-1" onClick={save}>{t("save")}</Button>)}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${strong ? "bg-primary/10" : "bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
