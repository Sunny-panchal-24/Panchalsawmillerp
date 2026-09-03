import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { EditRecordDialog } from "@/components/EditRecordDialog";
import { RowActions } from "@/components/RowActions";
import { editFieldsFor, type Lists } from "@/lib/edit-fields";
import { AdjustmentDialog } from "@/components/AdjustmentDialog";

export const Route = createFileRoute("/_authenticated/cash-book")({
  component: CashBook,
});


type Txn = {
  date: string;
  label: string;
  inAmt: number;
  outAmt: number;
  table: string;
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: Record<string, any>;
  wizard?: "purchase" | "sale";
  saleType?: string;
};

type Filter = "today" | "week" | "month" | "custom" | "all";





function CashBook() {
  const { t } = useI18n();
  const navigate = useNavigate();
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
  const [editTxn, setEditTxn] = useState<Txn | null>(null);
  const [adjOpen, setAdjOpen] = useState(false);

  const load = async () => {
    const [
      { data: cs }, { data: pu }, { data: sa }, { data: vp },
      { data: cr }, { data: ex }, { data: wa }, { data: ws },
      { data: va }, { data: ma },
    ] = await Promise.all([
      supabase.from("company_settings").select("id,opening_cash").limit(1).maybeSingle(),
      supabase.from("purchases").select("id,entry_date,entry_no,paid_amount,paid_mode,tractor_paid_amount,tractor_paid_mode"),
      supabase.from("sales").select("id,sale_date,sale_no,sale_type,paid_amount,payment_mode,payment_status"),
      supabase.from("vendor_payments").select("id,payment_date,amount,mode,vendor_id,remarks"),
      supabase.from("customer_receipts").select("id,receipt_date,amount,mode,customer_id,remarks"),
      supabase.from("expenses").select("id,expense_date,amount,payment_mode,description,expense_type"),
      supabase.from("worker_advances").select("id,advance_date,amount,payment_mode,worker_id"),
      supabase.from("worker_salaries").select("id,period_end,paid_amount,payment_mode,worker_id,outstanding"),
      supabase.from("vendor_advances").select("id,advance_date,amount,bank_account_id,vendor_id"),
      supabase.from("manual_adjustments").select("id,adjust_date,amount,reason,bank_account_id").is("bank_account_id", null),
    ]);

    setOpening(Number(cs?.opening_cash ?? 0));
    setSettingsId(cs?.id ?? null);

    const list: Txn[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pu ?? []).forEach((r: any) => {
      if (Number(r.paid_amount ?? 0) > 0 && r.paid_mode === "cash") {
        list.push({ date: r.entry_date, label: `${t("purchase")} ${r.entry_no}`, outAmt: Number(r.paid_amount), inAmt: 0, table: "purchases", id: r.id, row: r, wizard: "purchase" });
      }
      if (Number(r.tractor_paid_amount ?? 0) > 0 && r.tractor_paid_mode === "cash") {
        list.push({ date: r.entry_date, label: `${t("tractor_payment")} ${r.entry_no}`, outAmt: Number(r.tractor_paid_amount), inAmt: 0, table: "purchases", id: r.id, row: r, wizard: "purchase" });
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sa ?? []).forEach((r: any) => {
      if (Number(r.paid_amount ?? 0) > 0 && r.payment_mode === "cash") {
        list.push({ date: r.sale_date, label: `${t("sale")} ${r.sale_no}`, inAmt: Number(r.paid_amount), outAmt: 0, table: "sales", id: r.id, row: r, wizard: "sale", saleType: r.sale_type });
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vp ?? []).forEach((r: any) => {
      if (r.mode === "cash") list.push({ date: r.payment_date, label: t("vendor_payment"), outAmt: Number(r.amount), inAmt: 0, table: "vendor_payments", id: r.id, row: r });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cr ?? []).forEach((r: any) => {
      if (r.mode === "cash") list.push({ date: r.receipt_date, label: t("customer_receipt"), inAmt: Number(r.amount), outAmt: 0, table: "customer_receipts", id: r.id, row: r });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ex ?? []).forEach((r: any) => {
      if (r.payment_mode === "cash") list.push({ date: (r.expense_date ?? "") as string, label: t(r.expense_type === "maintenance" ? "maintenance" : "other_expense"), outAmt: Number(r.amount), inAmt: 0, table: "expenses", id: r.id, row: r });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (wa ?? []).forEach((r: any) => {
      if (r.payment_mode === "cash") list.push({ date: r.advance_date, label: t("worker_advance"), outAmt: Number(r.amount), inAmt: 0, table: "worker_advances", id: r.id, row: r });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ws ?? []).forEach((r: any) => {
      if (r.payment_mode === "cash" && Number(r.paid_amount ?? 0) > 0) list.push({ date: (r.period_end ?? "") as string, label: t("salary"), outAmt: Number(r.paid_amount), inAmt: 0, table: "worker_salaries", id: r.id, row: r });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (va ?? []).forEach((r: any) => {
      if (!r.bank_account_id) list.push({ date: r.advance_date, label: t("vendor_advance"), outAmt: Number(r.amount), inAmt: 0, table: "vendor_advances", id: r.id, row: r });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ma ?? []).forEach((r: any) => {
      const amt = Number(r.amount ?? 0);
      list.push({ date: r.adjust_date, label: `${t("manual_adjustment")}${r.reason ? " – " + r.reason : ""}`, inAmt: amt > 0 ? amt : 0, outAmt: amt < 0 ? -amt : 0, table: "manual_adjustments", id: r.id, row: r });
    });

    list.sort((a, b) => b.date.localeCompare(a.date));
    setTxns(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [t]);

  const openEdit = (r: Txn) => {
    if (r.wizard === "purchase") return navigate({ to: "/purchases/new", search: { id: r.id } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (r.wizard === "sale") return navigate({ to: "/sales/new", search: { id: r.id, type: (r.saleType ?? "waste") as any } });
    setEditTxn(r);
  };

  const removeTxn = async (r: Txn) => {
    if (!confirm(t("confirm_delete") || "Delete?")) return;
    if (r.table === "sales") await supabase.from("customer_receipts").delete().eq("sale_id", r.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(r.table as any) as any).delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted") || "Deleted");
    load();
  };

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

  const saveOpening = async () => {
    if (!settingsId) return;
    const val = Number(openingInput) || 0;
    const { error } = await supabase.from("company_settings").update({ opening_cash: val }).eq("id", settingsId);
    if (error) return toast.error(error.message);
    setOpening(val);
    setEditOpening(false);
    toast.success(t("saved") || "Saved");
  };

  return (
    <AppShell title={t("cash_book")}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("opening_cash")}</div>
          {editOpening ? (
            <div className="mt-1 flex gap-1">
              <Input
                type="number"
                inputMode="decimal"
                className="h-9"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
              />
              <Button size="sm" onClick={saveOpening}>{t("save")}</Button>
            </div>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1 text-left font-bold text-lg underline decoration-dotted"
              onClick={() => { setOpeningInput(String(opening)); setEditOpening(true); }}
            >
              ₹{opening.toFixed(2)} <Pencil className="h-3.5 w-3.5 opacity-60" />
            </button>
          )}
        </div>
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
        <Button size="sm" onClick={() => setAdjOpen(true)}>+ {t("adjustment")}</Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground">{t("no_records")}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r, i) => (
            <div key={`${r.table}-${r.id}-${i}`} className="rounded-xl border bg-card p-3 flex items-center gap-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEdit(r)}>
                <div className="font-medium text-sm truncate">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.date}</div>
              </button>
              {r.inAmt > 0 && <div className="font-bold text-emerald-700 shrink-0">+ ₹{r.inAmt.toFixed(2)}</div>}
              {r.outAmt > 0 && <div className="font-bold text-rose-700 shrink-0">- ₹{r.outAmt.toFixed(2)}</div>}
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={t("edit")} onClick={() => openEdit(r)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-red-600" aria-label={t("delete")} onClick={() => removeTxn(r)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AdjustmentDialog open={adjOpen} onClose={() => setAdjOpen(false)} onSaved={load} bankAccountId={null} />

      {editTxn && (
        <EditRecordDialog
          open={!!editTxn}
          onClose={() => setEditTxn(null)}
          onSaved={load}
          table={editTxn.table}
          id={editTxn.id}
          row={editTxn.row}
          fields={(FIELDS[editTxn.table] ?? (() => []))(t)}
          title={editTxn.label}
        />
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
