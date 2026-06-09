import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendors/$vendorId/ledger")({
  component: VendorLedger,
});

type Vendor = { id: string; name: string; village: string | null; opening_balance: number };

type LedgerRow = {
  date: string;
  particulars: string;
  debit: number; // payments to vendor (we paid)
  credit: number; // purchases (we owe)
  balance: number;
};

function VendorLedger() {
  const { vendorId } = Route.useParams();
  const { t } = useI18n();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [v, p, pay] = await Promise.all([
        supabase.from("vendors").select("*").eq("id", vendorId).single(),
        supabase.from("purchases").select("id,entry_date,entry_no,total_cost").eq("vendor_id", vendorId),
        supabase.from("vendor_payments").select("id,payment_date,amount,mode,remarks").eq("vendor_id", vendorId),
      ]);
      if (v.error) { toast.error(v.error.message); setLoading(false); return; }
      setVendor(v.data as Vendor);

      const opening = Number(v.data.opening_balance) || 0;
      type Event = { date: string; particulars: string; debit: number; credit: number };
      const events: Event[] = [];
      (p.data ?? []).forEach((x) => events.push({
        date: x.entry_date,
        particulars: `${t("purchase")} #${x.entry_no}`,
        debit: 0,
        credit: Number(x.total_cost),
      }));
      (pay.data ?? []).forEach((x) => events.push({
        date: x.payment_date,
        particulars: `${t("payment")} (${t(x.mode as string)})${x.remarks ? ` · ${x.remarks}` : ""}`,
        debit: Number(x.amount),
        credit: 0,
      }));
      events.sort((a, b) => a.date.localeCompare(b.date));

      // "Vendor owes us": positive = receivable. Payments increase, purchases decrease.
      let bal = opening;
      const out: LedgerRow[] = [
        { date: "—", particulars: t("opening_balance"), debit: 0, credit: 0, balance: bal },
      ];
      for (const e of events) {
        bal = bal + e.debit - e.credit;
        out.push({ ...e, balance: bal });
      }
      setRows(out);
      setLoading(false);
    })();
  }, [vendorId, t]);

  const closing = rows.length ? rows[rows.length - 1].balance : 0;
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <AppShell title={t("vendor_ledger")} backTo="/masters">
      {loading ? (
        <div className="p-6 text-center">{t("loading")}</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xl font-bold">{vendor?.name}</div>
            {vendor?.village && <div className="text-sm text-muted-foreground">{vendor.village}</div>}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("balance")}</span>
              <span className={`text-xl font-bold ${closing >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                ₹{closing.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">{t("date")}</th>
                  <th className="p-2 text-left">{t("particulars")}</th>
                  <th className="p-2 text-right">{t("debit")}</th>
                  <th className="p-2 text-right">{t("credit")}</th>
                  <th className="p-2 text-right">{t("balance")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 whitespace-nowrap">{r.date}</td>
                    <td className="p-2">{r.particulars}</td>
                    <td className="p-2 text-right">{r.debit ? r.debit.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{r.credit ? r.credit.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right font-medium">{r.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted font-medium">
                <tr>
                  <td className="p-2" colSpan={2}>{t("total")}</td>
                  <td className="p-2 text-right">{totalDebit.toFixed(2)}</td>
                  <td className="p-2 text-right">{totalCredit.toFixed(2)}</td>
                  <td className="p-2 text-right">{closing.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
