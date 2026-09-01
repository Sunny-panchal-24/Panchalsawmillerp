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
import { nextRef } from "@/lib/entry-no";

export const Route = createFileRoute("/_authenticated/vendor-payments/new")({
  component: NewVendorPaymentWizard,
});

const CASH = "__cash__";
type Vendor = { id: string; name: string; village: string | null };
type Bank = { id: string; name: string };

function NewVendorPaymentWizard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  const [vendorId, setVendorId] = useState("");
  const [search, setSearch] = useState("");
  const [entryMode, setEntryMode] = useState<"auto" | "manual">("auto");
  const [ref, setRef] = useState("");
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
      const [{ data: v }, { data: b }] = await Promise.all([
        supabase.from("vendors").select("id,name,village").order("name"),
        supabase.from("bank_accounts").select("id,name").eq("is_active", true).order("name"),
      ]);
      setVendors((v ?? []) as Vendor[]);
      setBanks((b ?? []) as Bank[]);
    })();
  }, []);

  const genRef = async () => setRef(await nextRef({ table: "vendor_payments", column: "remarks", type: "VP", scanRemarks: true }));
  useEffect(() => { if (entryMode === "auto") genRef(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [entryMode]);

  useEffect(() => {
    if (!vendorId) { setOutstanding(0); return; }
    (async () => {
      const [{ data: v }, { data: pu }, { data: pa }] = await Promise.all([
        supabase.from("vendors").select("opening_balance").eq("id", vendorId).single(),
        supabase.from("purchases").select("vendor_payable").eq("vendor_id", vendorId),
        supabase.from("vendor_payments").select("amount").eq("vendor_id", vendorId),
      ]);
      const opening = Number(v?.opening_balance ?? 0);
      const purchTotal = (pu ?? []).reduce((s, r) => s + Number(r.vendor_payable ?? 0), 0);
      const paid = (pa ?? []).reduce((s, r) => s + Number(r.amount), 0);
      setOutstanding(opening + purchTotal - paid);
    })();
  }, [vendorId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => v.name.toLowerCase().includes(q) || (v.village ?? "").toLowerCase().includes(q));
  }, [vendors, search]);

  const amt = parseFloat(amount) || 0;
  const exceeds = amt > outstanding;

  const steps = ["vendor", "entry_no", "date", "outstanding", "amount", "payment_mode", "remarks", "summary"];
  const canNext = () => {
    switch (step) {
      case 0: return !!vendorId;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("vendor_payments").insert({
        vendor_id: vendorId,
        payment_date: date,
        amount: amt,
        mode: "cash",
        bank_account_id: bankId,
        remarks: `${ref}${remarks.trim() ? ` · ${remarks.trim()}` : ""}`.slice(0, 500),
        created_by: user.id,
      } as any);
      if (error) throw error;
      toast.success(t("saved"));
      navigate({ to: "/vendor-payments" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setSaving(false); }
  };

  const selected = vendors.find((v) => v.id === vendorId);

  return (
    <AppShell title={t("new_vendor_payment")} backTo="/vendor-payments">
      <div className="mb-3 text-sm text-muted-foreground">{t("step")} {step + 1} {t("of")} {steps.length}</div>

      {step === 0 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t("vendor")}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="h-12 pl-9" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filtered.map((v) => (
              <button key={v.id} type="button" onClick={() => setVendorId(v.id)}
                className={`w-full rounded-lg border-2 p-3 text-left ${vendorId === v.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <div className="font-semibold">{v.name}</div>
                {v.village && <div className="text-xs text-muted-foreground">{v.village}</div>}
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
              onClick={() => { setEntryMode("auto"); genRef(); }}>{t("auto_generate")}</Button>
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
          <div className="rounded-2xl border-2 border-primary bg-primary/10 p-4 text-center">
            <div className="text-sm text-muted-foreground">{t("payable_amount")}</div>
            <div className="text-3xl font-bold">₹{outstanding.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">{selected?.name}</div>
          </div>
          <Label className="text-base font-semibold">{t("payment_amount")}</Label>
          <Input type="number" inputMode="decimal" className="h-14 text-2xl" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="rounded-lg bg-muted p-3 text-sm">
            {t("outstanding")}: <strong>₹{outstanding.toFixed(2)}</strong>
          </div>

          {exceeds && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-sm">
              <div className="text-amber-800 font-medium">{t("exceeds_outstanding_msg")}</div>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={advanceOk} onChange={(e) => setAdvanceOk(e.target.checked)} />
                <span>{t("mark_as_advance")}</span>
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
          <Row k={t("vendor")} v={selected?.name ?? "—"} />
          <Row k={t("entry_no")} v={ref} />
          <Row k={t("date")} v={date} />
          <Row k={t("payment_amount")} v={`₹${amt.toFixed(2)}`} />
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
