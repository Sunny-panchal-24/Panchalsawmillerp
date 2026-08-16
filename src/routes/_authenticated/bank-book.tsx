import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EditRecordDialog, type EditField } from "@/components/EditRecordDialog";

export const Route = createFileRoute("/_authenticated/bank-book")({
  component: BankBook,
});

type Bank = { id: string; name: string; opening_balance: number };
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

const FIELDS: Record<string, (t: (k: string) => string) => EditField[]> = {
  vendor_payments: (t) => [
    { key: "payment_date", label: t("date"), type: "date" },
    { key: "amount", label: t("amount"), type: "number" },
    { key: "remarks", label: t("remarks") },
  ],
  customer_receipts: (t) => [
    { key: "receipt_date", label: t("date"), type: "date" },
    { key: "amount", label: t("amount"), type: "number" },
    { key: "remarks", label: t("remarks") },
  ],
  expenses: (t) => [
    { key: "expense_date", label: t("date"), type: "date" },
    { key: "amount", label: t("amount"), type: "number" },
    { key: "description", label: t("description") },
  ],
  worker_advances: (t) => [
    { key: "advance_date", label: t("date"), type: "date" },
    { key: "amount", label: t("amount"), type: "number" },
  ],
  worker_salaries: (t) => [
    { key: "paid_amount", label: t("amount"), type: "number" },
    { key: "outstanding", label: t("outstanding"), type: "number" },
  ],
  vendor_advances: (t) => [
    { key: "advance_date", label: t("date"), type: "date" },
    { key: "amount", label: t("amount"), type: "number" },
  ],
};

