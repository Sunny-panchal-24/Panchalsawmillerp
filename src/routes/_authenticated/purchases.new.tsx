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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchases/new")({
  component: NewPurchase,
});

type Vendor = { id: string; name: string };
type Tractor = { id: string; number: string; default_empty_weight: number };

const MAN_KG = 20;

function calcActualMan(netMan: number, type: "A" | "B") {
  if (type === "B") return netMan;
  // Type A: 5 Man cut per 100 Man (proportional)
  const cut = (netMan / 100) * 5;
  return Math.max(0, netMan - cut);
}

function NewPurchase() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [tractors, setTractors] = useState<Tractor[]>([]);

  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    entry_no: String(Date.now()).slice(-6),
    entry_date: today,
    vendor_id: "",
    tractor_id: "",
    weight_with_material: "",
    empty_weight: "",
    ptype: "A" as "A" | "B",
    rate_per_man: "",
    forest_expense: "",
    chai_pani_expense: "",
    tractor_labour: "",
    diesel_expense: "",
    other_expense: "",
    pay_now: false,
    paid_amount: "",
    paid_mode: "cash" as "cash" | "dad_saving" | "dad_current" | "sunny_saving",
    remarks: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [v, tr] = await Promise.all([
        supabase.from("vendors").select("id,name").order("name"),
        supabase.from("tractors").select("id,number,default_empty_weight").order("number"),
      ]);
      if (v.data) setVendors(v.data);
      if (tr.data) setTractors(tr.data);
    })();
  }, []);

  // when tractor changes, prefill empty weight
  const onTractor = (id: string) => {
    const tr = tractors.find((x) => x.id === id);
    setF((p) => ({
      ...p,
      tractor_id: id,
      empty_weight: tr ? String(tr.default_empty_weight) : p.empty_weight,
    }));
  };

  const calc = useMemo(() => {
    const wWith = Number(f.weight_with_material) || 0;
    const wEmp = Number(f.empty_weight) || 0;
    const netWeight = Math.max(0, wWith - wEmp);
    const netMan = netWeight / MAN_KG;
    const actualMan = calcActualMan(netMan, f.ptype);
    const rate = Number(f.rate_per_man) || 0;
    const materialCost = actualMan * rate;
    const expenses =
      (Number(f.forest_expense) || 0) +
      (Number(f.chai_pani_expense) || 0) +
      (Number(f.tractor_labour) || 0) +
      (Number(f.diesel_expense) || 0) +
      (Number(f.other_expense) || 0);
    const totalCost = materialCost + expenses;
    const costPerMan = actualMan > 0 ? totalCost / actualMan : 0;
    return { netWeight, netMan, actualMan, materialCost, totalCost, costPerMan };
  }, [f]);

  const save = async () => {
    if (!f.vendor_id) return toast.error(t("vendor"));
    if (!f.entry_no.trim()) return toast.error(t("entry_no"));
    setSaving(true);
    const payload = {
      entry_no: f.entry_no.trim(),
      entry_date: f.entry_date,
      vendor_id: f.vendor_id,
      tractor_id: f.tractor_id || null,
      weight_with_material: Number(f.weight_with_material) || 0,
      empty_weight: Number(f.empty_weight) || 0,
      net_weight: calc.netWeight,
      net_man: calc.netMan,
      ptype: f.ptype,
      actual_man: calc.actualMan,
      rate_per_man: Number(f.rate_per_man) || 0,
      material_cost: calc.materialCost,
      forest_expense: Number(f.forest_expense) || 0,
      chai_pani_expense: Number(f.chai_pani_expense) || 0,
      tractor_labour: Number(f.tractor_labour) || 0,
      diesel_expense: Number(f.diesel_expense) || 0,
      other_expense: Number(f.other_expense) || 0,
      total_cost: calc.totalCost,
      cost_per_man: calc.costPerMan,
      paid_amount: f.pay_now ? Number(f.paid_amount) || 0 : 0,
      paid_mode: f.pay_now ? f.paid_mode : null,
      remarks: f.remarks.trim() || null,
    };
    const { data, error } = await supabase.from("purchases").insert(payload).select("id").single();
    if (error) { setSaving(false); return toast.error(error.message); }

    if (f.pay_now && Number(f.paid_amount) > 0) {
      const { error: pErr } = await supabase.from("vendor_payments").insert({
        vendor_id: f.vendor_id,
        payment_date: f.entry_date,
        amount: Number(f.paid_amount),
        mode: f.paid_mode,
        purchase_id: data.id,
        remarks: `Purchase #${f.entry_no}`,
      });
      if (pErr) { setSaving(false); return toast.error(pErr.message); }
    }
    toast.success(t("saved"));
    setSaving(false);
    navigate({ to: "/purchases" });
  };

  return (
    <AppShell title={t("new_purchase")} backTo="/purchases">
      <div className="space-y-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("entry_no")}>
            <Input value={f.entry_no} onChange={(e) => setF({ ...f, entry_no: e.target.value })} className="h-11 text-base" />
          </Field>
          <Field label={t("date")}>
            <Input type="date" value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value })} className="h-11 text-base" />
          </Field>
        </div>

        <Field label={t("vendor")}>
          <Select value={f.vendor_id} onValueChange={(v) => setF({ ...f, vendor_id: v })}>
            <SelectTrigger className="h-12 text-base"><SelectValue placeholder={t("select")} /></SelectTrigger>
            <SelectContent>
              {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("tractor")}>
          <Select value={f.tractor_id} onValueChange={onTractor}>
            <SelectTrigger className="h-12 text-base"><SelectValue placeholder={t("select")} /></SelectTrigger>
            <SelectContent>
              {tractors.map((tr) => <SelectItem key={tr.id} value={tr.id}>{tr.number}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("weight_with_material")}>
            <Input type="number" inputMode="decimal" value={f.weight_with_material} onChange={(e) => setF({ ...f, weight_with_material: e.target.value })} className="h-11 text-base" />
          </Field>
          <Field label={t("empty_weight")}>
            <Input type="number" inputMode="decimal" value={f.empty_weight} onChange={(e) => setF({ ...f, empty_weight: e.target.value })} className="h-11 text-base" />
          </Field>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
          <Row label={t("net_weight")} value={`${calc.netWeight.toFixed(2)} kg`} />
          <Row label={t("net_man")} value={calc.netMan.toFixed(2)} />
        </div>

        <Field label={t("purchase_type")}>
          <Select value={f.ptype} onValueChange={(v) => setF({ ...f, ptype: v as "A" | "B" })}>
            <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A">{t("type_a")}</SelectItem>
              <SelectItem value="B">{t("type_b")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("actual_man")}>
            <Input value={calc.actualMan.toFixed(2)} readOnly className="h-11 text-base bg-muted" />
          </Field>
          <Field label={t("rate_per_man")}>
            <Input type="number" inputMode="decimal" value={f.rate_per_man} onChange={(e) => setF({ ...f, rate_per_man: e.target.value })} className="h-11 text-base" />
          </Field>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <Row label={t("material_cost")} value={`₹${calc.materialCost.toFixed(2)}`} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("forest_expense")}><Input type="number" inputMode="decimal" value={f.forest_expense} onChange={(e) => setF({ ...f, forest_expense: e.target.value })} className="h-11 text-base" /></Field>
          <Field label={t("chai_pani_expense")}><Input type="number" inputMode="decimal" value={f.chai_pani_expense} onChange={(e) => setF({ ...f, chai_pani_expense: e.target.value })} className="h-11 text-base" /></Field>
          <Field label={t("tractor_labour")}><Input type="number" inputMode="decimal" value={f.tractor_labour} onChange={(e) => setF({ ...f, tractor_labour: e.target.value })} className="h-11 text-base" /></Field>
          <Field label={t("diesel_expense")}><Input type="number" inputMode="decimal" value={f.diesel_expense} onChange={(e) => setF({ ...f, diesel_expense: e.target.value })} className="h-11 text-base" /></Field>
          <Field label={t("other_expense")}><Input type="number" inputMode="decimal" value={f.other_expense} onChange={(e) => setF({ ...f, other_expense: e.target.value })} className="h-11 text-base" /></Field>
        </div>

        <div className="rounded-lg border-2 border-primary bg-primary/5 p-3 space-y-1">
          <Row label={t("total_cost")} value={<span className="text-lg font-bold">₹{calc.totalCost.toFixed(2)}</span>} />
          <Row label={t("cost_per_man")} value={`₹${calc.costPerMan.toFixed(2)}`} />
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox checked={f.pay_now} onCheckedChange={(c) => setF({ ...f, pay_now: Boolean(c) })} />
            <span className="text-base font-medium">{t("pay_now")}</span>
          </label>
          {f.pay_now && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("payment_amount")}>
                <Input type="number" inputMode="decimal" value={f.paid_amount} onChange={(e) => setF({ ...f, paid_amount: e.target.value })} className="h-11 text-base" />
              </Field>
              <Field label={t("payment_mode")}>
                <Select value={f.paid_mode} onValueChange={(v) => setF({ ...f, paid_mode: v as typeof f.paid_mode })}>
                  <SelectTrigger className="h-11 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("cash")}</SelectItem>
                    <SelectItem value="dad_saving">{t("dad_saving")}</SelectItem>
                    <SelectItem value="dad_current">{t("dad_current")}</SelectItem>
                    <SelectItem value="sunny_saving">{t("sunny_saving")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
        </div>

        <Field label={t("remarks")}>
          <Input value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} className="h-11 text-base" />
        </Field>

        <Button size="lg" className="w-full h-14 text-lg" onClick={save} disabled={saving}>
          {t("save_purchase")}
        </Button>
      </div>
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
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
