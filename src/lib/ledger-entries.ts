import type { RawData } from "@/lib/summary";

const n = (v: unknown) => Number(v ?? 0) || 0;

export type EntryCategory =
  | "purchase" | "waste_sale" | "finished_sale" | "vendor_payment" | "vendor_advance"
  | "customer_receipt" | "worker_salary" | "worker_advance" | "expense" | "adjustment";

export type LedgerEntry = {
  key: string;
  date: string;
  serial: string;
  name: string;
  category: EntryCategory;
  typeLabelKey: string;
  description: string;
  amount: number;
  qty?: number;
  unit?: string;
  mode: string;
  remarks: string;
  table: string;
  id: string;
  wizard?: "purchase" | "sale";
  saleType?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: Record<string, any>;
};

/** Flatten every transaction into one uniform ledger row list. */
export function buildEntries(d: RawData): LedgerEntry[] {
  const bankName = (id: string | null | undefined) =>
    id ? (d.banks.find((b) => b.id === id)?.name ?? "Bank") : "Cash";
  const vname = (id: string | null | undefined) => d.vendors.find((v) => v.id === id)?.name ?? "-";
  const cname = (id: string | null | undefined) => d.customers.find((c) => c.id === id)?.name ?? "-";
  const wname = (id: string | null | undefined) => d.workers.find((w) => w.id === id)?.name ?? "-";

  const out: LedgerEntry[] = [];

  d.purchases.forEach((r) => out.push({
    key: `pu-${r.id}`, date: r.entry_date, serial: r.entry_no ?? "", name: vname(r.vendor_id),
    category: "purchase", typeLabelKey: "purchase", description: `${n(r.actual_man)} MAN`,
    amount: n(r.total_cost), qty: n(r.actual_man), unit: "MAN",
    mode: bankName(r.bank_account_id), remarks: r.remarks ?? "",
    table: "purchases", id: r.id, wizard: "purchase", row: r,
  }));

  d.sales.forEach((r) => {
    const waste = r.sale_type === "waste";
    out.push({
      key: `sa-${r.id}`, date: r.sale_date, serial: r.sale_no ?? "", name: cname(r.customer_id),
      category: waste ? "waste_sale" : "finished_sale",
      typeLabelKey: waste ? "waste_wood_sales" : "finished_wood_sales",
      description: waste ? `${n(r.net_weight)} KG` : `${n(r.cft)} CFT`,
      amount: n(r.total_amount), qty: waste ? n(r.net_weight) : n(r.cft), unit: waste ? "KG" : "CFT",
      mode: bankName(r.bank_account_id), remarks: r.remarks ?? "",
      table: "sales", id: r.id, wizard: "sale", saleType: r.sale_type, row: r,
    });
  });

  d.vendorPayments.filter((r) => !r.purchase_id).forEach((r) => out.push({
    key: `vp-${r.id}`, date: r.payment_date, serial: "", name: vname(r.vendor_id),
    category: "vendor_payment", typeLabelKey: "vendor_payment", description: "",
    amount: n(r.amount), mode: bankName(r.bank_account_id), remarks: r.remarks ?? "",
    table: "vendor_payments", id: r.id, row: r,
  }));

  d.vendorAdvances.forEach((r) => out.push({
    key: `va-${r.id}`, date: r.advance_date, serial: "", name: vname(r.vendor_id),
    category: "vendor_advance", typeLabelKey: "vendor_advance", description: "",
    amount: n(r.amount), mode: bankName(r.bank_account_id), remarks: r.remarks ?? "",
    table: "vendor_advances", id: r.id, row: r,
  }));

  d.receipts.filter((r) => !r.sale_id).forEach((r) => out.push({
    key: `cr-${r.id}`, date: r.receipt_date, serial: "", name: cname(r.customer_id),
    category: "customer_receipt", typeLabelKey: "customer_receipt", description: "",
    amount: n(r.amount), mode: bankName(r.bank_account_id), remarks: r.remarks ?? "",
    table: "customer_receipts", id: r.id, row: r,
  }));

  d.salaries.forEach((r) => out.push({
    key: `ws-${r.id}`, date: r.period_end ?? r.created_at?.slice(0, 10) ?? "", serial: r.period_label ?? "",
    name: wname(r.worker_id), category: "worker_salary", typeLabelKey: "salary",
    description: `${n(r.present_days)} × ${n(r.daily_wage)}`,
    amount: n(r.paid_amount), mode: bankName(r.bank_account_id), remarks: r.notes ?? "",
    table: "worker_salaries", id: r.id, row: r,
  }));

  d.workerAdvances.forEach((r) => out.push({
    key: `wa-${r.id}`, date: r.advance_date, serial: "", name: wname(r.worker_id),
    category: "worker_advance", typeLabelKey: "worker_advance", description: "",
    amount: n(r.amount), mode: bankName(r.bank_account_id), remarks: r.notes ?? "",
    table: "worker_advances", id: r.id, row: r,
  }));

  d.expenses.forEach((r) => out.push({
    key: `ex-${r.id}`, date: r.expense_date, serial: "", name: "-",
    category: "expense", typeLabelKey: r.expense_type === "maintenance" ? "maintenance" : "other_expense",
    description: r.description ?? "", amount: n(r.amount),
    mode: bankName(r.bank_account_id), remarks: r.description ?? "",
    table: "expenses", id: r.id, row: r,
  }));

  d.adjustments.forEach((r) => out.push({
    key: `ma-${r.id}`, date: r.adjust_date, serial: "", name: "-",
    category: "adjustment", typeLabelKey: "manual_adjustment", description: r.reason ?? "",
    amount: n(r.amount), mode: bankName(r.bank_account_id), remarks: r.reason ?? "",
    table: "manual_adjustments", id: r.id, row: r,
  }));

  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function searchEntries(list: LedgerEntry[], q: string): LedgerEntry[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((e) =>
    [e.name, e.serial, e.date, e.description, e.remarks, e.mode, String(e.amount)]
      .some((v) => (v ?? "").toString().toLowerCase().includes(s)),
  );
}
