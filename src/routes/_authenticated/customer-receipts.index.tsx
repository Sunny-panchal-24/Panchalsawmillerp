import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customer-receipts/")({
  component: CustomerReceiptsIndex,
});

type Row = { id: string; name: string; mobile: string | null; outstanding: number };

function CustomerReceiptsIndex() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: cust }, { data: sales }, { data: recs }] = await Promise.all([
        supabase.from("customers").select("id,name,mobile,opening_balance").order("name"),
        supabase.from("sales").select("customer_id,outstanding"),
        supabase.from("customer_receipts").select("customer_id,amount,sale_id"),
      ]);
      const so = new Map<string, number>();
      (sales ?? []).forEach((r) => so.set(r.customer_id!, (so.get(r.customer_id!) ?? 0) + Number(r.outstanding ?? 0)));
      const gp = new Map<string, number>();
      (recs ?? []).forEach((r) => {
        if (!r.sale_id) gp.set(r.customer_id!, (gp.get(r.customer_id!) ?? 0) + Number(r.amount));
      });
      const list: Row[] = (cust ?? []).map((c) => ({
        id: c.id, name: c.name, mobile: c.mobile,
        outstanding: Number(c.opening_balance ?? 0) + (so.get(c.id) ?? 0) - (gp.get(c.id) ?? 0),
      }));
      setRows(list);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.mobile ?? "").includes(q));
  }, [rows, search]);

  return (
    <AppShell
      title={t("customer_receipts")}
      action={
        <Button size="sm" onClick={() => navigate({ to: "/customer-receipts/new" })}>
          <Plus className="h-4 w-4 mr-1" /> {t("new")}
        </Button>
      }
    >
      <div className="mb-3 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="h-12 pl-9" placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {loading ? (
        <p className="text-center text-muted-foreground">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground">{t("no_records")}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  {r.mobile && <div className="text-xs text-muted-foreground">{r.mobile}</div>}
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">{t("outstanding")}</div>
                  <div className="font-bold text-rose-700">₹{r.outstanding.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
