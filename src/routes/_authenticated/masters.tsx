import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/masters")({
  component: MastersPage,
});

type Vendor = { id: string; name: string; village: string | null; opening_balance: number };
type Customer = {
  id: string;
  name: string;
  address: string | null;
  gstin: string | null;
  opening_balance: number;
  type: "waste" | "finished" | "both";
};
type Tractor = { id: string; number: string; default_empty_weight: number; driver_name: string | null };
type Worker = { id: string; name: string; daily_wage: number; salary_type: "weekly" | "monthly" };

function MastersPage() {
  const { t } = useI18n();
  return (
    <AppShell title={t("masters")}>
      <Tabs defaultValue="vendors">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vendors">{t("vendors")}</TabsTrigger>
          <TabsTrigger value="customers">{t("customers")}</TabsTrigger>
          <TabsTrigger value="tractors">{t("tractors")}</TabsTrigger>
          <TabsTrigger value="workers">{t("workers")}</TabsTrigger>
        </TabsList>
        <TabsContent value="vendors" className="mt-4"><VendorsTab /></TabsContent>
        <TabsContent value="customers" className="mt-4"><CustomersTab /></TabsContent>
        <TabsContent value="tractors" className="mt-4"><TractorsTab /></TabsContent>
        <TabsContent value="workers" className="mt-4"><WorkersTab /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ------------------ VENDORS ------------------ */
function VendorsTab() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Vendor[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ name: "", village: "", opening_balance: "0" });

  const load = async () => {
    const { data, error } = await supabase.from("vendors").select("*").order("name");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Vendor[]);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", village: "", opening_balance: "0" });
    setOpen(true);
  };
  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({ name: v.name, village: v.village ?? "", opening_balance: String(v.opening_balance) });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error(t("name"));
    const payload = {
      name: form.name.trim(),
      village: form.village.trim() || null,
      opening_balance: Number(form.opening_balance) || 0,
    };
    const { error } = editing
      ? await supabase.from("vendors").update(payload).eq("id", editing.id)
      : await supabase.from("vendors").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted"));
    load();
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="lg" className="w-full h-12 text-base" onClick={openNew}>
            <Plus className="mr-2 h-5 w-5" /> {t("add")} {t("vendor")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("add")} {t("vendor")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label={t("name")}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 text-base" />
            </Field>
            <Field label={t("village")}>
              <Input value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} className="h-11 text-base" />
            </Field>
            <Field label={t("opening_balance")}>
              <Input type="number" inputMode="decimal" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} className="h-11 text-base" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={save}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rows.length === 0 ? (
        <Empty />
      ) : rows.map((v) => (
        <div key={v.id} className="rounded-lg border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-base font-semibold">{v.name}</div>
              {v.village && <div className="text-sm text-muted-foreground">{v.village}</div>}
              <div className="mt-1 text-sm">{t("opening_balance")}: ₹{Number(v.opening_balance).toFixed(2)}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="outline" onClick={() => navigate({ to: "/vendors/$vendorId/ledger", params: { vendorId: v.id } })} aria-label={t("view_ledger")}><BookOpen className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={() => openEdit(v)} aria-label={t("edit")}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="destructive" onClick={() => remove(v.id)} aria-label={t("delete")}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------ CUSTOMERS ------------------ */
function CustomersTab() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", address: "", gstin: "", opening_balance: "0", type: "both" as Customer["type"] });

  const load = async () => {
    const { data, error } = await supabase.from("customers").select("*").order("name");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Customer[]);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", address: "", gstin: "", opening_balance: "0", type: "both" });
    setOpen(true);
  };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, address: c.address ?? "", gstin: c.gstin ?? "", opening_balance: String(c.opening_balance), type: c.type });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error(t("name"));
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      gstin: form.gstin.trim() || null,
      opening_balance: Number(form.opening_balance) || 0,
      type: form.type,
    };
    const { error } = editing
      ? await supabase.from("customers").update(payload).eq("id", editing.id)
      : await supabase.from("customers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted"));
    load();
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="lg" className="w-full h-12 text-base" onClick={openNew}>
            <Plus className="mr-2 h-5 w-5" /> {t("add")} {t("customers")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label={t("name")}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 text-base" /></Field>
            <Field label={t("address")}><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-11 text-base" /></Field>
            <Field label={t("gstin")}><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className="h-11 text-base" /></Field>
            <Field label={t("opening_balance")}><Input type="number" inputMode="decimal" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} className="h-11 text-base" /></Field>
            <Field label={t("type")}>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Customer["type"] })}>
                <SelectTrigger className="h-11 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="waste">{t("waste")}</SelectItem>
                  <SelectItem value="finished">{t("finished")}</SelectItem>
                  <SelectItem value="both">{t("both")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={save}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rows.length === 0 ? <Empty /> : rows.map((c) => (
        <div key={c.id} className="rounded-lg border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-base font-semibold">{c.name}</div>
              <div className="text-sm text-muted-foreground">{t(c.type)}</div>
              {c.address && <div className="text-sm">{c.address}</div>}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="outline" onClick={() => openEdit(c)} aria-label={t("edit")}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="destructive" onClick={() => remove(c.id)} aria-label={t("delete")}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------ TRACTORS ------------------ */
function TractorsTab() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Tractor[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tractor | null>(null);
  const [form, setForm] = useState({ number: "", default_empty_weight: "0", driver_name: "" });

  const load = async () => {
    const { data, error } = await supabase.from("tractors").select("*").order("number");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Tractor[]);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ number: "", default_empty_weight: "0", driver_name: "" }); setOpen(true); };
  const openEdit = (x: Tractor) => { setEditing(x); setForm({ number: x.number, default_empty_weight: String(x.default_empty_weight), driver_name: x.driver_name ?? "" }); setOpen(true); };

  const save = async () => {
    if (!form.number.trim()) return toast.error(t("tractor_number"));
    const payload = {
      number: form.number.trim(),
      default_empty_weight: Number(form.default_empty_weight) || 0,
      driver_name: form.driver_name.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("tractors").update(payload).eq("id", editing.id)
      : await supabase.from("tractors").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); setOpen(false); load();
  };
  const remove = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    const { error } = await supabase.from("tractors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted")); load();
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="lg" className="w-full h-12 text-base" onClick={openNew}>
            <Plus className="mr-2 h-5 w-5" /> {t("add")} {t("tractor")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label={t("tractor_number")}><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className="h-11 text-base" /></Field>
            <Field label={t("default_empty_weight")}><Input type="number" inputMode="decimal" value={form.default_empty_weight} onChange={(e) => setForm({ ...form, default_empty_weight: e.target.value })} className="h-11 text-base" /></Field>
            <Field label={t("driver_name")}><Input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} className="h-11 text-base" /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={save}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rows.length === 0 ? <Empty /> : rows.map((x) => (
        <div key={x.id} className="rounded-lg border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-base font-semibold">{x.number}</div>
              {x.driver_name && <div className="text-sm text-muted-foreground">{x.driver_name}</div>}
              <div className="text-sm">{t("default_empty_weight")}: {Number(x.default_empty_weight)}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="outline" onClick={() => openEdit(x)} aria-label={t("edit")}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="destructive" onClick={() => remove(x.id)} aria-label={t("delete")}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------ WORKERS ------------------ */
function WorkersTab() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Worker[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState({ name: "", daily_wage: "0", salary_type: "monthly" as Worker["salary_type"] });

  const load = async () => {
    const { data, error } = await supabase.from("workers").select("*").order("name");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Worker[]);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", daily_wage: "0", salary_type: "monthly" }); setOpen(true); };
  const openEdit = (x: Worker) => { setEditing(x); setForm({ name: x.name, daily_wage: String(x.daily_wage), salary_type: x.salary_type }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error(t("name"));
    const payload = {
      name: form.name.trim(),
      daily_wage: Number(form.daily_wage) || 0,
      salary_type: form.salary_type,
    };
    const { error } = editing
      ? await supabase.from("workers").update(payload).eq("id", editing.id)
      : await supabase.from("workers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); setOpen(false); load();
  };
  const remove = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    const { error } = await supabase.from("workers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted")); load();
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="lg" className="w-full h-12 text-base" onClick={openNew}>
            <Plus className="mr-2 h-5 w-5" /> {t("add")} {t("workers")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label={t("name")}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 text-base" /></Field>
            <Field label={t("daily_wage")}><Input type="number" inputMode="decimal" value={form.daily_wage} onChange={(e) => setForm({ ...form, daily_wage: e.target.value })} className="h-11 text-base" /></Field>
            <Field label={t("salary_type")}>
              <Select value={form.salary_type} onValueChange={(v) => setForm({ ...form, salary_type: v as Worker["salary_type"] })}>
                <SelectTrigger className="h-11 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t("weekly")}</SelectItem>
                  <SelectItem value="monthly">{t("monthly")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={save}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rows.length === 0 ? <Empty /> : rows.map((x) => (
        <div key={x.id} className="rounded-lg border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-base font-semibold">{x.name}</div>
              <div className="text-sm text-muted-foreground">{t(x.salary_type)} · ₹{Number(x.daily_wage)}/day</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="outline" onClick={() => openEdit(x)} aria-label={t("edit")}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="destructive" onClick={() => remove(x.id)} aria-label={t("delete")}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      ))}
    </div>
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

function Empty() {
  const { t } = useI18n();
  return <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">{t("no_records")}</div>;
}
