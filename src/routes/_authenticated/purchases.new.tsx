import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Search, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/purchases/new")({
  component: NewPurchaseWizard,
});

const MAN_KG = 20;
const CASH = "__cash__";

type Vendor = { id: string; name: string; village: string | null };
type Tractor = { id: string; number: string; default_empty_weight: number };
type Bank = { id: string; name: string };

type PayMode = typeof CASH | string;

function autoEntryNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${ymd}-${String(Date.now()).slice(-4)}`;
}

function NewPurchaseWizard() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [tractors, setTractors] = useState<Tractor[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);

  // Step
  const [step, setStep] = useState(0);

  // Form
  const today = new Date().toISOString().slice(0, 10);
  const [entryMode, setEntryMode] = useState<"auto" | "manual">("auto");
  const [entryNo, setEntryNo] = useState(autoEntryNo());
  const [dateMode, setDateMode] = useState<"today" | "manual">("today");
  const [entryDate, setEntryDate] = useState(today);

  const [vendorId, setVendorId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [tractorId, setTractorId] = useState("");
  const [tractorSearch, setTractorSearch] = useState("");

  const [grossWeight, setGrossWeight] = useState("");
  const [emptyWeight, setEmptyWeight] = useState("");
  const [ratePerMan, setRatePerMan] = useState("");

  const [availableAdvance, setAvailableAdvance] = useState(0);
  const [advanceMode, setAdvanceMode] = useState<"deduct" | "pending">("pending");
  const [advanceDeduct, setAdvanceDeduct] = useState("");

  const [forestChaiPani, setForestChaiPani] = useState("");
  const [extraDeduction, setExtraDeduction] = useState("");

  const [vendorPayMode, setVendorPayMode] = useState<"now" | "later">("later");
  const [vendorPayAmt, setVendorPayAmt] = useState("");
  const [vendorPayTarget, setVendorPayTarget] = useState<PayMode>(CASH);

  const [tractorRate, setTractorRate] = useState("");
  const [tractorChai, setTractorChai] = useState("");
  const [diesel, setDiesel] = useState("");
  const [tractorExtra, setTractorExtra] = useState("");

  const [tractorPayMode, setTractorPayMode] = useState<"now" | "later">("later");
  const [tractorPayAmt, setTractorPayAmt] = useState("");
  const [tractorPayTarget, setTractorPayTarget] = useState<PayMode>(CASH);

  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  // Inline add dialogs
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [addTractorOpen, setAddTractorOpen] = useState(false);

  const loadAll = async () => {
    const [v, tr, bk] = await Promise.all([
      supabase.from("vendors").select("id,name,village").order("name"),
      supabase.from("tractors").select("id,number,default_empty_weight").order("number"),
      supabase.from("bank_accounts").select("id,name").eq("is_active", true).order("name"),
    ]);
    if (v.data) setVendors(v.data);
    if (tr.data) setTractors(tr.data);
    if (bk.data) setBanks(bk.data);
  };
  useEffect(() => { loadAll(); }, []);

  // Fetch available advance for vendor
  useEffect(() => {
    if (!vendorId) { setAvailableAdvance(0); return; }
    (async () => {
      const [v, advRows, dedRows] = await Promise.all([
        supabase.from("vendors").select("opening_advance").eq("id", vendorId).single(),
        supabase.from("vendor_advances").select("amount").eq("vendor_id", vendorId),
        supabase.from("purchases").select("advance_deducted").eq("vendor_id", vendorId),
      ]);
      const opening = Number(v.data?.opening_advance ?? 0);
      const adv = (advRows.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const ded = (dedRows.data ?? []).reduce((s, r) => s + Number(r.advance_deducted ?? 0), 0);
      setAvailableAdvance(Math.max(0, opening + adv - ded));
    })();
  }, [vendorId]);

  // Computations
  const calc = useMemo(() => {
    const gross = Number(grossWeight) || 0;
    const empty = Number(emptyWeight) || 0;
    const netWeight = Math.max(0, gross - empty);
    const netMan = netWeight / MAN_KG; // original man
    const nilCut = (netMan / 100) * 5;
    const finalMan = Math.max(0, netMan - nilCut);
    const rate = Number(ratePerMan) || 0;
    const materialValue = finalMan * rate;
    const advDed = advanceMode === "deduct" ? Math.min(Number(advanceDeduct) || 0, availableAdvance) : 0;
    const fcp = Number(forestChaiPani) || 0;
    const extra = Number(extraDeduction) || 0;
    const vendorPayable = Math.max(0, materialValue - advDed - fcp - extra);

    const trRate = Number(tractorRate) || 0;
    const tractorLabour = finalMan * trRate;
    const tCp = Number(tractorChai) || 0;
    const tDsl = Number(diesel) || 0;
    const tExt = Number(tractorExtra) || 0;
    const tractorPayable = tractorLabour + tCp + tDsl + tExt;

    const rawMaterialCost = vendorPayable + tractorPayable;
    const costPerMan = netMan > 0 ? rawMaterialCost / netMan : 0;
    const costPerKg = netWeight > 0 ? rawMaterialCost / netWeight : 0;

    return {
      netWeight, netMan, nilCut, finalMan, rate, materialValue, advDed, fcp, extra, vendorPayable,
      trRate, tractorLabour, tCp, tDsl, tExt, tractorPayable, rawMaterialCost, costPerMan, costPerKg,
    };
  }, [grossWeight, emptyWeight, ratePerMan, advanceMode, advanceDeduct, availableAdvance, forestChaiPani, extraDeduction, tractorRate, tractorChai, diesel, tractorExtra]);

  const onTractorPick = (id: string) => {
    setTractorId(id);
    const tr = tractors.find((x) => x.id === id);
    if (tr && !emptyWeight) setEmptyWeight(String(tr.default_empty_weight));
  };

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => v.name.toLowerCase().includes(q) || (v.village ?? "").toLowerCase().includes(q));
  }, [vendors, vendorSearch]);
  const filteredTractors = useMemo(() => {
    const q = tractorSearch.trim().toLowerCase();
    if (!q) return tractors;
    return tractors.filter((t) => t.number.toLowerCase().includes(q));
  }, [tractors, tractorSearch]);

  // Steps definition
  const steps: { key: string; title: string; render: () => React.ReactNode; valid: () => boolean }[] = [
    {
      key: "entry_no",
      title: t("entry_no"),
      render: () => (
        <div className="space-y-4">
          <RadioRow value={entryMode} onChange={(v) => {
            const m = v as "auto" | "manual";
            setEntryMode(m);
            if (m === "auto") setEntryNo(autoEntryNo());
          }} options={[
            { val: "auto", label: t("auto_generate") },
            { val: "manual", label: t("manual_entry") },
          ]} />
          <Field label={t("entry_no")}>
            <Input value={entryNo} onChange={(e) => setEntryNo(e.target.value)} readOnly={entryMode === "auto"} className="h-12 text-lg" />
          </Field>
        </div>
      ),
      valid: () => entryNo.trim().length > 0,
    },
    {
      key: "date",
      title: t("date"),
      render: () => (
        <div className="space-y-4">
          <RadioRow value={dateMode} onChange={(v) => {
            const m = v as "today" | "manual";
            setDateMode(m);
            if (m === "today") setEntryDate(today);
          }} options={[
            { val: "today", label: t("today_auto") },
            { val: "manual", label: t("manual_date") },
          ]} />
          <Field label={t("date")}>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} readOnly={dateMode === "today"} className="h-12 text-lg" />
          </Field>
        </div>
      ),
      valid: () => entryDate.length > 0,
    },
    {
      key: "vendor",
      title: t("vendor"),
      render: () => (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("search")} value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} className="h-12 pl-9 text-base" />
          </div>
          <Button variant="outline" className="w-full h-12 justify-center" onClick={() => setAddVendorOpen(true)}>
            <Plus className="mr-1 h-5 w-5" /> {t("add_new_vendor")}
          </Button>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {filteredVendors.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">{t("no_records")}</p>
            ) : filteredVendors.map((v) => (
              <button key={v.id} type="button" onClick={() => setVendorId(v.id)}
                className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${vendorId === v.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-base">{v.name}</div>
                    {v.village && <div className="text-xs text-muted-foreground">{v.village}</div>}
                  </div>
                  {vendorId === v.id && <Check className="h-5 w-5 text-primary" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      ),
      valid: () => !!vendorId,
    },
    {
      key: "tractor",
      title: t("tractor"),
      render: () => (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("search")} value={tractorSearch} onChange={(e) => setTractorSearch(e.target.value)} className="h-12 pl-9 text-base" />
          </div>
          <Button variant="outline" className="w-full h-12 justify-center" onClick={() => setAddTractorOpen(true)}>
            <Plus className="mr-1 h-5 w-5" /> {t("add_tractor")}
          </Button>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {filteredTractors.map((tr) => (
              <button key={tr.id} type="button" onClick={() => onTractorPick(tr.id)}
                className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${tractorId === tr.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-base">{tr.number}</div>
                    <div className="text-xs text-muted-foreground">{t("empty_weight")}: {tr.default_empty_weight} kg</div>
                  </div>
                  {tractorId === tr.id && <Check className="h-5 w-5 text-primary" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      ),
      valid: () => !!tractorId,
    },
    {
      key: "weights",
      title: t("weight_with_material"),
      render: () => (
        <div className="space-y-4">
          <Field label={t("gross_weight")}>
            <Input type="number" inputMode="decimal" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} className="h-14 text-2xl" />
          </Field>
          <Field label={t("empty_weight")}>
            <Input type="number" inputMode="decimal" value={emptyWeight} onChange={(e) => setEmptyWeight(e.target.value)} className="h-14 text-2xl" />
          </Field>
          <SummaryBox rows={[
            [t("net_weight"), `${calc.netWeight.toFixed(2)} kg`],
            [t("net_man"), calc.netMan.toFixed(2)],
            [t("nil_cut"), `- ${calc.nilCut.toFixed(2)}`],
            [t("final_man"), <strong key="fm" className="text-lg">{calc.finalMan.toFixed(2)}</strong>],
          ]} />
        </div>
      ),
      valid: () => calc.netWeight > 0,
    },
    {
      key: "rate",
      title: t("rate_per_man"),
      render: () => (
        <div className="space-y-4">
          <Field label={t("rate_per_man")}>
            <Input type="number" inputMode="decimal" value={ratePerMan} onChange={(e) => setRatePerMan(e.target.value)} className="h-14 text-2xl" />
          </Field>
          <SummaryBox highlight rows={[
            [t("final_man"), calc.finalMan.toFixed(2)],
            [t("rate_per_man"), `₹${calc.rate.toFixed(2)}`],
            [t("material_value"), <strong key="mv" className="text-xl">₹{calc.materialValue.toFixed(2)}</strong>],
          ]} />
        </div>
      ),
      valid: () => calc.rate > 0,
    },
    {
      key: "advance",
      title: t("advance"),
      render: () => (
        <div className="space-y-4">
          <SummaryBox rows={[[t("available_advance"), <strong key="a" className="text-lg">₹{availableAdvance.toFixed(2)}</strong>]]} />
          {availableAdvance > 0 ? (
            <>
              <RadioRow value={advanceMode} onChange={(v) => setAdvanceMode(v as "deduct" | "pending")} options={[
                { val: "deduct", label: t("deduct_now") },
                { val: "pending", label: t("keep_pending") },
              ]} />
              {advanceMode === "deduct" && (
                <>
                  <Field label={t("amount_to_deduct")}>
                    <Input type="number" inputMode="decimal" value={advanceDeduct} onChange={(e) => setAdvanceDeduct(e.target.value)} className="h-14 text-2xl" />
                  </Field>
                  <SummaryBox rows={[[t("remaining_advance"), `₹${(availableAdvance - calc.advDed).toFixed(2)}`]]} />
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">—</p>
          )}
        </div>
      ),
      valid: () => true,
    },
    {
      key: "deductions",
      title: t("forest_chai_pani"),
      render: () => (
        <div className="space-y-4">
          <Field label={t("forest_chai_pani")}>
            <Input type="number" inputMode="decimal" value={forestChaiPani} onChange={(e) => setForestChaiPani(e.target.value)} className="h-14 text-2xl" />
          </Field>
          <Field label={t("extra_deduction")}>
            <Input type="number" inputMode="decimal" value={extraDeduction} onChange={(e) => setExtraDeduction(e.target.value)} className="h-14 text-2xl" />
          </Field>
          <SummaryBox highlight rows={[
            [t("material_value"), `₹${calc.materialValue.toFixed(2)}`],
            [`- ${t("advance")}`, `₹${calc.advDed.toFixed(2)}`],
            [`- ${t("forest_chai_pani")}`, `₹${calc.fcp.toFixed(2)}`],
            [`- ${t("extra_deduction")}`, `₹${calc.extra.toFixed(2)}`],
            [t("vendor_payable"), <strong key="vp" className="text-xl">₹{calc.vendorPayable.toFixed(2)}</strong>],
          ]} />
        </div>
      ),
      valid: () => true,
    },
    {
      key: "vendor_payment",
      title: t("vendor_payment"),
      render: () => (
        <div className="space-y-4">
          <RadioRow value={vendorPayMode} onChange={(v) => setVendorPayMode(v as "now" | "later")} options={[
            { val: "now", label: t("pay_now") },
            { val: "later", label: t("pay_later") },
          ]} />
          {vendorPayMode === "now" && (
            <>
              <Field label={t("payment_amount")}>
                <Input type="number" inputMode="decimal" value={vendorPayAmt} onChange={(e) => setVendorPayAmt(e.target.value)} className="h-14 text-2xl" />
              </Field>
              <Field label={t("payment_mode")}>
                <Select value={vendorPayTarget} onValueChange={setVendorPayTarget}>
                  <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CASH}>{t("cash")}</SelectItem>
                    {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </div>
      ),
      valid: () => true,
    },
    {
      key: "tractor_cost",
      title: t("tractor_payable"),
      render: () => (
        <div className="space-y-4">
          <Field label={t("tractor_rate_per_man")}>
            <Input type="number" inputMode="decimal" value={tractorRate} onChange={(e) => setTractorRate(e.target.value)} className="h-14 text-2xl" />
          </Field>
          <Field label={t("tractor_chai_pani")}>
            <Input type="number" inputMode="decimal" value={tractorChai} onChange={(e) => setTractorChai(e.target.value)} className="h-14 text-2xl" />
          </Field>
          <Field label={t("diesel_expense")}>
            <Input type="number" inputMode="decimal" value={diesel} onChange={(e) => setDiesel(e.target.value)} className="h-14 text-2xl" />
          </Field>
          <Field label={t("extra_cost")}>
            <Input type="number" inputMode="decimal" value={tractorExtra} onChange={(e) => setTractorExtra(e.target.value)} className="h-14 text-2xl" />
          </Field>
          <SummaryBox highlight rows={[
            [t("tractor_labour"), `₹${calc.tractorLabour.toFixed(2)}`],
            [t("tractor_chai_pani"), `₹${calc.tCp.toFixed(2)}`],
            [t("diesel_expense"), `₹${calc.tDsl.toFixed(2)}`],
            [t("extra_cost"), `₹${calc.tExt.toFixed(2)}`],
            [t("tractor_payable"), <strong key="tp" className="text-xl">₹{calc.tractorPayable.toFixed(2)}</strong>],
          ]} />
        </div>
      ),
      valid: () => true,
    },
    {
      key: "tractor_payment",
      title: t("tractor_payment"),
      render: () => (
        <div className="space-y-4">
          <RadioRow value={tractorPayMode} onChange={(v) => setTractorPayMode(v as "now" | "later")} options={[
            { val: "now", label: t("pay_now") },
            { val: "later", label: t("pay_later") },
          ]} />
          {tractorPayMode === "now" && (
            <>
              <Field label={t("payment_amount")}>
                <Input type="number" inputMode="decimal" value={tractorPayAmt} onChange={(e) => setTractorPayAmt(e.target.value)} className="h-14 text-2xl" />
              </Field>
              <Field label={t("payment_mode")}>
                <Select value={tractorPayTarget} onValueChange={setTractorPayTarget}>
                  <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CASH}>{t("cash")}</SelectItem>
                    {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </div>
      ),
      valid: () => true,
    },
    {
      key: "summary",
      title: t("summary"),
      render: () => (
        <div className="space-y-4">
          <SummaryBox highlight rows={[
            [t("vendor_payable"), `₹${calc.vendorPayable.toFixed(2)}`],
            [t("tractor_payable"), `₹${calc.tractorPayable.toFixed(2)}`],
            [t("raw_material_cost"), <strong key="rm" className="text-xl">₹{calc.rawMaterialCost.toFixed(2)}</strong>],
            [t("cost_per_man"), `₹${calc.costPerMan.toFixed(2)}`],
            [t("cost_per_kg"), `₹${calc.costPerKg.toFixed(2)}`],
          ]} />
          <Field label={t("remarks")}>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="h-12 text-base" />
          </Field>
        </div>
      ),
      valid: () => true,
    },
  ];

  const cur = steps[step];

  const next = () => {
    if (!cur.valid()) { toast.error(t("required")); return; }
    setStep((s) => Math.min(steps.length - 1, s + 1));
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const save = async () => {
    if (!vendorId) return toast.error(t("vendor"));
    setSaving(true);
    const vendorBankId = vendorPayMode === "now" && vendorPayTarget !== CASH ? vendorPayTarget : null;
    const tractorBankId = tractorPayMode === "now" && tractorPayTarget !== CASH ? tractorPayTarget : null;
    const vAmt = vendorPayMode === "now" ? Number(vendorPayAmt) || 0 : 0;
    const tAmt = tractorPayMode === "now" ? Number(tractorPayAmt) || 0 : 0;

    const payload = {
      entry_no: entryNo.trim(),
      entry_date: entryDate,
      vendor_id: vendorId,
      tractor_id: tractorId || null,
      weight_with_material: Number(grossWeight) || 0,
      empty_weight: Number(emptyWeight) || 0,
      net_weight: calc.netWeight,
      net_man: calc.netMan,
      ptype: "A" as const,
      actual_man: calc.finalMan,
      rate_per_man: calc.rate,
      material_cost: calc.materialValue,
      forest_expense: calc.fcp,
      chai_pani_expense: 0,
      tractor_labour: calc.tractorLabour,
      diesel_expense: calc.tDsl,
      other_expense: calc.extra,
      total_cost: calc.rawMaterialCost,
      cost_per_man: calc.costPerMan,
      advance_deducted: calc.advDed,
      vendor_payable: calc.vendorPayable,
      tractor_rate_per_man: calc.trRate,
      tractor_payable: calc.tractorPayable,
      tractor_paid_amount: tAmt,
      tractor_paid_mode: tractorPayMode === "now" ? ("cash" as const) : null,
      tractor_bank_account_id: tractorBankId,
      paid_amount: vAmt,
      paid_mode: vendorPayMode === "now" ? ("cash" as const) : null,
      bank_account_id: vendorBankId,
      remarks: remarks.trim() || null,
    };

    const { data, error } = await supabase.from("purchases").insert(payload).select("id").single();
    if (error) { setSaving(false); return toast.error(error.message); }

    if (vendorPayMode === "now" && vAmt > 0) {
      const { error: pErr } = await supabase.from("vendor_payments").insert({
        vendor_id: vendorId, payment_date: entryDate, amount: vAmt,
        mode: "cash", bank_account_id: vendorBankId, purchase_id: data.id,
        remarks: `Purchase #${entryNo}`,
      });
      if (pErr) toast.error(pErr.message);
    }

    toast.success(t("saved"));
    setSaving(false);
    navigate({ to: "/purchases" });
  };

  const pct = Math.round(((step + 1) / steps.length) * 100);

  return (
    <AppShell title={t("new_purchase")} backTo="/purchases">
      <div className="pb-32">
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
            <span>{t("step")} {step + 1} {t("of")} {steps.length}</span>
            <span className="font-semibold text-foreground">{cur.title}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="rounded-xl border-2 bg-card p-4">{cur.render()}</div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur px-3 py-3">
          <div className="mx-auto max-w-3xl flex gap-2">
            <Button variant="outline" className="h-14 flex-1 text-base" onClick={prev} disabled={step === 0}>
              <ChevronLeft className="mr-1 h-5 w-5" /> {t("previous")}
            </Button>
            {step < steps.length - 1 ? (
              <Button className="h-14 flex-[2] text-base" onClick={next}>
                {t("next")} <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
            ) : (
              <Button className="h-14 flex-[2] text-base" onClick={save} disabled={saving}>
                {saving ? "..." : t("confirm_save")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <AddVendorDialog
        open={addVendorOpen}
        onClose={() => setAddVendorOpen(false)}
        onCreated={async (id) => {
          await loadAll();
          setVendorId(id);
          setAddVendorOpen(false);
        }}
      />
      <AddTractorDialog
        open={addTractorOpen}
        onClose={() => setAddTractorOpen(false)}
        onCreated={async (id, empty) => {
          await loadAll();
          setTractorId(id);
          if (!emptyWeight) setEmptyWeight(String(empty));
          setAddTractorOpen(false);
        }}
      />
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-base">{label}</Label>
      {children}
    </div>
  );
}

function RadioRow({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { val: string; label: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button key={o.val} type="button" onClick={() => onChange(o.val)}
          className={`h-14 rounded-lg border-2 px-3 text-base font-semibold transition-colors ${value === o.val ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SummaryBox({ rows, highlight }: { rows: [string, React.ReactNode][]; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 text-sm space-y-1 ${highlight ? "border-2 border-primary bg-primary/5" : "border bg-muted/40"}`}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2">
          <span className="text-muted-foreground">{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

function AddVendorDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (id: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [village, setVillage] = useState("");
  const [mobile, setMobile] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) { setName(""); setVillage(""); setMobile(""); } }, [open]);
  const save = async () => {
    if (!name.trim()) return toast.error(t("required"));
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("vendors").insert({
      name: name.trim(), village: village.trim() || null, mobile: mobile.trim() || null,
      created_by: user!.id,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    onCreated(data.id);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("add_new_vendor")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label={t("name")}><Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 text-base" autoFocus /></Field>
          <Field label={t("village")}><Input value={village} onChange={(e) => setVillage(e.target.value)} className="h-11 text-base" /></Field>
          <Field label={t("mobile")}><Input value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-11 text-base" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={save} disabled={saving}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddTractorDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (id: string, empty: number) => void;
}) {
  const { t } = useI18n();
  const [number, setNumber] = useState("");
  const [empty, setEmpty] = useState("");
  const [driver, setDriver] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) { setNumber(""); setEmpty(""); setDriver(""); } }, [open]);
  const save = async () => {
    if (!number.trim()) return toast.error(t("required"));
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const emptyNum = Number(empty) || 0;
    const { data, error } = await supabase.from("tractors").insert({
      number: number.trim(), default_empty_weight: emptyNum,
      driver_name: driver.trim() || null, created_by: user!.id,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    onCreated(data.id, emptyNum);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("add_tractor")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label={t("tractor_number")}><Input value={number} onChange={(e) => setNumber(e.target.value)} className="h-11 text-base" autoFocus /></Field>
          <Field label={t("default_empty_weight")}><Input type="number" inputMode="decimal" value={empty} onChange={(e) => setEmpty(e.target.value)} className="h-11 text-base" /></Field>
          <Field label={t("driver_name")}><Input value={driver} onChange={(e) => setDriver(e.target.value)} className="h-11 text-base" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={save} disabled={saving}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
