import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cash-book")({
  component: CashBook,
});

type Txn = { date: string; label: string; ref?: string; inAmt: number; outAmt: number };

type Filter = "today" | "week" | "month" | "custom" | "all";

function CashBook() {
  const { t } = useI18n();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [opening, setOpening] = useState(0);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [editOpening, setEditOpening] = useState(false);
  const [openingInput, setOpeningInput] = useState("");
  const [filter, setFilter] = useState<Filter>("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { data: cs }, { data: pu }, { data: sa }, { data: vp },
        { data: cr }, { data: ex }, { data: wa }, { data: ws },
        { data: va },
      ] = await Promise.all([
        supabase.from("company_settings").select("id,opening_cash").limit(1).maybeSingle(),

        supabase.from("purchases").select("entry_date,entry_no,paid_amount,paid_mode,tractor_paid_amount,tractor_paid_mode"),
        supabase.from("sales").select("sale_date,sale_no,paid_amount,payment_mode,payment_status"),
        supabase.from("vendor_payments").select("payment_date,amount,mode,vendor_id,remarks"),
        supabase.from("customer_receipts").select("receipt_date,amount,mode,customer_id,remarks"),
        supabase.from("expenses").select("expense_date,amount,payment_mode,description,expense_type"),
        supabase.from("worker_advances").select("advance_date,amount,payment_mode,worker_id"),
        supabase.from("worker_salaries").select("period_end,paid_amount,payment_mode,worker_id"),
        supabase.from("vendor_advances").select("advance_date,amount,bank_account_id,vendor_id"),
      ]);

      setOpening(Number(cs?.opening_cash ?? 0));
      const list: Txn[] = [];
      (pu ?? []).forEach((r) => {
        if (Number(r.paid_amount ?? 0) > 0 && r.paid_mode === "cash") {
          list.push({ date: r.entry_date, label: `${t("purchase")} ${r.entry_no}`, outAmt: Number(r.paid_amount), inAmt: 0 });
        }
        // tractor_paid columns exist as tractor_paid_amount/mode
        // deliberately kept if present
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tp = (r as any).tractor_paid_amount;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tm = (r as any).tractor_paid_mode;
        if (Number(tp ?? 0) > 0 && tm === "cash") {
          list.push({ date: r.entry_date, label: `${t("tractor_payment")} ${r.entry_no}`, outAmt: Number(tp), inAmt: 0 });
        }
      });
      (sa ?? []).forEach((r) => {
        if (Number(r.paid_amount ?? 0) > 0 && r.payment_mode === "cash") {
          list.push({ date: r.sale_date, label: `${t("sale")} ${r.sale_no}`, inAmt: Number(r.paid_amount), outAmt: 0 });
        }
      });
      (vp ?? []).forEach((r) => {
        if (r.mode === "cash") list.push({ date: r.payment_date, label: `${t("vendor_payment")}`, outAmt: Number(r.amount), inAmt: 0 });
      });
      (cr ?? []).forEach((r) => {
        if (r.mode === "cash") list.push({ date: r.receipt_date, label: `${t("customer_receipt")}`, inAmt: Number(r.amount), outAmt: 0 });
      });
      (ex ?? []).forEach((r) => {
        if (r.payment_mode === "cash") list.push({ date: (r.expense_date ?? "") as string, label: `${t(r.expense_type === "maintenance" ? "maintenance" : "other_expense")}`, outAmt: Number(r.amount), inAmt: 0 });
      });
      (wa ?? []).forEach((r) => {
        if (r.payment_mode === "cash") list.push({ date: r.advance_date, label: `${t("worker_advance")}`, outAmt: Number(r.amount), inAmt: 0 });
      });
      (ws ?? []).forEach((r) => {
        if (r.payment_mode === "cash" && Number(r.paid_amount ?? 0) > 0) list.push({ date: (r.period_end ?? "") as string, label: `${t("salary")}`, outAmt: Number(r.paid_amount), inAmt: 0 });
      });
      (va ?? []).forEach((r) => {
        if (!r.bank_account_id) list.push({ date: r.advance_date, label: `${t("vendor_advance")}`, outAmt: Number(r.amount), inAmt: 0 });
      });

      list.sort((a, b) => b.date.localeCompare(a.date));
      setTxns(list);
      setLoading(false);
    })();
  }, [t]);

  const range = useMemo(() => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (filter === "today") return { from: iso(today), to: iso(today) };
    if (filter === "week") { const w = new Date(today); w.setDate(w.getDate() - 6); return { from: iso(w), to: iso(today) }; }
    if (filter === "month") { const m = new Date(today.getFullYear(), today.getMonth(), 1); return { from: iso(m), to: iso(today) }; }
    if (filter === "custom") return { from: fromDate, to: toDate };
    return { from: "", to: "" };
  }, [filter, fromDate, toDate]);

  const filtered = useMemo(() => {
    let list = txns;
    if (range.from) list = list.filter((r) => r.date >= range.from);
    if (range.to) list = list.filter((r) => r.date <= range.to);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.label.toLowerCase().includes(q));
    }
    return list;
  }, [txns, range, search]);

  const totalIn = filtered.reduce((s, r) => s + r.inAmt, 0);
  const totalOut = filtered.reduce((s, r) => s + r.outAmt, 0);
  const closing = opening + txns.reduce((s, r) => s + r.inAmt - r.outAmt, 0);

  const exportCSV = () => {
    const rows = [["Date", "Description", "In", "Out"]];
    filtered.forEach((r) => rows.push([r.date, r.label, r.inAmt.toString(), r.outAmt.toString()]));
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cash-book-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell title={t("cash_book")}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat label={t("opening_cash")} value={opening} />
        <Stat label={t("current_balance")} value={closing} highlight />
        <Stat label={t("cash_in")} value={totalIn} color="text-emerald-700" />
        <Stat label={t("cash_out")} value={totalOut} color="text-rose-700" />
      </div>

      <div className="mb-3 grid grid-cols-4 gap-1">
        {(["today", "week", "month", "custom"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{t(f)}</Button>
        ))}
      </div>
      {filter === "custom" && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      )}
      <div className="mb-3 flex gap-2">
        <Input className="flex-1" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button size="sm" variant="outline" onClick={exportCSV}>{t("export_excel")}</Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">{t("loading")}</p>
      ) : filtered.length === 0 ? (
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
    </AppShell>
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
