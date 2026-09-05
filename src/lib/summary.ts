import { supabase } from "@/integrations/supabase/client";
import { vendorBalance, workerBalance, customerBalance } from "@/lib/balances";

const n = (v: unknown) => Number(v ?? 0) || 0;

export type PeriodKey =
  | "today" | "yesterday" | "week" | "month" | "prev_month" | "fy" | "custom" | "all";

export type Range = { from: string; to: string };

const iso = (d: Date) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};

export function periodRange(key: PeriodKey, custom?: Range): Range {
  const today = new Date();
  switch (key) {
    case "today":
      return { from: iso(today), to: iso(today) };
    case "yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { from: iso(y), to: iso(y) };
    }
    case "week": {
      const w = new Date(today); w.setDate(w.getDate() - 6);
      return { from: iso(w), to: iso(today) };
    }
    case "month":
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
    case "prev_month": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: iso(s), to: iso(e) };
    }
    case "fy": {
      // Indian FY: 1 April -> 31 March
      const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      return { from: `${y}-04-01`, to: iso(today) };
    }
    case "custom":
      return { from: custom?.from ?? "", to: custom?.to ?? "" };
    default:
      return { from: "", to: "" };
  }
}

const inRange = (date: string | null | undefined, r: Range) => {
  if (!date) return false;
  if (r.from && date < r.from) return false;
  if (r.to && date > r.to) return false;
  return true;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export type RawData = {
  settings: Row | null;
  banks: Row[];
  vendors: Row[];
  customers: Row[];
  workers: Row[];
  purchases: Row[];
  sales: Row[];
  vendorPayments: Row[];
  vendorAdvances: Row[];
  receipts: Row[];
  expenses: Row[];
  workerAdvances: Row[];
  salaries: Row[];
  adjustments: Row[];
};

/** Single source of truth: one fetch, every dashboard number derived from it. */
export async function loadRawData(): Promise<RawData> {
  const [
    { data: cs }, { data: bk }, { data: vn }, { data: cu }, { data: wk },
    { data: pu }, { data: sa }, { data: vp }, { data: va },
    { data: cr }, { data: ex }, { data: wa }, { data: ws }, { data: ma },
  ] = await Promise.all([
    supabase.from("company_settings").select("id,opening_cash").limit(1).maybeSingle(),
    supabase.from("bank_accounts").select("id,name,opening_balance").eq("is_active", true).order("name"),
    supabase.from("vendors").select("id,name,opening_balance,opening_advance").order("name"),
    supabase.from("customers").select("id,name,opening_balance").order("name"),
    supabase.from("workers").select("id,name,opening_advance").order("name"),
    supabase.from("purchases").select("*"),
    supabase.from("sales").select("*"),
    supabase.from("vendor_payments").select("*"),
    supabase.from("vendor_advances").select("*"),
    supabase.from("customer_receipts").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("worker_advances").select("*"),
    supabase.from("worker_salaries").select("*"),
    supabase.from("manual_adjustments").select("*"),
  ]);
  return {
    settings: cs ?? null,
    banks: bk ?? [], vendors: vn ?? [], customers: cu ?? [], workers: wk ?? [],
    purchases: pu ?? [], sales: sa ?? [], vendorPayments: vp ?? [], vendorAdvances: va ?? [],
    receipts: cr ?? [], expenses: ex ?? [], workerAdvances: wa ?? [], salaries: ws ?? [],
    adjustments: ma ?? [],
  };
}

export type Summary = {
  purchasedMan: number;
  purchaseValue: number;
  wasteKg: number;
  wasteValue: number;
  finishedCft: number;
  finishedValue: number;
  cash: number;
  bankBalances: { id: string; name: string; balance: number }[];
  totalInHand: number;
  vendorPayable: number;
  vendorAdvanceHeld: number;
  customerOutstanding: number;
  workerPayable: number;
  workerPaid: number;
};

/** Cash movement of one row: negative = money out. */
function cashDelta(d: RawData): { cash: number; byBank: Record<string, number> } {
  const byBank: Record<string, number> = {};
  let cash = 0;
  const move = (bankId: string | null | undefined, amt: number) => {
    if (bankId) byBank[bankId] = (byBank[bankId] ?? 0) + amt;
    else cash += amt;
  };

  d.purchases.forEach((r) => {
    if (n(r.paid_amount) > 0) move(r.bank_account_id, -n(r.paid_amount));
    if (n(r.tractor_paid_amount) > 0) move(r.tractor_bank_account_id, -n(r.tractor_paid_amount));
  });
  d.sales.forEach((r) => { if (n(r.paid_amount) > 0) move(r.bank_account_id, n(r.paid_amount)); });
  d.vendorPayments.forEach((r) => { if (!r.purchase_id) move(r.bank_account_id, -n(r.amount)); });
  d.receipts.forEach((r) => { if (!r.sale_id) move(r.bank_account_id, n(r.amount)); });
  d.expenses.forEach((r) => move(r.bank_account_id, -n(r.amount)));
  d.workerAdvances.forEach((r) => move(r.bank_account_id, -n(r.amount)));
  d.salaries.forEach((r) => { if (n(r.paid_amount) > 0) move(r.bank_account_id, -n(r.paid_amount)); });
  d.vendorAdvances.forEach((r) => move(r.bank_account_id, -n(r.amount)));
  d.adjustments.forEach((r) => move(r.bank_account_id, n(r.amount)));

  return { cash, byBank };
}

export function computeSummary(d: RawData, range: Range): Summary {
  // --- period activity ---
  const pu = d.purchases.filter((r) => inRange(r.entry_date, range));
  const sa = d.sales.filter((r) => inRange(r.sale_date, range));
  const waste = sa.filter((r) => r.sale_type === "waste");
  const finished = sa.filter((r) => r.sale_type !== "waste");

  const purchasedMan = pu.reduce((s, r) => s + n(r.actual_man), 0);
  const purchaseValue = pu.reduce((s, r) => s + n(r.total_cost), 0);
  const wasteKg = waste.reduce((s, r) => s + n(r.net_weight), 0);
  const wasteValue = waste.reduce((s, r) => s + n(r.total_amount), 0);
  const finishedCft = finished.reduce((s, r) => s + n(r.cft), 0);
  const finishedValue = finished.reduce((s, r) => s + n(r.total_amount), 0);

  const workerPaid =
    d.salaries.filter((r) => inRange(r.period_end, range)).reduce((s, r) => s + n(r.paid_amount), 0);

  // --- point-in-time balances ---
  const { cash: cashDiff, byBank } = cashDelta(d);
  const cash = n(d.settings?.opening_cash) + cashDiff;
  const bankBalances = d.banks.map((b) => ({
    id: b.id as string,
    name: b.name as string,
    balance: n(b.opening_balance) + (byBank[b.id] ?? 0),
  }));
  const totalInHand = cash + bankBalances.reduce((s, b) => s + b.balance, 0);

  let vendorPayable = 0;
  let vendorAdvanceHeld = 0;
  d.vendors.forEach((v) => {
    const bal = vendorBalance({
      opening_balance: v.opening_balance,
      opening_advance: v.opening_advance,
      purchases: d.purchases.filter((p) => p.vendor_id === v.id),
      payments: d.vendorPayments.filter((p) => p.vendor_id === v.id && !p.purchase_id),
      advances: d.vendorAdvances.filter((a) => a.vendor_id === v.id),
    });
    if (bal > 0) vendorPayable += bal; else vendorAdvanceHeld += -bal;
  });

  let customerOutstanding = 0;
  d.customers.forEach((c) => {
    const bal = customerBalance({
      opening_balance: c.opening_balance,
      sales: d.sales.filter((s) => s.customer_id === c.id),
      receipts: d.receipts.filter((r) => r.customer_id === c.id && !r.sale_id),
    });
    if (bal > 0) customerOutstanding += bal;
  });

  let workerPayable = 0;
  d.workers.forEach((w) => {
    const bal = workerBalance({
      opening_advance: w.opening_advance,
      salaries: d.salaries.filter((s) => s.worker_id === w.id),
      advances: d.workerAdvances.filter((a) => a.worker_id === w.id),
    });
    if (bal > 0) workerPayable += bal;
  });

  return {
    purchasedMan, purchaseValue, wasteKg, wasteValue, finishedCft, finishedValue,
    cash, bankBalances, totalInHand,
    vendorPayable, vendorAdvanceHeld, customerOutstanding, workerPayable, workerPaid,
  };
}

/** Per-party outstanding rows for the Ledger File screens. */
export function vendorRows(d: RawData) {
  return d.vendors.map((v) => {
    const purchases = d.purchases.filter((p) => p.vendor_id === v.id);
    const payments = d.vendorPayments.filter((p) => p.vendor_id === v.id && !p.purchase_id);
    const advances = d.vendorAdvances.filter((a) => a.vendor_id === v.id);
    return {
      id: v.id as string,
      name: v.name as string,
      purchaseValue: purchases.reduce((s, p) => s + n(p.total_cost), 0),
      advanceGiven: advances.reduce((s, a) => s + n(a.amount), 0),
      advanceAdjusted: purchases.reduce((s, p) => s + n(p.advance_deducted), 0),
      paid: purchases.reduce((s, p) => s + n(p.paid_amount), 0) + payments.reduce((s, p) => s + n(p.amount), 0),
      balance: vendorBalance({
        opening_balance: v.opening_balance, opening_advance: v.opening_advance,
        purchases, payments, advances,
      }),
    };
  });
}

export function customerRows(d: RawData) {
  return d.customers.map((c) => {
    const sales = d.sales.filter((s) => s.customer_id === c.id);
    const receipts = d.receipts.filter((r) => r.customer_id === c.id && !r.sale_id);
    return {
      id: c.id as string,
      name: c.name as string,
      salesValue: sales.reduce((s, x) => s + n(x.total_amount), 0),
      received: sales.reduce((s, x) => s + n(x.paid_amount), 0) + receipts.reduce((s, x) => s + n(x.amount), 0),
      balance: customerBalance({ opening_balance: c.opening_balance, sales, receipts }),
    };
  });
}

export function workerRows(d: RawData) {
  return d.workers.map((w) => {
    const salaries = d.salaries.filter((s) => s.worker_id === w.id);
    const advances = d.workerAdvances.filter((a) => a.worker_id === w.id);
    return {
      id: w.id as string,
      name: w.name as string,
      gross: salaries.reduce((s, x) => s + n(x.gross_salary), 0),
      extra: salaries.reduce((s, x) => s + n(x.extra_work), 0),
      advance: advances.reduce((s, x) => s + n(x.amount), 0),
      adjusted: salaries.reduce((s, x) => s + n(x.advance_deducted), 0),
      paid: salaries.reduce((s, x) => s + n(x.paid_amount), 0),
      balance: workerBalance({ opening_advance: w.opening_advance, salaries, advances }),
    };
  });
}

export const money = (v: number) =>
  "₹" + Math.round(v).toLocaleString("en-IN");