function BankBook() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [byBank, setByBank] = useState<Record<string, Txn[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editTxn, setEditTxn] = useState<Txn | null>(null);

  const load = async () => {
    const [
      { data: bk }, { data: pu }, { data: sa }, { data: vp },
      { data: cr }, { data: ex }, { data: wa }, { data: ws }, { data: va },
    ] = await Promise.all([
      supabase.from("bank_accounts").select("id,name,opening_balance").eq("is_active", true).order("name"),
      supabase.from("purchases").select("id,entry_date,entry_no,paid_amount,paid_mode,bank_account_id,tractor_paid_amount,tractor_paid_mode,tractor_bank_account_id"),
      supabase.from("sales").select("id,sale_date,sale_no,sale_type,paid_amount,payment_mode,bank_account_id"),
      supabase.from("vendor_payments").select("id,payment_date,amount,mode,bank_account_id,remarks"),
      supabase.from("customer_receipts").select("id,receipt_date,amount,mode,bank_account_id,remarks"),
      supabase.from("expenses").select("id,expense_date,amount,bank_account_id,description,expense_type"),
      supabase.from("worker_advances").select("id,advance_date,amount,bank_account_id"),
      supabase.from("worker_salaries").select("id,period_end,paid_amount,bank_account_id,outstanding"),
      supabase.from("vendor_advances").select("id,advance_date,amount,bank_account_id"),
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
      if (Number(r.paid_amount ?? 0) > 0 && r.bank_account_id) push(r.bank_account_id, { date: r.entry_date, label: `${t("purchase")} ${r.entry_no}`, outAmt: Number(r.paid_amount), inAmt: 0, table: "purchases", id: r.id, row: r, wizard: "purchase" });
      if (Number(r.tractor_paid_amount ?? 0) > 0 && r.tractor_bank_account_id) push(r.tractor_bank_account_id, { date: r.entry_date, label: `${t("tractor_payment")} ${r.entry_no}`, outAmt: Number(r.tractor_paid_amount), inAmt: 0, table: "purchases", id: r.id, row: r, wizard: "purchase" });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sa ?? []).forEach((r: any) => {
      if (Number(r.paid_amount ?? 0) > 0 && r.bank_account_id) push(r.bank_account_id, { date: r.sale_date, label: `${t("sale")} ${r.sale_no}`, inAmt: Number(r.paid_amount), outAmt: 0, table: "sales", id: r.id, row: r, wizard: "sale", saleType: r.sale_type });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vp ?? []).forEach((r: any) => r.bank_account_id && push(r.bank_account_id, { date: r.payment_date, label: t("vendor_payment"), outAmt: Number(r.amount), inAmt: 0, table: "vendor_payments", id: r.id, row: r }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cr ?? []).forEach((r: any) => r.bank_account_id && push(r.bank_account_id, { date: r.receipt_date, label: t("customer_receipt"), inAmt: Number(r.amount), outAmt: 0, table: "customer_receipts", id: r.id, row: r }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ex ?? []).forEach((r: any) => r.bank_account_id && push(r.bank_account_id, { date: (r.expense_date ?? "") as string, label: t(r.expense_type === "maintenance" ? "maintenance" : "other_expense"), outAmt: Number(r.amount), inAmt: 0, table: "expenses", id: r.id, row: r }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (wa ?? []).forEach((r: any) => r.bank_account_id && push(r.bank_account_id, { date: r.advance_date, label: t("worker_advance"), outAmt: Number(r.amount), inAmt: 0, table: "worker_advances", id: r.id, row: r }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ws ?? []).forEach((r: any) => r.bank_account_id && Number(r.paid_amount ?? 0) > 0 && push(r.bank_account_id, { date: (r.period_end ?? "") as string, label: t("salary"), outAmt: Number(r.paid_amount), inAmt: 0, table: "worker_salaries", id: r.id, row: r }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (va ?? []).forEach((r: any) => r.bank_account_id && push(r.bank_account_id, { date: r.advance_date, label: t("vendor_advance"), outAmt: Number(r.amount), inAmt: 0, table: "vendor_advances", id: r.id, row: r }));

    Object.keys(map).forEach((k) => map[k].sort((a, b) => b.date.localeCompare(a.date)));
    setByBank(map);
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
            <BankPanel
              bank={b}
              txns={byBank[b.id] ?? []}
              search={search}
              setSearch={setSearch}
              onEdit={openEdit}
              onDelete={removeTxn}
              onOpeningSaved={load}
            />
          </TabsContent>
        ))}
      </Tabs>

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

function BankPanel({
  bank, txns, search, setSearch, onEdit, onDelete, onOpeningSaved,
}: {
  bank: Bank;
  txns: Txn[];
  search: string;
  setSearch: (v: string) => void;
  onEdit: (r: Txn) => void;
  onDelete: (r: Txn) => void;
  onOpeningSaved: () => void;
}) {
  const { t } = useI18n();
  const [editOpening, setEditOpening] = useState(false);
  const [openingInput, setOpeningInput] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return txns;
    const q = search.toLowerCase();
    return txns.filter((r) => r.label.toLowerCase().includes(q));
  }, [txns, search]);
  const totalIn = filtered.reduce((s, r) => s + r.inAmt, 0);
  const totalOut = filtered.reduce((s, r) => s + r.outAmt, 0);
  const balance = Number(bank.opening_balance ?? 0) + txns.reduce((s, r) => s + r.inAmt - r.outAmt, 0);

  const saveOpening = async () => {
    const val = Number(openingInput) || 0;
    const { error } = await supabase.from("bank_accounts").update({ opening_balance: val }).eq("id", bank.id);
    if (error) return toast.error(error.message);
    setEditOpening(false);
    toast.success(t("saved") || "Saved");
    onOpeningSaved();
  };

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
        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t("opening_balance")}</div>
          {editOpening ? (
            <div className="mt-1 flex gap-1">
              <Input type="number" inputMode="decimal" className="h-9" value={openingInput} onChange={(e) => setOpeningInput(e.target.value)} />
              <Button size="sm" onClick={saveOpening}>{t("save")}</Button>
            </div>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1 text-left font-bold text-lg underline decoration-dotted"
              onClick={() => { setOpeningInput(String(Number(bank.opening_balance ?? 0))); setEditOpening(true); }}
            >
              ₹{Number(bank.opening_balance ?? 0).toFixed(2)} <Pencil className="h-3.5 w-3.5 opacity-60" />
            </button>
          )}
        </div>
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
            <div key={`${r.table}-${r.id}-${i}`} className="rounded-xl border bg-card p-3 flex items-center gap-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(r)}>
                <div className="font-medium text-sm truncate">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.date}</div>
              </button>
              {r.inAmt > 0 && <div className="font-bold text-emerald-700 shrink-0">+ ₹{r.inAmt.toFixed(2)}</div>}
              {r.outAmt > 0 && <div className="font-bold text-rose-700 shrink-0">- ₹{r.outAmt.toFixed(2)}</div>}
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={t("edit")} onClick={() => onEdit(r)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-red-600" aria-label={t("delete")} onClick={() => onDelete(r)}>
                <Trash2 className="h-4 w-4" />
              </Button>
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
