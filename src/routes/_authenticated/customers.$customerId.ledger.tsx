import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers/$customerId/ledger")({
  component: CustomerLedger,
  head: () => ({
    meta: [
      { title: "Customer Ledger | Panchal Sawmill ERP" },
      { name: "description", content: "Customer sales, receipts and running outstanding balance." },
      { property: "og:title", content: "Customer Ledger | Panchal Sawmill ERP" },
      { property: "og:description", content: "Customer sales, receipts and running outstanding balance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Customer = {
  id: string; name: string; mobile: string | null; address: string | null;
  gstin: string | null; opening_balance: number;
};
type Sale = {
  id: string; sale_date: string; sale_no: string; sale_type: string;
  total_amount: number; paid_amount: number; outstanding: number;
};
type Receipt = {
  id: string; receipt_date: string; amount: number;
  mode: string; remarks: string | null; bank_account_id: string | null;
};
type Bank = { id: string; name: string };

function CustomerLedger() {
  const { customerId } = Route.useParams();
  const { t } = useI18n();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [c, s, r, bk] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).single(),
        supabase.from("sales").select("id,sale_date,sale_no,sale_type,total_amount,paid_amount,outstanding").eq("customer_id", customerId).order("sale_date"),
        supabase.from("customer_receipts").select("id,receipt_date,amount,mode,remarks,bank_account_id").eq("customer_id", customerId).order("receipt_date"),
        supabase.from("bank_accounts").select("id,name"),
      ]);
      if (c.error) { toast.error(c.error.message); setLoading(false); return; }
      setCustomer(c.data as Customer);
      setSales((s.data ?? []) as Sale[]);
      setReceipts((r.data ?? []) as Receipt[]);
      setBanks((bk.data ?? []) as Bank[]);
      setLoading(false);
    })();
  }, [customerId]);

  const bankName = (id: string | null) => (id ? (banks.find((b) => b.id === id)?.name ?? "—") : t("cash"));

  const opening = Number(customer?.opening_balance) || 0;
  const totalSales = sales.reduce((s, x) => s + Number(x.total_amount), 0);
  const totalReceipts = receipts.reduce((s, x) => s + Number(x.amount), 0);
  const salePaid = sales.reduce((s, x) => s + Number(x.paid_amount), 0);
  const outstanding = opening + totalSales - salePaid - totalReceipts;

  type Hist = { date: string; particulars: string; change: number; balance: number };
  const events: { date: string; particulars: string; change: number }[] = [];
  sales.forEach((x) => {
    events.push({ date: x.sale_date, particulars: `${t("sales")} #${x.sale_no} · ${x.sale_type}`, change: Number(x.total_amount) });
    if (Number(x.paid_amount) > 0) {
      events.push({ date: x.sale_date, particulars: `${t("sales")} #${x.sale_no} · ${t("paid")}`, change: -Number(x.paid_amount) });
    }
  });
  receipts.forEach((x) => events.push({
    date: x.receipt_date,
    particulars: `${t("receipt")} · ${bankName(x.bank_account_id)}${x.remarks ? ` · ${x.remarks}` : ""}`,
    change: -Number(x.amount),
  }));
  events.sort((a, b) => a.date.localeCompare(b.date));
  const history: Hist[] = [{ date: "—", particulars: t("opening_balance"), change: 0, balance: opening }];
  let bal = opening;
  for (const e of events) { bal += e.change; history.push({ ...e, balance: bal }); }

  return (
    <AppShell title={t("customer_ledger")} backTo="/masters">
      {loading ? (
        <div className="p-6 text-center">{t("loading")}</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xl font-bold">{customer?.name}</div>
            {customer?.address && <div className="text-sm text-muted-foreground">{customer.address}</div>}
            {customer?.mobile && <div className="text-sm text-muted-foreground">{customer.mobile}</div>}
            {customer?.gstin && <div className="text-sm text-muted-foreground">GSTIN: {customer.gstin}</div>}
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">{t("outstanding")}</span>
              <span className={`text-xl font-bold ${outstanding > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                ₹{outstanding.toFixed(2)}
              </span>
            </div>
          </div>

          <Tabs defaultValue="sales">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sales">{t("sales")}</TabsTrigger>
              <TabsTrigger value="receipts">{t("receipts")}</TabsTrigger>
              <TabsTrigger value="history">{t("outstanding_history")}</TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="mt-4">
              {sales.length === 0 ? <Empty /> : (
                <TableShell head={[t("date"), t("entry_no"), t("paid"), t("outstanding"), t("total")]}>
                  {sales.map((x) => (
                    <tr key={x.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">{x.sale_date}</td>
                      <td className="p-2 whitespace-nowrap">#{x.sale_no}</td>
                      <td className="p-2 text-right">₹{Number(x.paid_amount).toFixed(2)}</td>
                      <td className="p-2 text-right">₹{Number(x.outstanding).toFixed(2)}</td>
                      <td className="p-2 text-right">₹{Number(x.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted font-medium">
                    <td className="p-2" colSpan={4}>{t("total")}</td>
                    <td className="p-2 text-right">₹{totalSales.toFixed(2)}</td>
                  </tr>
                </TableShell>
              )}
            </TabsContent>

            <TabsContent value="receipts" className="mt-4">
              {receipts.length === 0 ? <Empty /> : (
                <TableShell head={[t("date"), t("payment_mode"), t("remarks"), t("amount")]}>
                  {receipts.map((x) => (
                    <tr key={x.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">{x.receipt_date}</td>
                      <td className="p-2">{bankName(x.bank_account_id)}</td>
                      <td className="p-2">{x.remarks ?? "—"}</td>
                      <td className="p-2 text-right">₹{Number(x.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted font-medium">
                    <td className="p-2" colSpan={3}>{t("total")}</td>
                    <td className="p-2 text-right">₹{totalReceipts.toFixed(2)}</td>
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
      <table className="w-full min-w-[520px] text-sm">
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
