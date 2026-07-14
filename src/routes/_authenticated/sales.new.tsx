import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Search, Check } from "lucide-react";
import { entryNoExists, nextEntryNo } from "@/lib/entry-no";

const CASH = "__cash__";

type Customer = { id: string; name: string; mobile: string | null };
type Bank = { id: string; name: string };

function dateFromInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export const Route = createFileRoute("/_authenticated/sales/new")({
  validateSearch: (s: Record<string, unknown>) => ({
    type: (s.type === "finished" ? "finished" : "waste") as "waste" | "finished",
  }),
  component: NewSaleWizard,
});

function NewSaleWizard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { type: saleType } = Route.useSearch();
  const isWaste = saleType === "waste";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [step, setStep] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const [entryMode, setEntryMode] = useState<"auto" | "manual">("auto");
  const [saleNo, setSaleNo] = useState("");
  const [dateMode, setDateMode] = useState<"today" | "manual">("today");
  const [saleDate, setSaleDate] = useState(today);

  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

  // waste
  const [grossWeight, setGrossWeight] = useState("");
  const [emptyWeight, setEmptyWeight] = useState("");
  // finished
  const [cft, setCft] = useState("");

  const [rate, setRate] = useState("");

  // payment
  const [payStatus, setPayStatus] = useState<"full" | "partial" | "credit">("full");
  const [paidAmount, setPaidAmount] = useState("");
  const [payMode, setPayMode] = useState<string>(CASH);

  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  // Add customer dialog
  const [addCustOpen, setAddCustOpen] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", mobile: "", address: "" });

  const loadAll = async () => {
    const [{ data: c }, { data: b }] = await Promise.all([
      supabase.from("customers").select("id,name,mobile").order("name"),
      supabase.from("bank_accounts").select("id,name").eq("is_active", true).order("name"),
    ]);
    setCustomers((c ?? []) as Customer[]);
    setBanks((b ?? []) as Bank[]);
  };
  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (entryMode !== "auto" || !saleDate) return;
    let cancelled = false;
    nextEntryNo("sales", "sale_no", dateFromInput(saleDate))
      .then((value) => { if (!cancelled) setSaleNo(value); })
      .catch(() => { if (!cancelled) setSaleNo(""); });
    return () => { cancelled = true; };
  }, [entryMode, saleDate]);

  // Calculations
  const netWeight = useMemo(() => {
    if (!isWaste) return 0;
    const n = (parseFloat(grossWeight) || 0) - (parseFloat(emptyWeight) || 0);
    return n > 0 ? n : 0;
  }, [grossWeight, emptyWeight, isWaste]);

  const totalAmount = useMemo(() => {
    const r = parseFloat(rate) || 0;
    if (isWaste) return +(netWeight * r).toFixed(2);
    return +((parseFloat(cft) || 0) * r).toFixed(2);
  }, [isWaste, netWeight, cft, rate]);

  const computedPaid = useMemo(() => {
    if (payStatus === "full") return totalAmount;
    if (payStatus === "credit") return 0;
    return Math.min(parseFloat(paidAmount) || 0, totalAmount);
  }, [payStatus, paidAmount, totalAmount]);

  const outstanding = +(totalAmount - computedPaid).toFixed(2);

  const filteredCustomers = useMemo(() => {
    const s = customerSearch.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) =>
      c.name.toLowerCase().includes(s) || (c.mobile ?? "").includes(s),
    );
  }, [customers, customerSearch]);

  const addCustomer = async () => {
    if (!newCust.name.trim()) return toast.error(t("required"));
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: newCust.name.trim(),
        mobile: newCust.mobile.trim() || null,
        address: newCust.address.trim() || null,
        type: "both",
        created_by: user!.id,
      })
      .select("id,name,mobile")
      .single();
    if (error) return toast.error(error.message);
    setCustomers((p) => [...p, data as Customer]);
    setCustomerId((data as Customer).id);
    setAddCustOpen(false);
    setNewCust({ name: "", mobile: "", address: "" });
  };

  // Steps: 0 entry# 1 date 2 customer 3 weight/cft 4 rate 5 payment 6 summary
  const steps = ["entry_no_mode", "date_mode", "customer", isWaste ? "weight" : "cft", "rate_amount", "payment", "summary"];
  const canNext = () => {
    if (step === 0) return saleNo.trim().length > 0;
    if (step === 1) return !!saleDate;
    if (step === 2) return !!customerId;
    if (step === 3) {
      if (isWaste) return netWeight > 0;
      return (parseFloat(cft) || 0) > 0;
    }
    if (step === 4) return (parseFloat(rate) || 0) > 0;
    if (step === 5) {
      if (payStatus === "partial") return (parseFloat(paidAmount) || 0) > 0;
      return true;
    }
    return true;
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const finalSaleNo = entryMode === "auto"
        ? await nextEntryNo("sales", "sale_no", dateFromInput(saleDate))
        : saleNo.trim();
      if (!finalSaleNo) throw new Error(t("required"));
      if (await entryNoExists("sales", "sale_no", finalSaleNo)) {
        throw new Error("Entry number already exists");
      }
      setSaleNo(finalSaleNo);
      const bankId = payStatus !== "credit" && payMode !== CASH ? payMode : null;
      const mode = payStatus === "credit" ? null : (payMode === CASH ? "cash" : "bank");

      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          sale_no: finalSaleNo,
          sale_date: saleDate,
          customer_id: customerId,
          sale_type: saleType,
          gross_weight: isWaste ? parseFloat(grossWeight) || 0 : 0,
          empty_weight: isWaste ? parseFloat(emptyWeight) || 0 : 0,
          net_weight: isWaste ? netWeight : 0,
          cft: isWaste ? 0 : parseFloat(cft) || 0,
          rate: parseFloat(rate) || 0,
          total_amount: totalAmount,
          paid_amount: computedPaid,
          outstanding,
          payment_status: payStatus,
          payment_mode: mode,
          bank_account_id: bankId,
          remarks: remarks.trim() || null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (computedPaid > 0) {
        await supabase.from("customer_receipts").insert({
          customer_id: customerId,
          sale_id: sale!.id,
          receipt_date: saleDate,
          amount: computedPaid,
          mode: payMode === CASH ? "cash" : "bank",
          bank_account_id: bankId,
          remarks: t("sale") + " " + finalSaleNo,
          created_by: user.id,
        });
      }

      toast.success(t("saved"));
      navigate({ to: "/sales" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const title = isWaste ? t("waste_wood_sale") : t("finished_wood_sale");

  return (
    <AppShell title={title} backTo="/sales">
      <div className="mb-3 text-sm text-muted-foreground">
        {t("step")} {step + 1} {t("of")} {steps.length}
      </div>

      {/* Step 0: Entry number */}
      {step === 0 && (
        <div className="space-y-4">
          <Label className="text-base font-semibold">{t("entry_no_mode")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={entryMode === "auto" ? "default" : "outline"} className="h-12"
              onClick={() => setEntryMode("auto")}>
              {t("auto_generate")}
            </Button>
            <Button variant={entryMode === "manual" ? "default" : "outline"} className="h-12"
              onClick={() => setEntryMode("manual")}>
              {t("manual_entry")}
            </Button>
          </div>
          <div>
            <Label>{t("entry_no")}</Label>
            <Input className="h-12 text-base" value={saleNo} onChange={(e) => setSaleNo(e.target.value)}
              disabled={entryMode === "auto"} />
          </div>
        </div>
      )}

      {/* Step 1: Date */}
      {step === 1 && (
        <div className="space-y-4">
          <Label className="text-base font-semibold">{t("date_mode")}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={dateMode === "today" ? "default" : "outline"} className="h-12"
              onClick={() => { setDateMode("today"); setSaleDate(today); }}>
              {t("today_auto")}
            </Button>
            <Button variant={dateMode === "manual" ? "default" : "outline"} className="h-12"
              onClick={() => setDateMode("manual")}>
              {t("manual_date")}
            </Button>
          </div>
          <div>
            <Label>{t("date")}</Label>
            <Input type="date" className="h-12 text-base" value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)} disabled={dateMode === "today"} />
          </div>
        </div>
      )}

      {/* Step 2: Customer */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">{t("customer")}</Label>
            <Button size="sm" variant="outline" onClick={() => setAddCustOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> {t("add_new_customer")}
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("search")} className="h-12 pl-9"
              value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
            {filteredCustomers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCustomerId(c.id)}
                className={`text-left rounded-lg border-2 p-3 ${customerId === c.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <div className="font-semibold">{c.name}</div>
                {c.mobile && <div className="text-sm text-muted-foreground">{c.mobile}</div>}
              </button>
            ))}
            {filteredCustomers.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">{t("no_records")}</div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Weight or CFT */}
      {step === 3 && isWaste && (
        <div className="space-y-3">
          <div>
            <Label>{t("gross_weight")}</Label>
            <Input type="number" inputMode="decimal" className="h-12 text-base"
              value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} />
          </div>
          <div>
            <Label>{t("empty_weight")}</Label>
            <Input type="number" inputMode="decimal" className="h-12 text-base"
              value={emptyWeight} onChange={(e) => setEmptyWeight(e.target.value)} />
          </div>
          <div className="rounded-lg bg-muted p-3 text-base">
            <div>{t("net_weight")}: <strong>{netWeight.toFixed(2)} kg</strong></div>
          </div>
        </div>
      )}
      {step === 3 && !isWaste && (
        <div className="space-y-3">
          <div>
            <Label>{t("cft")}</Label>
            <Input type="number" inputMode="decimal" className="h-12 text-base"
              value={cft} onChange={(e) => setCft(e.target.value)} />
          </div>
        </div>
      )}

      {/* Step 4: Rate */}
      {step === 4 && (
        <div className="space-y-3">
          <div>
            <Label>{isWaste ? t("rate_per_kg") : t("rate_per_cft")}</Label>
            <Input type="number" inputMode="decimal" className="h-12 text-base"
              value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="rounded-lg bg-muted p-3 text-base">
            <div>{t("total")}: <strong>₹{totalAmount.toFixed(2)}</strong></div>
          </div>
        </div>
      )}

      {/* Step 5: Payment */}
      {step === 5 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">{t("sale_payment")}</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button variant={payStatus === "full" ? "default" : "outline"} className="h-12"
              onClick={() => setPayStatus("full")}>{t("full_received")}</Button>
            <Button variant={payStatus === "partial" ? "default" : "outline"} className="h-12"
              onClick={() => setPayStatus("partial")}>{t("partial_received")}</Button>
            <Button variant={payStatus === "credit" ? "default" : "outline"} className="h-12"
              onClick={() => setPayStatus("credit")}>{t("credit_sale")}</Button>
          </div>
          {payStatus !== "credit" && (
            <>
              {payStatus === "partial" && (
                <div>
                  <Label>{t("amount_received")}</Label>
                  <Input type="number" inputMode="decimal" className="h-12 text-base"
                    value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
                </div>
              )}
              <div>
                <Label>{t("payment_mode")}</Label>
                <Select value={payMode} onValueChange={setPayMode}>
                  <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CASH}>{t("cash")}</SelectItem>
                    {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="rounded-lg bg-muted p-3 space-y-1 text-base">
            <div>{t("total")}: <strong>₹{totalAmount.toFixed(2)}</strong></div>
            <div>{t("paid")}: <strong>₹{computedPaid.toFixed(2)}</strong></div>
            {outstanding > 0 && (
              <div className="text-rose-600">
                {t("remaining_outstanding")}: <strong>₹{outstanding.toFixed(2)}</strong>
              </div>
            )}
          </div>
          <div>
            <Label>{t("remarks")}</Label>
            <Input className="h-12 text-base" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
      )}

      {/* Step 6: Summary */}
      {step === 6 && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("entry_no")}</span><strong>{saleNo}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("date")}</span><strong>{saleDate}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("customer")}</span><strong>{customers.find((c) => c.id === customerId)?.name ?? "—"}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("type")}</span><strong>{isWaste ? t("waste") : t("finished")}</strong></div>
            {isWaste ? (
              <div className="flex justify-between"><span className="text-muted-foreground">{t("net_weight")}</span><strong>{netWeight.toFixed(2)} kg</strong></div>
            ) : (
              <div className="flex justify-between"><span className="text-muted-foreground">{t("cft")}</span><strong>{cft}</strong></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">{t("rate")}</span><strong>₹{rate}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("total")}</span><strong>₹{totalAmount.toFixed(2)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("paid")}</span><strong>₹{computedPaid.toFixed(2)}</strong></div>
            {outstanding > 0 && (
              <div className="flex justify-between text-rose-600"><span>{t("outstanding")}</span><strong>₹{outstanding.toFixed(2)}</strong></div>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="mt-6 flex justify-between gap-2">
        <Button variant="outline" className="h-12 flex-1" disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ChevronLeft className="h-5 w-5" /> {t("previous")}
        </Button>
        {step < steps.length - 1 ? (
          <Button className="h-12 flex-1" disabled={!canNext()}
            onClick={() => setStep((s) => s + 1)}>
            {t("next")} <ChevronRight className="h-5 w-5" />
          </Button>
        ) : (
          <Button className="h-12 flex-1" disabled={saving} onClick={save}>
            <Check className="h-5 w-5" /> {t("confirm_save")}
          </Button>
        )}
      </div>

      {/* Add customer dialog */}
      <Dialog open={addCustOpen} onOpenChange={setAddCustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("add_new_customer")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("name")}</Label><Input className="h-12" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} /></div>
            <div><Label>{t("mobile")}</Label><Input className="h-12" value={newCust.mobile} onChange={(e) => setNewCust({ ...newCust, mobile: e.target.value })} /></div>
            <div><Label>{t("address")}</Label><Input className="h-12" value={newCust.address} onChange={(e) => setNewCust({ ...newCust, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCustOpen(false)}>{t("cancel")}</Button>
            <Button onClick={addCustomer}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
