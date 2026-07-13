import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/bank-book")({
  component: BankBook,
});

type Bank = { id: string; name: string; opening_balance: number };
type Txn = { date: string; label: string; inAmt: number; outAmt: number };

function BankBook() {
  const { t } = useI18n();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [byBank, setByBank] = useState<Record<string, Txn[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [
        { data: bk }, { data: pu }, { data: sa }, { data: vp },
        { data: cr }, { data: ex }, { data: wa }, { data: ws }, { data: va },
      ] = await Promise.all([
        supabase.from("bank_accounts").select("id,name,opening_balance").eq("is_active", true).order("name"),
        supabase.from("purchases").select("entry_date,entry_no,paid_amount,paid_mode,bank_account_id,tractor_paid_amount,tractor_paid_mode,tractor_bank_account_id"),
        supabase.from("sales").select("sale_date,sale_no,paid_amount,payment_mode,bank_account_id"),
        supabase.from("vendor_payments").select("payment_date,amount,mode,bank_account_id"),
        supabase.from("customer_receipts").select("receipt_date,amount,mode,bank_account_id"),
        supabase.from("expenses").select("expense_date,amount,bank_account_id,description,expense_type"),
        supabase.from("worker_advances").select("advance_date,amount,bank_account_id"),
        supabase.from("worker_salaries").select("period_end,paid_amount,bank_account_id"),
        supabase.from("vendor_advances").select("advance_date,amount,bank_account_id"),
      ]);

      setBanks((bk ?? []) as Bank[]);
      const map: Record<string, Txn[]> = {};
      const push = (id: string | null | undefined, tx: Txn) => {
        if (!id) return;
        if (!map[id]) map[id] = [];
        map[id].push(tx);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pu ?? []).forEach((r: any) => {
        if (Number(r.paid_amount ?? 0) > 0 && r.bank_account_id) push(r.bank_account_id, { date: r.entry_date, label: `${t("purchase")} ${r.entry_no}`, outAmt: Number(r.paid_amount), inAmt: 0 });
        const tp = r.tractor_paid_amount; const tb = r.tractor_bank_account_id;
        if (Number(tp ?? 0) > 0 && tb) push(tb, { date: r.entry_date, label: `${t("tractor_payment")} ${r.entry_no}`, outAmt: Number(tp), inAmt: 0 });
      });
      (sa ?? []).forEach((r) => {
        if (Number(r.paid_amount ?? 0) > 0 && r.bank_account_id) push(r.bank_account_id, { date: r.sale_date, label: `${t("sale")} ${r.sale_no}`, inAmt: Number(r.paid_amount), outAmt: 0 });
      });
      (vp ?? []).forEach((r) => r.bank_account_id && push(r.bank_account_id, { date: r.payment_date, label: t("vendor_payment"), outAmt: Number(r.amount), inAmt: 0 }));
      (cr ?? []).forEach((r) => r.bank_account_id && push(r.bank_account_id, { date: r.receipt_date, label: t("customer_receipt"), inAmt: Number(r.amount), outAmt: 0 }));
      (ex ?? []).forEach((r) => r.bank_account_id && push(r.bank_account_id, { date: (r.expense_date ?? "") as string, label: t(r.expense_type === "maintenance" ? "maintenance" : "other_expense"), outAmt: Number(r.amount), inAmt: 0 }));
      (wa ?? []).forEach((r) => r.bank_account_id && push(r.bank_account_id, { date: r.advance_date, label: t("worker_advance"), outAmt: Number(r.amount), inAmt: 0 }));
      (ws ?? []).forEach((r) => r.bank_account_id && Number(r.paid_amount ?? 0) > 0 && push(r.bank_account_id, { date: (r.period_end ?? "") as string, label: t("salary"), outAmt: Number(r.paid_amount), inAmt: 0 }));
      (va ?? []).forEach((r) => r.bank_account_id && push(r.bank_account_id, { date: r.advance_date, label: t("vendor_advance"), outAmt: Number(r.amount), inAmt: 0 }));

      Object.keys(map).forEach((k) => map[k].sort((a, b) => b.date.localeCompare(a.date)));
      setByBank(map);
      setLoading(false);
    })();
  }, [t]);

  if (loading) return <AppShell title={t("bank_book")}><p className="text-center text-muted-foreground">{t("loading")}</p></AppShell>;
  if (banks.length === 0) return <AppShell title={t("bank_book")}><p className="text-center text-muted-foreground">{t("no_records")}</p></AppShell>;

  return (
    <AppShell title={t("bank_book")}>
      <Tabs defaultValue={banks[0].id}>
        <TabsList className="w-full flex-wrap h-auto">
          {banks.map((b) => <TabsTrigger key={b.id} value={b.id} className="flex-1 min-w-0">{b.name}</TabsTrigger>)}
        </TabsList>
        {banks.map((b) => (
          <TabsContent key={b.id} value={b.id}>
            <BankPanel bank={b} txns={byBank[b.id] ?? []} search={search} setSearch={setSearch} />
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}

function BankPanel({ bank, txns, search, setSearch }: { bank: Bank; txns: Txn[]; search: string; setSearch: (v: string) => void }) {
  const { t } = useI18n();
  const filtered = useMemo(() => {
    if (!search.trim()) return txns;
    const q = search.toLowerCase();
    return txns.filter((r) => r.label.toLowerCase().includes(q));
  }, [txns, search]);
  const totalIn = filtered.reduce((s, r) => s + r.inAmt, 0);
  const totalOut = filtered.reduce((s, r) => s + r.outAmt, 0);
  const balance = Number(bank.opening_balance ?? 0) + txns.reduce((s, r) => s + r.inAmt - r.outAmt, 0);

  const exportCSV = () => {
    const rows = [["Date", "Description", "In", "Out"]];
    filtered.forEach((r) => rows.push([r.date, r.label, r.inAmt.toString(), r.outAmt.toString()]));
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${bank.name.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t("opening_balance")} value={Number(bank.opening_balance ?? 0)} />
        <Stat label={t("current_balance")} value={balance} highlight />
        <Stat label={t("money_in")} value={totalIn} color="text-emerald-700" />
        <Stat label={t("money_out")} value={totalOut} color="text-rose-700" />
      </div>
      <div className="flex gap-2">
        <Input className="flex-1" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button size="sm" variant="outline" onClick={exportCSV}>{t("export_excel")}</Button>
      </div>
      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground">{t("no_records")}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r, i) => (
            <div key={i} className="rounded-xl border bg-card p-3 flex justify-between items-center">
              <div>
                <div className="font-medium text-sm">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.date}</div>
              </div>
              {r.inAmt > 0 && <div className="font-bold text-emerald-700">+ ₹{r.inAmt.toFixed(2)}</div>}
              {r.outAmt > 0 && <div className="font-bold text-rose-700">- ₹{r.outAmt.toFixed(2)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, highlight }: { label: string; value: number; color?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-3 ${highlight ? "border-primary bg-primary/5" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-bold text-lg ${color ?? ""}`}>₹{value.toFixed(2)}</div>
    </div>
  );
}
