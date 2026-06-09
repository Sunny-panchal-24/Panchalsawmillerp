import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
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
  vendors: { name: string } | null;
};

function PurchasesList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("purchases")
      .select("id,entry_no,entry_date,total_cost,paid_amount,actual_man,cost_per_man,vendors(name)")
      .order("entry_date", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setRows((data ?? []) as unknown as Row[]);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("vendor_payments").delete().eq("purchase_id", id);
    toast.success(t("deleted")); load();
  };

  return (
    <AppShell
      title={t("purchases")}
      action={
        <Button size="lg" className="h-11" onClick={() => navigate({ to: "/purchases/new" })}>
          <Plus className="mr-1 h-5 w-5" /> {t("add")}
        </Button>
      }
    >
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">{t("no_records")}</div>
        ) : rows.map((r) => (
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
              <Button size="icon" variant="destructive" onClick={() => remove(r.id)} aria-label={t("delete")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
