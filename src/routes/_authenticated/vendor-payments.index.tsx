import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendor-payments/")({
  component: VendorPaymentsIndex,
});

type Row = {
  id: string; name: string; village: string | null;
  outstanding: number; advance: number;
};

function VendorPaymentsIndex() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: vendors }, { data: purchases }, { data: payments }, { data: advances }] = await Promise.all([
        supabase.from("vendors").select("id,name,village,opening_balance,opening_advance").order("name"),
        supabase.from("purchases").select("vendor_id,vendor_payable,advance_deducted"),
        supabase.from("vendor_payments").select("vendor_id,amount"),
        supabase.from("vendor_advances").select("vendor_id,amount"),
      ]);
      const p = new Map<string, number>();
      (purchases ?? []).forEach((r) => p.set(r.vendor_id!, (p.get(r.vendor_id!) ?? 0) + Number(r.vendor_payable ?? 0)));
      const dedByVendor = new Map<string, number>();
      (purchases ?? []).forEach((r) => dedByVendor.set(r.vendor_id!, (dedByVendor.get(r.vendor_id!) ?? 0) + Number(r.advance_deducted ?? 0)));
      const pd = new Map<string, number>();
      (payments ?? []).forEach((r) => pd.set(r.vendor_id!, (pd.get(r.vendor_id!) ?? 0) + Number(r.amount)));
      const av = new Map<string, number>();
      (advances ?? []).forEach((r) => av.set(r.vendor_id!, (av.get(r.vendor_id!) ?? 0) + Number(r.amount)));

      const list: Row[] = (vendors ?? []).map((v) => {
        const purchTotal = p.get(v.id) ?? 0;
        const paid = pd.get(v.id) ?? 0;
        const outstanding = Number(v.opening_balance ?? 0) + purchTotal - paid;
        const advTotal = Number(v.opening_advance ?? 0) + (av.get(v.id) ?? 0) - (dedByVendor.get(v.id) ?? 0);
        return { id: v.id, name: v.name, village: v.village, outstanding, advance: Math.max(0, advTotal) };
      });
      setRows(list);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.village ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <AppShell
      title={t("vendor_payments")}
      action={
        <Button size="sm" onClick={() => navigate({ to: "/vendor-payments/new" })}>
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
                <div className="min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  {r.village && <div className="text-xs text-muted-foreground">{r.village}</div>}
                </div>
                <Link to="/vendors/$vendorId/ledger" params={{ vendorId: r.id }}>
                  <Button size="sm" variant="outline"><BookOpen className="h-4 w-4 mr-1" /> {t("view_ledger")}</Button>
                </Link>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-rose-50 p-2">
                  <div className="text-xs text-muted-foreground">{t("outstanding")}</div>
                  <div className="font-bold text-rose-700">₹{r.outstanding.toFixed(2)}</div>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2">
                  <div className="text-xs text-muted-foreground">{t("advance")}</div>
                  <div className="font-bold text-emerald-700">₹{r.advance.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
