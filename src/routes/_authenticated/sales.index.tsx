import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Search } from "lucide-react";
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
  const [rows, setRows] = useState<Row[]>([]);
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

    </AppShell>
  );
}
