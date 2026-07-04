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
import { Trash2, Search, Package, Hammer, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sales/")({
  component: SalesIndex,
});

type Row = {
  id: string;
  sale_no: string;
  sale_date: string;
  sale_type: "waste" | "finished";
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  payment_status: string;
  customers: { name: string } | null;
};

function SalesIndex() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [chooser, setChooser] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("sales")
      .select("id,sale_no,sale_date,sale_type,total_amount,paid_amount,outstanding,payment_status,customers(name)")
      .order("sale_date", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    else setRows((data ?? []) as unknown as Row[]);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    await supabase.from("customer_receipts").delete().eq("sale_id", id);
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted")); load();
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.sale_no.toLowerCase().includes(s) ||
      (r.customers?.name ?? "").toLowerCase().includes(s) ||
      r.sale_date.includes(s),
    );
  }, [rows, q]);

  return (
    <AppShell title={t("sales")}>
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
                <div className="text-sm text-muted-foreground">
                  #{r.sale_no} · {r.sale_date} · {r.sale_type === "waste" ? t("waste") : t("finished")}
                </div>
                <div className="text-base font-semibold">{r.customers?.name ?? "—"}</div>
                <div className="mt-1 text-sm">
                  {t("total")}: <strong>₹{Number(r.total_amount).toFixed(2)}</strong> · {t("paid")}: ₹{Number(r.paid_amount).toFixed(2)}
                </div>
                {Number(r.outstanding) > 0 && (
                  <div className="text-sm text-rose-600 font-medium">
                    {t("outstanding")}: ₹{Number(r.outstanding).toFixed(2)}
                  </div>
                )}
              </div>
              <Button size="icon" variant="destructive" onClick={() => remove(r.id)} aria-label={t("delete")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={chooser} onOpenChange={(o) => { if (!o) setChooser(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">{t("what_do_you_want")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setChooser(false); navigate({ to: "/sales/new", search: { type: "waste" } }); }}
              className="flex items-center gap-3 rounded-xl border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-5 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Package className="h-7 w-7" />
              </div>
              <div className="text-lg font-bold">{t("waste_wood_sale")}</div>
            </button>
            <button
              type="button"
              onClick={() => { setChooser(false); navigate({ to: "/sales/new", search: { type: "finished" } }); }}
              className="flex items-center gap-3 rounded-xl border-2 border-amber-600 bg-amber-50 dark:bg-amber-950/30 p-5 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-600 text-white">
                <Hammer className="h-7 w-7" />
              </div>
              <div className="text-lg font-bold">{t("finished_wood_sale")}</div>
            </button>
            <button
              type="button"
              onClick={() => setChooser(false)}
              className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-5 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <Eye className="h-7 w-7" />
              </div>
              <div className="text-lg font-bold">{t("view_sales")}</div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
