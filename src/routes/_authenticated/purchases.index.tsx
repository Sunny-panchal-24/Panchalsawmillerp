import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Search, ShoppingCart, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchases/")({
  component: PurchasesList,
});

type Row = {
  id: string;
  entry_no: string;
  entry_date: string;
  total_cost: number;
  paid_amount: number;
  actual_man: number;
  cost_per_man: number;
  vendor_payable: number;
  tractor_payable: number;
  vendors: { name: string } | null;
};

function PurchasesList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [chooser, setChooser] = useState(true);
  const [mode, setMode] = useState<"list" | "none">("none");
  const [q, setQ] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("purchases")
      .select("id,entry_no,entry_date,total_cost,paid_amount,actual_man,cost_per_man,vendor_payable,tractor_payable,vendors(name)")
      .order("entry_date", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    else setRows((data ?? []) as unknown as Row[]);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    await supabase.from("vendor_payments").delete().eq("purchase_id", id);
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted")); load();
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.entry_no.toLowerCase().includes(s) ||
      (r.vendors?.name ?? "").toLowerCase().includes(s) ||
      r.entry_date.includes(s),
    );
  }, [rows, q]);

  return (
    <AppShell
      title={t("purchases")}
      action={
        <Button size="lg" className="h-11" onClick={() => navigate({ to: "/purchases/new" })}>
          <Plus className="mr-1 h-5 w-5" /> {t("add")}
        </Button>
      }
    >
      {mode === "list" && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} className="h-12 pl-9 text-base" />
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">{t("no_records")}</div>
          ) : filtered.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">#{r.entry_no} · {r.entry_date}</div>
                  <div className="text-base font-semibold">{r.vendors?.name ?? "—"}</div>
                  <div className="mt-1 text-sm">
                    {Number(r.actual_man).toFixed(2)} {t("net_man")} · ₹{Number(r.cost_per_man).toFixed(2)}/{t("net_man")}
                  </div>
                  <div className="text-sm">
                    {t("total")}: <strong>₹{Number(r.total_cost).toFixed(2)}</strong> · {t("payment")}: ₹{Number(r.paid_amount).toFixed(2)}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="icon" variant="outline" onClick={() => navigate({ to: "/purchases/new", search: { id: r.id } })} aria-label={t("edit")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => remove(r.id)} aria-label={t("delete")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={chooser} onOpenChange={(o) => { if (!o) { setChooser(false); setMode("list"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">{t("what_do_you_want")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setChooser(false); navigate({ to: "/purchases/new" }); }}
              className="flex items-center gap-3 rounded-xl border-2 border-primary bg-primary/10 p-5 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ShoppingCart className="h-7 w-7" />
              </div>
              <div>
                <div className="text-lg font-bold">{t("new_purchase")}</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setChooser(false); setMode("list"); }}
              className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-5 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <Eye className="h-7 w-7" />
              </div>
              <div>
                <div className="text-lg font-bold">{t("view_purchases")}</div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
