import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, BarChart3, TrendingUp, Wallet, Landmark, ShoppingCart, Receipt, Users, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { TxnLedger } from "@/components/TxnLedger";
import { EditRecordDialog, type EditField } from "@/components/EditRecordDialog";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsPage,
});

const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

type Row = Record<string, any>;

function ReportsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayISO());
  const [tab, setTab] = useState("financial");

  // Data sets
  const [purchases, setPurchases] = useState<Row[]>([]);
  const [sales, setSales] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [vendorPayments, setVendorPayments] = useState<Row[]>([]);
  const [vendorAdvances, setVendorAdvances] = useState<Row[]>([]);
  const [expenses, setExpenses] = useState<Row[]>([]);
  const [workerAdvances, setWorkerAdvances] = useState<Row[]>([]);
  const [workerSalaries, setWorkerSalaries] = useState<Row[]>([]);
  const [vendors, setVendors] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [workers, setWorkers] = useState<Row[]>([]);
  const [banks, setBanks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, s, r, vp, va, ex, wa, ws, vs, cs, ws2, ba] = await Promise.all([
        supabase.from("purchases").select("*").gte("entry_date", from).lte("entry_date", to),
        supabase.from("sales").select("*").gte("sale_date", from).lte("sale_date", to),
        supabase.from("customer_receipts").select("*").gte("receipt_date", from).lte("receipt_date", to),
        supabase.from("vendor_payments").select("*").gte("payment_date", from).lte("payment_date", to),
        supabase.from("vendor_advances").select("*").gte("advance_date", from).lte("advance_date", to),
        supabase.from("expenses").select("*").gte("expense_date", from).lte("expense_date", to),
        supabase.from("worker_advances").select("*").gte("advance_date", from).lte("advance_date", to),
        supabase.from("worker_salaries").select("*"),
        supabase.from("vendors").select("id, name, village, opening_balance, opening_advance"),
        supabase.from("customers").select("id, name, opening_balance"),
        supabase.from("workers").select("id, name, opening_advance, is_active"),
        supabase.from("bank_accounts").select("id, name, opening_balance"),
      ]);
      setPurchases(p.data ?? []);
      setSales(s.data ?? []);
      setReceipts(r.data ?? []);
      setVendorPayments(vp.data ?? []);
      setVendorAdvances(va.data ?? []);
      setExpenses(ex.data ?? []);
      setWorkerAdvances(wa.data ?? []);
      setWorkerSalaries(ws.data ?? []);
      setVendors(vs.data ?? []);
      setCustomers(cs.data ?? []);
      setWorkers(ws2.data ?? []);
      setBanks(ba.data ?? []);
    } catch {
      toast.error(t("error") || "Error");
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [from, to]);

  // ===== Financials =====
  const totals = useMemo(() => {
    const income = sales.reduce((a, x) => a + Number(x.total_amount || 0), 0);
    const received = receipts.reduce((a, x) => a + Number(x.amount || 0), 0);
    const purchaseCost = purchases.reduce((a, x) => a + Number(x.total_cost || 0), 0);
    const expTotal = expenses.reduce((a, x) => a + Number(x.amount || 0), 0);
    const salaryTotal = workerSalaries
      .filter((x) => x.period_end >= from && x.period_end <= to)
      .reduce((a, x) => a + Number(x.gross_salary || 0), 0);
    const vpTotal = vendorPayments.reduce((a, x) => a + Number(x.amount || 0), 0);
    const profit = income - purchaseCost - expTotal - salaryTotal;
    return { income, received, purchaseCost, expTotal, salaryTotal, vpTotal, profit };
  }, [sales, receipts, purchases, expenses, workerSalaries, vendorPayments, from, to]);

  // Daily profit
  const dailyProfit = useMemo(() => {
    const map = new Map<string, { income: number; cost: number; expense: number }>();
    const bump = (d: string, key: "income" | "cost" | "expense", v: number) => {
      const e = map.get(d) || { income: 0, cost: 0, expense: 0 };
      e[key] += v; map.set(d, e);
    };
    sales.forEach((x) => bump(x.sale_date, "income", Number(x.total_amount || 0)));
    purchases.forEach((x) => bump(x.entry_date, "cost", Number(x.total_cost || 0)));
    expenses.forEach((x) => bump(x.expense_date, "expense", Number(x.amount || 0)));
    return [...map.entries()].sort().map(([date, v]) => ({ date, ...v, profit: v.income - v.cost - v.expense }));
  }, [sales, purchases, expenses]);

  // Monthly profit
  const monthlyProfit = useMemo(() => {
    const map = new Map<string, { income: number; cost: number; expense: number }>();
    const bump = (d: string, key: "income" | "cost" | "expense", v: number) => {
      const m = d.slice(0, 7);
      const e = map.get(m) || { income: 0, cost: 0, expense: 0 };
      e[key] += v; map.set(m, e);
    };
    sales.forEach((x) => bump(x.sale_date, "income", Number(x.total_amount || 0)));
    purchases.forEach((x) => bump(x.entry_date, "cost", Number(x.total_cost || 0)));
    expenses.forEach((x) => bump(x.expense_date, "expense", Number(x.amount || 0)));
    return [...map.entries()].sort().map(([month, v]) => ({ month, ...v, profit: v.income - v.cost - v.expense }));
  }, [sales, purchases, expenses]);

  // Cash flow
  const cashFlow = useMemo(() => {
    const inflow = receipts.filter((x) => x.mode === "cash").reduce((a, x) => a + Number(x.amount || 0), 0)
      + sales.filter((x) => x.payment_mode === "cash").reduce((a, x) => a + Number(x.paid_amount || 0), 0);
    const outflow = vendorPayments.filter((x) => x.mode === "cash").reduce((a, x) => a + Number(x.amount || 0), 0)
      + purchases.filter((x) => x.paid_mode === "cash").reduce((a, x) => a + Number(x.paid_amount || 0), 0)
      + purchases.filter((x) => x.tractor_paid_mode === "cash").reduce((a, x) => a + Number(x.tractor_paid_amount || 0), 0)
      + expenses.filter((x) => x.payment_mode === "cash").reduce((a, x) => a + Number(x.amount || 0), 0)
      + workerAdvances.filter((x) => x.payment_mode === "cash").reduce((a, x) => a + Number(x.amount || 0), 0)
      + vendorAdvances.filter((x) => !x.bank_account_id).reduce((a, x) => a + Number(x.amount || 0), 0)
      + workerSalaries.filter((x) => x.payment_mode === "cash" && x.period_end >= from && x.period_end <= to).reduce((a, x) => a + Number(x.paid_amount || 0), 0);
    return { inflow, outflow, net: inflow - outflow };
  }, [receipts, sales, vendorPayments, purchases, expenses, workerAdvances, vendorAdvances, workerSalaries, from, to]);

  // Bank flow per account
  const bankFlow = useMemo(() => {
    return banks.map((b) => {
      const inflow = receipts.filter((x) => x.bank_account_id === b.id).reduce((a, x) => a + Number(x.amount || 0), 0)
        + sales.filter((x) => x.bank_account_id === b.id).reduce((a, x) => a + Number(x.paid_amount || 0), 0);
      const outflow = vendorPayments.filter((x) => x.bank_account_id === b.id).reduce((a, x) => a + Number(x.amount || 0), 0)
        + purchases.filter((x) => x.bank_account_id === b.id).reduce((a, x) => a + Number(x.paid_amount || 0), 0)
        + purchases.filter((x) => x.tractor_bank_account_id === b.id).reduce((a, x) => a + Number(x.tractor_paid_amount || 0), 0)
        + expenses.filter((x) => x.bank_account_id === b.id).reduce((a, x) => a + Number(x.amount || 0), 0)
        + vendorAdvances.filter((x) => x.bank_account_id === b.id).reduce((a, x) => a + Number(x.amount || 0), 0)
        + workerAdvances.filter((x) => x.bank_account_id === b.id).reduce((a, x) => a + Number(x.amount || 0), 0)
        + workerSalaries.filter((x) => x.bank_account_id === b.id && x.period_end >= from && x.period_end <= to).reduce((a, x) => a + Number(x.paid_amount || 0), 0);
      return { id: b.id, name: b.name, inflow, outflow, net: inflow - outflow };
    });
  }, [banks, receipts, sales, vendorPayments, purchases, expenses, vendorAdvances, workerAdvances, workerSalaries, from, to]);

  // Purchase: vendor wise
  const purchaseByVendor = useMemo(() => {
    const map = new Map<string, { qty: number; amount: number }>();
    purchases.forEach((p) => {
      const e = map.get(p.vendor_id) || { qty: 0, amount: 0 };
      e.qty += Number(p.net_man || 0); e.amount += Number(p.total_cost || 0);
      map.set(p.vendor_id, e);
    });
    return [...map.entries()].map(([id, v]) => ({
      name: vendors.find((x) => x.id === id)?.name || "—",
      ...v,
    })).sort((a, b) => b.amount - a.amount);
  }, [purchases, vendors]);

  // Purchase: village wise
  const purchaseByVillage = useMemo(() => {
    const map = new Map<string, { qty: number; amount: number }>();
    purchases.forEach((p) => {
      const v = vendors.find((x) => x.id === p.vendor_id);
      const key = v?.village || "—";
      const e = map.get(key) || { qty: 0, amount: 0 };
      e.qty += Number(p.net_man || 0); e.amount += Number(p.total_cost || 0);
      map.set(key, e);
    });
    return [...map.entries()].map(([village, v]) => ({ village, ...v })).sort((a, b) => b.amount - a.amount);
  }, [purchases, vendors]);

  // Purchase: date wise
  const purchaseByDate = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    purchases.forEach((p) => {
      const e = map.get(p.entry_date) || { count: 0, amount: 0 };
      e.count += 1; e.amount += Number(p.total_cost || 0);
      map.set(p.entry_date, e);
    });
    return [...map.entries()].sort().map(([date, v]) => ({ date, ...v }));
  }, [purchases]);

  // Sales: customer wise
  const salesByCustomer = useMemo(() => {
    const map = new Map<string, { amount: number; outstanding: number }>();
    sales.forEach((s) => {
      const e = map.get(s.customer_id) || { amount: 0, outstanding: 0 };
      e.amount += Number(s.total_amount || 0);
      e.outstanding += Number(s.outstanding || 0);
      map.set(s.customer_id, e);
    });
    return [...map.entries()].map(([id, v]) => ({
      name: customers.find((x) => x.id === id)?.name || "—",
      ...v,
    })).sort((a, b) => b.amount - a.amount);
  }, [sales, customers]);

  // Sales: product wise
  const salesByProduct = useMemo(() => {
    const map = new Map<string, { count: number; amount: number; qty: number }>();
    sales.forEach((s) => {
      const key = s.sale_type || "—";
      const e = map.get(key) || { count: 0, amount: 0, qty: 0 };
      e.count += 1;
      e.amount += Number(s.total_amount || 0);
      e.qty += Number(s.sale_type === "finished" ? s.cft || 0 : s.net_weight || 0);
      map.set(key, e);
    });
    return [...map.entries()].map(([k, v]) => ({ product: k, ...v }));
  }, [sales]);

  // Worker reports
  const workerAttendance = useMemo(() => {
    const map = new Map<string, number>();
    workerSalaries
      .filter((x) => x.period_end >= from && x.period_end <= to)
      .forEach((x) => map.set(x.worker_id, (map.get(x.worker_id) || 0) + Number(x.present_days || 0)));
    return workers.map((w) => ({ name: w.name, days: map.get(w.id) || 0 })).filter((x) => x.days > 0);
  }, [workerSalaries, workers, from, to]);

  const workerSalaryRpt = useMemo(() => {
    const map = new Map<string, { gross: number; paid: number; outstanding: number }>();
    workerSalaries
      .filter((x) => x.period_end >= from && x.period_end <= to)
      .forEach((x) => {
        const e = map.get(x.worker_id) || { gross: 0, paid: 0, outstanding: 0 };
        e.gross += Number(x.gross_salary || 0);
        e.paid += Number(x.paid_amount || 0);
        e.outstanding += Number(x.outstanding || 0);
        map.set(x.worker_id, e);
      });
    return [...map.entries()].map(([id, v]) => ({
      name: workers.find((w) => w.id === id)?.name || "—", ...v,
    }));
  }, [workerSalaries, workers, from, to]);

  const workerAdvanceRpt = useMemo(() => {
    const map = new Map<string, number>();
    workerAdvances.forEach((a) => map.set(a.worker_id, (map.get(a.worker_id) || 0) + Number(a.amount || 0)));
    return [...map.entries()].map(([id, amt]) => ({
      name: workers.find((w) => w.id === id)?.name || "—", amount: amt,
    })).sort((a, b) => b.amount - a.amount);
  }, [workerAdvances, workers]);

  // Outstanding (all-time)
  const [outVendors, setOutVendors] = useState<Row[]>([]);
  const [outCustomers, setOutCustomers] = useState<Row[]>([]);
  const [outWorkers, setOutWorkers] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const [ap, avp, ava, as, ar, aws, awa] = await Promise.all([
        supabase.from("purchases").select("vendor_id, vendor_payable, paid_amount"),
        supabase.from("vendor_payments").select("vendor_id, amount"),
        supabase.from("vendor_advances").select("vendor_id, amount"),
        supabase.from("sales").select("customer_id, outstanding"),
        supabase.from("customer_receipts").select("customer_id, amount, sale_id"),
        supabase.from("worker_salaries").select("worker_id, outstanding"),
        supabase.from("worker_advances").select("worker_id, amount"),
      ]);
      const vMap = new Map<string, number>();
      (ap.data ?? []).forEach((p: Row) => {
        vMap.set(p.vendor_id, (vMap.get(p.vendor_id) || 0) + Number(p.vendor_payable || 0) - Number(p.paid_amount || 0));
      });
      (avp.data ?? []).forEach((p: Row) => vMap.set(p.vendor_id, (vMap.get(p.vendor_id) || 0) - Number(p.amount || 0)));
      vendors.forEach((v) => vMap.set(v.id, (vMap.get(v.id) || 0) + Number(v.opening_balance || 0)));
      setOutVendors(vendors.map((v) => ({ name: v.name, balance: vMap.get(v.id) || 0 })).filter((x) => Math.abs(x.balance) > 0.01));

      const cMap = new Map<string, number>();
      (as.data ?? []).forEach((s: Row) => cMap.set(s.customer_id, (cMap.get(s.customer_id) || 0) + Number(s.outstanding || 0)));
      customers.forEach((c) => cMap.set(c.id, (cMap.get(c.id) || 0) + Number(c.opening_balance || 0)));
      setOutCustomers(customers.map((c) => ({ name: c.name, balance: cMap.get(c.id) || 0 })).filter((x) => Math.abs(x.balance) > 0.01));

      const wMap = new Map<string, number>();
      (aws.data ?? []).forEach((s: Row) => wMap.set(s.worker_id, (wMap.get(s.worker_id) || 0) + Number(s.outstanding || 0)));
      (awa.data ?? []).forEach((a: Row) => wMap.set(a.worker_id, (wMap.get(a.worker_id) || 0) - Number(a.amount || 0)));
      workers.forEach((w) => wMap.set(w.id, (wMap.get(w.id) || 0) - Number(w.opening_advance || 0)));
      setOutWorkers(workers.map((w) => ({ name: w.name, balance: wMap.get(w.id) || 0 })).filter((x) => Math.abs(x.balance) > 0.01));
    })();
  }, [vendors, customers, workers]);

  const SectionTitle = ({ icon: Icon, title }: { icon: typeof BarChart3; title: string }) => (
    <div className="flex items-center gap-2 mt-4 mb-2">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="font-semibold text-base">{title}</h3>
    </div>
  );

  const Table = ({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) => (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>{headers.map((h) => <th key={h} className="text-left p-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="p-4 text-center text-muted-foreground">{t("no_records") || "No data"}</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="p-2">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </Card>
  );

  const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color || ""}`}>{value}</p>
    </Card>
  );

  // ===== Transaction ledgers: edit / delete =====
  const [editState, setEditState] = useState<{ table: string; row: Row; fields: EditField[]; title: string } | null>(null);

  const removeRow = async (table: string, id: string, cleanup?: () => Promise<void>) => {
    if (!confirm(t("confirm_delete") || "Delete this entry?")) return;
    if (cleanup) await cleanup();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(table as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted") || "Deleted");
    fetchAll();
  };

  const nameOf = (list: Row[], id: string) => list.find((x) => x.id === id)?.name || "—";

  const salesLedger = useMemo(
    () => [...sales].sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1)).map((s) => ({
      id: s.id,
      date: s.sale_date,
      title: `#${s.sale_no} · ${nameOf(customers, s.customer_id)}`,
      subtitle: `${s.sale_type} · ${t("paid")}: ₹${Number(s.paid_amount || 0).toFixed(0)}${Number(s.outstanding || 0) > 0 ? ` · ${t("outstanding")}: ₹${Number(s.outstanding).toFixed(0)}` : ""}`,
      amount: Number(s.total_amount || 0),
      tone: "in" as const,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sales, customers],
  );

  const purchaseLedger = useMemo(
    () => [...purchases].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)).map((p) => ({
      id: p.id,
      date: p.entry_date,
      title: `#${p.entry_no} · ${nameOf(vendors, p.vendor_id)}`,
      subtitle: `${Number(p.actual_man || 0).toFixed(2)} Man · ₹${Number(p.cost_per_man || 0).toFixed(2)}/Man`,
      amount: Number(p.total_cost || 0),
      tone: "out" as const,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purchases, vendors],
  );

  const salaryLedger = useMemo(
    () => workerSalaries
      .filter((x) => x.period_end >= from && x.period_end <= to)
      .map((s) => ({
        id: s.id,
        date: s.period_end || s.period_label,
        title: nameOf(workers, s.worker_id),
        subtitle: `${s.period_label} · ${t("paid")}: ₹${Number(s.paid_amount || 0).toFixed(0)}`,
        amount: Number(s.net_payable || 0),
        tone: "out" as const,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workerSalaries, workers, from, to],
  );

  const advanceLedger = useMemo(
    () => workerAdvances.map((a) => ({
      id: a.id,
      date: a.advance_date,
      title: nameOf(workers, a.worker_id),
      subtitle: a.notes || a.payment_mode,
      amount: Number(a.amount || 0),
      tone: "out" as const,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workerAdvances, workers],
  );

  const expenseLedger = useMemo(
    () => expenses.map((e) => ({
      id: e.id,
      date: e.expense_date,
      title: e.expense_type,
      subtitle: e.description || e.payment_mode,
      amount: Number(e.amount || 0),
      tone: "out" as const,
    })),
    [expenses],
  );

  const receiptLedger = useMemo(
    () => receipts.map((r) => ({
      id: r.id,
      date: r.receipt_date,
      title: nameOf(customers, r.customer_id),
      subtitle: r.remarks || r.mode,
      amount: Number(r.amount || 0),
      tone: "in" as const,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [receipts, customers],
  );

  const vendorPaymentLedger = useMemo(
    () => vendorPayments.map((p) => ({
      id: p.id,
      date: p.payment_date,
      title: nameOf(vendors, p.vendor_id),
      subtitle: p.remarks || p.mode,
      amount: Number(p.amount || 0),
      tone: "out" as const,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendorPayments, vendors],
  );

  const openEdit = (table: string, list: Row[], id: string, fields: EditField[], title: string) => {
    const row = list.find((x) => x.id === id);
    if (row) setEditState({ table, row, fields, title });
  };


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Button variant="secondary" size="icon" className="h-10 w-10" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">{t("reports")}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4 space-y-4">
        <Card className="p-3 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="financial">💰</TabsTrigger>
            <TabsTrigger value="purchase">🛒</TabsTrigger>
            <TabsTrigger value="sales">📦</TabsTrigger>
            <TabsTrigger value="worker">👷</TabsTrigger>
            <TabsTrigger value="outstanding">⚠️</TabsTrigger>
          </TabsList>

          <TabsContent value="financial" className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Total Income (Sales)" value={fmt(totals.income)} color="text-emerald-600" />
              <Stat label="Total Purchase Cost" value={fmt(totals.purchaseCost)} color="text-rose-600" />
              <Stat label="Expenses" value={fmt(totals.expTotal)} color="text-orange-600" />
              <Stat label="Salaries" value={fmt(totals.salaryTotal)} color="text-orange-600" />
              <Stat label="Net Profit" value={fmt(totals.profit)} color={totals.profit >= 0 ? "text-emerald-700" : "text-rose-700"} />
              <Stat label="Receipts In" value={fmt(totals.received)} color="text-blue-600" />
            </div>

            <SectionTitle icon={TrendingUp} title="Daily Profit / Loss" />
            <Card className="p-3">
              {dailyProfit.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyProfit}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="profit">
                      {dailyProfit.map((d, i) => (
                        <Cell key={i} fill={d.profit >= 0 ? "#10b981" : "#e11d48"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
            <Table headers={["Date", "Income", "Cost", "Expense", "Profit"]}
              rows={dailyProfit.map((d) => [d.date, fmt(d.income), fmt(d.cost), fmt(d.expense), fmt(d.profit)])} />

            <SectionTitle icon={BarChart3} title="Monthly Profit / Loss" />
            <Card className="p-3">
              {monthlyProfit.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyProfit}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="profit">
                      {monthlyProfit.map((d, i) => (
                        <Cell key={i} fill={d.profit >= 0 ? "#10b981" : "#e11d48"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
            <Table headers={["Month", "Income", "Cost", "Expense", "Profit"]}
              rows={monthlyProfit.map((d) => [d.month, fmt(d.income), fmt(d.cost), fmt(d.expense), fmt(d.profit)])} />

            <SectionTitle icon={Wallet} title="Cash Flow" />
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Inflow" value={fmt(cashFlow.inflow)} color="text-emerald-600" />
              <Stat label="Outflow" value={fmt(cashFlow.outflow)} color="text-rose-600" />
              <Stat label="Net" value={fmt(cashFlow.net)} color={cashFlow.net >= 0 ? "text-emerald-700" : "text-rose-700"} />
            </div>

            <SectionTitle icon={Landmark} title="Bank Flow" />
            <Table headers={["Bank", "Inflow", "Outflow", "Net"]}
              rows={bankFlow.map((b) => [b.name, fmt(b.inflow), fmt(b.outflow), fmt(b.net)])} />

            <SectionTitle icon={Wallet} title="Transportation Expense (Tractor)" />
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Total" value={fmt(transport.total)} color="text-rose-600" />
              <Stat label="Paid" value={fmt(transport.paid)} />
              <Stat label="Pending" value={fmt(transport.total - transport.paid)} color="text-amber-600" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Stat label="Raw Material Cost" value={fmt(transport.rawMaterial)} />
              <Stat label="Cost / Man" value={fmt(transport.costPerMan)} />
            </div>


            <SectionTitle icon={Wallet} title="Expense Transactions (tap to edit)" />
            <TxnLedger
              items={expenseLedger}
              onEdit={(id) => openEdit("expenses", expenses, id, [
                { key: "expense_date", label: t("date"), type: "date" },
                { key: "amount", label: t("amount"), type: "number" },
                { key: "description", label: t("remarks") },
              ], t("expenses") || "Expense")}
              onDelete={(id) => removeRow("expenses", id)}
            />

            <SectionTitle icon={Receipt} title="Customer Receipts (tap to edit)" />
            <TxnLedger
              items={receiptLedger}
              onEdit={(id) => openEdit("customer_receipts", receipts, id, [
                { key: "receipt_date", label: t("date"), type: "date" },
                { key: "amount", label: t("amount"), type: "number" },
                { key: "remarks", label: t("remarks") },
              ], t("customer_receipts") || "Receipt")}
              onDelete={(id) => removeRow("customer_receipts", id)}
            />

            <SectionTitle icon={Wallet} title="Vendor Payments (tap to edit)" />
            <TxnLedger
              items={vendorPaymentLedger}
              onEdit={(id) => openEdit("vendor_payments", vendorPayments, id, [
                { key: "payment_date", label: t("date"), type: "date" },
                { key: "amount", label: t("amount"), type: "number" },
                { key: "remarks", label: t("remarks") },
              ], t("vendor_payments") || "Payment")}
              onDelete={(id) => removeRow("vendor_payments", id)}
            />
          </TabsContent>

          <TabsContent value="purchase" className="space-y-3">
            <SectionTitle icon={ShoppingCart} title="Purchase Transactions (tap to edit)" />
            <TxnLedger
              items={purchaseLedger}
              onEdit={(id) => navigate({ to: "/purchases/new", search: { id } })}
              onDelete={(id) => removeRow("purchases", id, async () => {
                await supabase.from("vendor_payments").delete().eq("purchase_id", id);
              })}
            />
            <SectionTitle icon={ShoppingCart} title="Vendor Wise" />
            <Table headers={["Vendor", "Man", "Amount"]}
              rows={purchaseByVendor.map((p) => [p.name, p.qty.toFixed(0), fmt(p.amount)])} />
            <SectionTitle icon={ShoppingCart} title="Village Wise" />
            <Table headers={["Village", "Man", "Amount"]}
              rows={purchaseByVillage.map((p) => [p.village, p.qty.toFixed(0), fmt(p.amount)])} />
            <SectionTitle icon={ShoppingCart} title="Date Wise" />
            <Table headers={["Date", "Entries", "Amount"]}
              rows={purchaseByDate.map((p) => [p.date, p.count, fmt(p.amount)])} />
          </TabsContent>

          <TabsContent value="sales" className="space-y-3">
            <SectionTitle icon={Receipt} title="Sales Transactions (tap to edit)" />
            <TxnLedger
              items={salesLedger}
              onEdit={(id) => {
                const s = sales.find((x) => x.id === id);
                navigate({ to: "/sales/new", search: { id, type: (s?.sale_type as "waste" | "finished") ?? "waste" } });
              }}
              onDelete={(id) => removeRow("sales", id, async () => {
                await supabase.from("customer_receipts").delete().eq("sale_id", id);
              })}
            />
            <SectionTitle icon={Receipt} title="Customer Wise" />
            <Table headers={["Customer", "Sales", "Outstanding"]}
              rows={salesByCustomer.map((s) => [s.name, fmt(s.amount), fmt(s.outstanding)])} />
            <SectionTitle icon={Receipt} title="Product Wise" />
            <Table headers={["Product", "Entries", "Qty", "Amount"]}
              rows={salesByProduct.map((s) => [s.product, s.count, s.qty.toFixed(2), fmt(s.amount)])} />
          </TabsContent>

          <TabsContent value="worker" className="space-y-3">
            <SectionTitle icon={Users} title="Salary Transactions (tap to edit)" />
            <TxnLedger
              items={salaryLedger}
              onEdit={(id) => openEdit("worker_salaries", workerSalaries, id, [
                { key: "present_days", label: t("present_days") || "Present days", type: "number" },
                { key: "daily_wage", label: t("daily_wage") || "Daily wage", type: "number" },
                { key: "extra_work", label: t("extra_work") || "Extra work", type: "number" },
                { key: "advance_deducted", label: t("advance") || "Advance deducted", type: "number" },
                { key: "paid_amount", label: t("paid") || "Paid", type: "number" },
              ], t("salary") || "Salary")}
              onDelete={(id) => removeRow("worker_salaries", id)}
            />
            <SectionTitle icon={Users} title="Worker Advances (tap to edit)" />
            <TxnLedger
              items={advanceLedger}
              onEdit={(id) => openEdit("worker_advances", workerAdvances, id, [
                { key: "advance_date", label: t("date"), type: "date" },
                { key: "amount", label: t("amount"), type: "number" },
                { key: "notes", label: t("remarks") },
              ], t("advance") || "Advance")}
              onDelete={(id) => removeRow("worker_advances", id)}
            />
            <SectionTitle icon={Users} title="Attendance (Days)" />
            <Table headers={["Worker", "Present Days"]}
              rows={workerAttendance.map((w) => [w.name, w.days])} />
            <SectionTitle icon={Users} title="Salary" />
            <Table headers={["Worker", "Gross", "Paid", "Outstanding"]}
              rows={workerSalaryRpt.map((w) => [w.name, fmt(w.gross), fmt(w.paid), fmt(w.outstanding)])} />
            <SectionTitle icon={Users} title="Advances" />
            <Table headers={["Worker", "Advance"]}
              rows={workerAdvanceRpt.map((w) => [w.name, fmt(w.amount)])} />
          </TabsContent>

          <TabsContent value="outstanding" className="space-y-3">
            <SectionTitle icon={AlertCircle} title="Vendor Outstanding" />
            <Table headers={["Vendor", "Balance (We Owe)"]}
              rows={outVendors.map((v) => [v.name, fmt(v.balance)])} />
            <SectionTitle icon={AlertCircle} title="Customer Outstanding" />
            <Table headers={["Customer", "Balance (Owes Us)"]}
              rows={outCustomers.map((c) => [c.name, fmt(c.balance)])} />
            <SectionTitle icon={AlertCircle} title="Worker Outstanding" />
            <Table headers={["Worker", "Balance"]}
              rows={outWorkers.map((w) => [w.name, fmt(w.balance)])} />
          </TabsContent>

        </Tabs>

        {loading && <p className="text-center text-sm text-muted-foreground">{t("loading")}</p>}

        {editState && (
          <EditRecordDialog
            open
            onClose={() => setEditState(null)}
            onSaved={fetchAll}
            table={editState.table}
            id={editState.row.id}
            row={editState.row}
            fields={editState.fields}
            title={editState.title}
          />
        )}

      </main>
    </div>
  );
}
