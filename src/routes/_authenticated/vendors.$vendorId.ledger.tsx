import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendors/$vendorId/ledger")({
  component: VendorLedger,
});

type Vendor = {
  id: string; name: string; village: string | null; mobile: string | null;
  opening_balance: number; opening_advance: number;
};
type Purchase = { id: string; entry_date: string; entry_no: string; total_cost: number };
type Payment = {
  id: string; payment_date: string; amount: number;
  mode: string; remarks: string | null; bank_account_id: string | null;
  purchase_id: string | null;
};
type Advance = {
  id: string; advance_date: string; amount: number;
  bank_account_id: string | null; remarks: string | null;
};
type Bank = { id: string; name: string };

function VendorLedger() {
  const { vendorId } = Route.useParams();
  const { t } = useI18n();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [v, p, pay, adv, bk] = await Promise.all([
        supabase.from("vendors").select("*").eq("id", vendorId).single(),
        supabase.from("purchases").select("id,entry_date,entry_no,total_cost").eq("vendor_id", vendorId).order("entry_date"),
        supabase.from("vendor_payments").select("id,payment_date,amount,mode,remarks,bank_account_id,purchase_id").eq("vendor_id", vendorId).order("payment_date"),
        supabase.from("vendor_advances").select("id,advance_date,amount,bank_account_id,remarks").eq("vendor_id", vendorId).order("advance_date"),
        supabase.from("bank_accounts").select("id,name"),
      ]);
      if (v.error) { toast.error(v.error.message); setLoading(false); return; }
      setVendor(v.data as Vendor);
      setPurchases((p.data ?? []) as Purchase[]);
      setPayments((pay.data ?? []) as Payment[]);
      setAdvances((adv.data ?? []) as Advance[]);
      setBanks((bk.data ?? []) as Bank[]);
      setLoading(false);
    })();
  }, [vendorId]);

  const bankName = (id: string | null) => id ? (banks.find((b) => b.id === id)?.name ?? "—") : t("cash");

  const opening = (Number(vendor?.opening_balance) || 0) - (Number(vendor?.opening_advance) || 0);
  const totalPurchases = purchases.reduce((s, x) => s + Number(x.total_cost), 0);
  const totalPayments = payments.reduce((s, x) => s + Number(x.amount), 0);
  const totalAdvances = advances.reduce((s, x) => s + Number(x.amount), 0);
  // outstanding = opening + purchases - (payments + advances)
  const outstanding = opening + totalPurchases - totalPayments - totalAdvances;

  // Outstanding history (running)
  type Hist = { date: string; particulars: string; change: number; balance: number };
  const events: { date: string; particulars: string; change: number }[] = [];
  purchases.forEach((x) => events.push({ date: x.entry_date, particulars: `${t("purchase")} #${x.entry_no}`, change: Number(x.total_cost) }));
  payments.forEach((x) => events.push({ date: x.payment_date, particulars: `${t("payment")} · ${bankName(x.bank_account_id)}${x.remarks ? ` · ${x.remarks}` : ""}`, change: -Number(x.amount) }));
  advances.forEach((x) => events.push({ date: x.advance_date, particulars: `${t("advance")} · ${bankName(x.bank_account_id)}${x.remarks ? ` · ${x.remarks}` : ""}`, change: -Number(x.amount) }));
  events.sort((a, b) => a.date.localeCompare(b.date));
  const history: Hist[] = [{ date: "—", particulars: t("opening_outstanding"), change: 0, balance: opening }];
  let bal = opening;
  for (const e of events) { bal += e.change; history.push({ ...e, balance: bal }); }

  return (
    <AppShell title={t("vendor_ledger")} backTo="/masters">
      {loading ? (
        <div className="p-6 text-center">{t("loading")}</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xl font-bold">{vendor?.name}</div>
            {vendor?.village && <div className="text-sm text-muted-foreground">{vendor.village}</div>}
            {vendor?.mobile && <div className="text-sm text-muted-foreground">{vendor.mobile}</div>}
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">{t("outstanding")}</span>
              <span className={`text-xl font-bold ${outstanding > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                ₹{outstanding.toFixed(2)}
              </span>
            </div>
          </div>

          <Tabs defaultValue="purchases">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="purchases">{t("purchases")}</TabsTrigger>
              <TabsTrigger value="payments">{t("payments")}</TabsTrigger>
              <TabsTrigger value="advances">{t("advances")}</TabsTrigger>
              <TabsTrigger value="history">{t("outstanding_history")}</TabsTrigger>
            </TabsList>

            <TabsContent value="purchases" className="mt-4">
              {purchases.length === 0 ? <Empty /> : (
                <TableShell head={[t("date"), t("entry_no"), t("total_cost")]}>
                  {purchases.map((x) => (
                    <tr key={x.id} className="border-t">
                      <td className="p-2">{x.entry_date}</td>
                      <td className="p-2">#{x.entry_no}</td>
                      <td className="p-2 text-right">₹{Number(x.total_cost).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted font-medium">
                    <td className="p-2" colSpan={2}>{t("total")}</td>
                    <td className="p-2 text-right">₹{totalPurchases.toFixed(2)}</td>
                  </tr>
                </TableShell>
              )}
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              {payments.length === 0 ? <Empty /> : (
                <TableShell head={[t("date"), t("payment_mode"), t("remarks"), t("amount")]}>
                  {payments.map((x) => (
                    <tr key={x.id} className="border-t">
                      <td className="p-2">{x.payment_date}</td>
                      <td className="p-2">{bankName(x.bank_account_id)}</td>
                      <td className="p-2">{x.remarks ?? "—"}</td>
                      <td className="p-2 text-right">₹{Number(x.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted font-medium">
                    <td className="p-2" colSpan={3}>{t("total")}</td>
                    <td className="p-2 text-right">₹{totalPayments.toFixed(2)}</td>
                  </tr>
                </TableShell>
              )}
            </TabsContent>

            <TabsContent value="advances" className="mt-4">
              {advances.length === 0 ? <Empty /> : (
                <TableShell head={[t("date"), t("payment_mode"), t("remarks"), t("amount")]}>
                  {advances.map((x) => (
                    <tr key={x.id} className="border-t">
                      <td className="p-2">{x.advance_date}</td>
                      <td className="p-2">{bankName(x.bank_account_id)}</td>
                      <td className="p-2">{x.remarks ?? "—"}</td>
                      <td className="p-2 text-right">₹{Number(x.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted font-medium">
                    <td className="p-2" colSpan={3}>{t("total")}</td>
                    <td className="p-2 text-right">₹{totalAdvances.toFixed(2)}</td>
                  </tr>
                </TableShell>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <TableShell head={[t("date"), t("particulars"), t("change"), t("balance")]}>
                {history.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 whitespace-nowrap">{r.date}</td>
                    <td className="p-2">{r.particulars}</td>
                    <td className={`p-2 text-right ${r.change > 0 ? "text-rose-600" : r.change < 0 ? "text-emerald-600" : ""}`}>
                      {r.change === 0 ? "—" : (r.change > 0 ? "+" : "") + r.change.toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-medium">{r.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </TableShell>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppShell>
  );
}

function TableShell({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[500px] text-sm">
        <thead className="bg-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={`p-2 whitespace-nowrap ${i === head.length - 1 ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Empty() {
  const { t } = useI18n();
  return <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">{t("no_records")}</div>;
}
