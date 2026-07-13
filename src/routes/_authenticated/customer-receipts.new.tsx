import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customer-receipts/new")({
  component: NewCustomerReceiptWizard,
});

const CASH = "__cash__";
type Customer = { id: string; name: string; mobile: string | null };
type Bank = { id: string; name: string };

function autoRef() {
  const d = new Date();
  return `CR${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(Date.now()).slice(-4)}`;
}

function NewCustomerReceiptWizard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [entryMode, setEntryMode] = useState<"auto" | "manual">("auto");
  const [ref, setRef] = useState(autoRef());
  const [dateMode, setDateMode] = useState<"today" | "manual">("today");
  const [date, setDate] = useState(today);
  const [outstanding, setOutstanding] = useState(0);
  const [amount, setAmount] = useState("");
  const [advanceOk, setAdvanceOk] = useState(false);
  const [payMode, setPayMode] = useState<string>(CASH);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: b }] = await Promise.all([
        supabase.from("customers").select("id,name,mobile").order("name"),
        supabase.from("bank_accounts").select("id,name").eq("is_active", true).order("name"),
      ]);
      setCustomers((c ?? []) as Customer[]);
      setBanks((b ?? []) as Bank[]);
    })();
  }, []);

  useEffect(() => {
    if (!customerId) { setOutstanding(0); return; }
    (async () => {
      const [{ data: c }, { data: sa }, { data: re }] = await Promise.all([
        supabase.from("customers").select("opening_balance").eq("id", customerId).single(),
        supabase.from("sales").select("outstanding").eq("customer_id", customerId),
        supabase.from("customer_receipts").select("amount,sale_id").eq("customer_id", customerId),
      ]);
      const opening = Number(c?.opening_balance ?? 0);
      const salesOut = (sa ?? []).reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
      const gp = (re ?? []).filter((r) => !r.sale_id).reduce((s, r) => s + Number(r.amount), 0);
      setOutstanding(opening + salesOut - gp);
    })();
  }, [customerId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.mobile ?? "").includes(q));
  }, [customers, search]);

  const amt = parseFloat(amount) || 0;
  const exceeds = amt > outstanding;

  const steps = ["customer", "entry_no", "date", "outstanding", "amount", "payment_mode", "remarks", "summary"];
  const canNext = () => {
    switch (step) {
      case 0: return !!customerId;
      case 1: return ref.trim().length > 0;
      case 2: return !!date;
      case 4: return amt > 0 && (!exceeds || advanceOk);
      default: return true;
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const bankId = payMode !== CASH ? payMode : null;
      const mode = payMode === CASH ? "cash" : "bank";
      const { error } = await supabase.from("customer_receipts").insert({
        customer_id: customerId,
        receipt_date: date,
        amount: amt,
        mode,
        bank_account_id: bankId,
        remarks: (remarks.trim() || ref).slice(0, 500),
        created_by: user.id,
      });
      if (error) throw error;
      toast.success(t("saved"));
      navigate({ to: "/customer-receipts" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setSaving(false); }
  };

  const selected = customers.find((c) => c.id === customerId);

  return (
    <AppShell title={t("new_customer_receipt")} backTo="/customer-receipts">
      <div className="mb-3 text-sm text-muted-foreground">{t("step")} {step + 1} {t("of")} {steps.length}</div>

      {step === 0 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t("customer")}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="h-12 pl-9" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filtered.map((c) => (
              <button key={c.id} type="button" onClick={() => setCustomerId(c.id)}
                className={`w-full rounded-lg border-2 p-3 text-left ${customerId === c.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <div className="font-semibold">{c.name}</div>
                {c.mobile && <div className="text-xs text-muted-foreground">{c.mobile}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t("entry_no_mode")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={entryMode === "auto" ? "default" : "outline"} className="h-12"
              onClick={() => { setEntryMode("auto"); setRef(autoRef()); }}>{t("auto_generate")}</Button>
            <Button variant={entryMode === "manual" ? "default" : "outline"} className="h-12"
              onClick={() => setEntryMode("manual")}>{t("manual_entry")}</Button>
          </div>
          <Input className="h-12 text-base" value={ref} onChange={(e) => setRef(e.target.value)} disabled={entryMode === "auto"} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t("date_mode")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={dateMode === "today" ? "default" : "outline"} className="h-12"
              onClick={() => { setDateMode("today"); setDate(today); }}>{t("today_auto")}</Button>
            <Button variant={dateMode === "manual" ? "default" : "outline"} className="h-12"
              onClick={() => setDateMode("manual")}>{t("manual_date")}</Button>
          </div>
          <Input type="date" className="h-12 text-base" value={date} onChange={(e) => setDate(e.target.value)} disabled={dateMode === "today"} />
        </div>
      )}

      {step === 3 && (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <div className="text-sm text-muted-foreground">{t("current_outstanding")}</div>
          <div className="text-3xl font-bold text-rose-700 mt-2">₹{outstanding.toFixed(2)}</div>
          <div className="text-sm text-muted-foreground mt-2">{selected?.name}</div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t("receipt_amount")}</Label>
          <Input type="number" inputMode="decimal" className="h-14 text-2xl" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="rounded-lg bg-muted p-3 text-sm">
            {t("outstanding")}: <strong>₹{outstanding.toFixed(2)}</strong>
          </div>
          {exceeds && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-sm">
              <div className="text-amber-800 font-medium">{t("exceeds_outstanding_msg")}</div>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={advanceOk} onChange={(e) => setAdvanceOk(e.target.checked)} />
                <span>{t("mark_as_advance_receipt")}</span>
              </label>
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t("payment_mode")}</Label>
          <Select value={payMode} onValueChange={setPayMode}>
            <SelectTrigger className="h-14 text-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={CASH}>{t("cash")}</SelectItem>
              {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t("remarks")} ({t("optional")})</Label>
          <Input className="h-12 text-base" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      )}

      {step === 7 && (
        <div className="rounded-2xl border bg-card p-4 space-y-2 text-sm">
          <Row k={t("customer")} v={selected?.name ?? "—"} />
          <Row k={t("entry_no")} v={ref} />
          <Row k={t("date")} v={date} />
          <Row k={t("receipt_amount")} v={`₹${amt.toFixed(2)}`} />
          <Row k={t("payment_mode")} v={payMode === CASH ? t("cash") : banks.find((b) => b.id === payMode)?.name ?? "—"} />
          {remarks && <Row k={t("remarks")} v={remarks} />}
        </div>
      )}

      <div className="mt-6 flex justify-between gap-2">
        <Button variant="outline" className="h-12 flex-1" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ChevronLeft className="h-5 w-5" /> {t("previous")}
        </Button>
        {step < steps.length - 1 ? (
          <Button className="h-12 flex-1" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
            {t("next")} <ChevronRight className="h-5 w-5" />
          </Button>
        ) : (
          <Button className="h-12 flex-1" disabled={saving} onClick={save}>
            <Check className="h-5 w-5" /> {t("confirm_save")}
          </Button>
        )}
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <strong>{v}</strong>
    </div>
  );
}
