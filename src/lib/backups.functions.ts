/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as XLSX from "xlsx";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function periodLabel(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}
function fileName(year: number, month: number) {
  return `PWAE_${MONTH_NAMES[month - 1]}_${year}.xlsx`;
}
function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const toDate = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toDate(start), end: toDate(end) };
}

async function fetchAll(supabase: any, table: string, dateCol: string | null, start: string, end: string): Promise<any[]> {
  let q: any = supabase.from(table).select("*");
  if (dateCol) q = q.gte(dateCol, start).lt(dateCol, end);
  const res = await q;
  if (res.error) throw new Error(`${table}: ${res.error.message}`);
  return res.data ?? [];
}

export const exportMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year: number; month: number }) => d)
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const { userId } = context;
    const { year, month } = data;
    const { start, end } = monthRange(year, month);
    const label = periodLabel(year, month);
    const fname = fileName(year, month);

    const [
      purchases, sales, vendors, customers, workers, tractors,
      vpay, vadv, creceipts, wadv, wsal, expenses, banks, company,
    ] = await Promise.all([
      fetchAll(supabase, "purchases", "entry_date", start, end),
      fetchAll(supabase, "sales", "sale_date", start, end),
      fetchAll(supabase, "vendors", null, start, end),
      fetchAll(supabase, "customers", null, start, end),
      fetchAll(supabase, "workers", null, start, end),
      fetchAll(supabase, "tractors", null, start, end),
      fetchAll(supabase, "vendor_payments", "payment_date", start, end),
      fetchAll(supabase, "vendor_advances", "advance_date", start, end),
      fetchAll(supabase, "customer_receipts", "receipt_date", start, end),
      fetchAll(supabase, "worker_advances", "advance_date", start, end),
      fetchAll(supabase, "worker_salaries", "period_end", start, end),
      fetchAll(supabase, "expenses", "expense_date", start, end),
      fetchAll(supabase, "bank_accounts", null, start, end),
      fetchAll(supabase, "company_settings", null, start, end),
    ]);
    void tractors;

    const sum = (arr: any[], k: string) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const totalSales = sum(sales, "total_amount");
    const totalPurchase = sum(purchases, "total_cost");
    const totalExpense = sum(expenses, "amount");
    const totalSalary = sum(wsal, "net_payable");
    const netProfit = totalSales - totalPurchase - totalExpense - totalSalary;

    const vendorLedger: any[] = [
      ...vpay.map((r: any) => ({ date: r.payment_date, vendor_id: r.vendor_id, type: "Payment", amount: r.amount, mode: r.mode })),
      ...vadv.map((r: any) => ({ date: r.advance_date, vendor_id: r.vendor_id, type: "Advance", amount: r.amount })),
      ...purchases.map((r: any) => ({ date: r.entry_date, vendor_id: r.vendor_id, type: "Purchase", amount: r.vendor_payable ?? r.total_cost })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const customerLedger: any[] = [
      ...sales.map((r: any) => ({ date: r.sale_date, customer_id: r.customer_id, type: "Sale", amount: r.total_amount, paid: r.paid_amount })),
      ...creceipts.map((r: any) => ({ date: r.receipt_date, customer_id: r.customer_id, type: "Receipt", amount: r.amount, paid: r.amount })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const workerLedger: any[] = [
      ...wadv.map((r: any) => ({ date: r.advance_date, worker_id: r.worker_id, type: "Advance", amount: r.amount })),
      ...wsal.map((r: any) => ({ date: r.period_end, worker_id: r.worker_id, type: "Salary", amount: r.net_payable })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const cashBook: any[] = [
      ...purchases.filter((r: any) => r.paid_mode === "cash").map((r: any) => ({ date: r.entry_date, ref: `Purchase #${r.entry_no}`, in: 0, out: r.paid_amount })),
      ...sales.filter((r: any) => r.payment_mode === "cash").map((r: any) => ({ date: r.sale_date, ref: `Sale #${r.sale_no}`, in: r.paid_amount, out: 0 })),
      ...expenses.filter((r: any) => r.payment_mode === "cash").map((r: any) => ({ date: r.expense_date, ref: r.expense_type, in: 0, out: r.amount })),
      ...creceipts.filter((r: any) => r.mode === "cash").map((r: any) => ({ date: r.receipt_date, ref: "Receipt", in: r.amount, out: 0 })),
      ...vpay.filter((r: any) => r.mode === "cash").map((r: any) => ({ date: r.payment_date, ref: "Vendor Payment", in: 0, out: r.amount })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const bankBook: any[] = [
      ...purchases.filter((r: any) => r.paid_mode === "bank").map((r: any) => ({ date: r.entry_date, bank: r.bank_account_id, ref: `Purchase #${r.entry_no}`, in: 0, out: r.paid_amount })),
      ...sales.filter((r: any) => r.payment_mode === "bank").map((r: any) => ({ date: r.sale_date, bank: r.bank_account_id, ref: `Sale #${r.sale_no}`, in: r.paid_amount, out: 0 })),
      ...expenses.filter((r: any) => r.payment_mode === "bank").map((r: any) => ({ date: r.expense_date, bank: r.bank_account_id, ref: r.expense_type, in: 0, out: r.amount })),
      ...creceipts.filter((r: any) => r.mode === "bank").map((r: any) => ({ date: r.receipt_date, bank: r.bank_account_id, ref: "Receipt", in: r.amount, out: 0 })),
      ...vpay.filter((r: any) => r.mode === "bank").map((r: any) => ({ date: r.payment_date, bank: r.bank_account_id, ref: "Vendor Payment", in: 0, out: r.amount })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const vendorOutstanding = vendors.map((v: any) => {
      const paid = vpay.filter((p: any) => p.vendor_id === v.id).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const billed = purchases.filter((p: any) => p.vendor_id === v.id).reduce((s: number, p: any) => s + Number(p.vendor_payable ?? p.total_cost ?? 0), 0);
      return { name: v.name, opening: v.opening_balance, billed, paid, outstanding: Number(v.opening_balance || 0) + billed - paid };
    });
    const customerOutstanding = customers.map((c: any) => {
      const billed = sales.filter((s: any) => s.customer_id === c.id).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
      const paid = sales.filter((s: any) => s.customer_id === c.id).reduce((s: number, r: any) => s + Number(r.paid_amount || 0), 0)
        + creceipts.filter((r: any) => r.customer_id === c.id).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      return { name: c.name, opening: c.opening_balance, billed, paid, outstanding: Number(c.opening_balance || 0) + billed - paid };
    });
    const workerOutstanding = workers.map((w: any) => {
      const adv = wadv.filter((a: any) => a.worker_id === w.id).reduce((s: number, a: any) => s + Number(a.amount || 0), 0);
      const sal = wsal.filter((s: any) => s.worker_id === w.id).reduce((s: number, r: any) => s + Number(r.net_payable || 0), 0);
      return { name: w.name, opening_advance: w.opening_advance, advances: adv, salaries: sal, net: Number(w.opening_advance || 0) + adv - sal };
    });

    const wb = XLSX.utils.book_new();
    const add = (name: string, rows: any[]) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: "No data" }]);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    };
    add("Dashboard", [{
      period: label,
      total_sales: totalSales,
      total_purchase: totalPurchase,
      total_expense: totalExpense,
      total_salary: totalSalary,
      net_profit: netProfit,
      company: company[0]?.company_name ?? "",
    }]);
    add("Purchases", purchases);
    add("Sales", sales);
    add("Vendor Ledger", vendorLedger);
    add("Customer Ledger", customerLedger);
    add("Worker Ledger", workerLedger);
    add("Cash Book", cashBook);
    add("Bank Book", bankBook);
    add("Expenses", expenses);
    add("Outstanding", [
      { section: "VENDORS" }, ...vendorOutstanding,
      { section: "CUSTOMERS" }, ...customerOutstanding,
      { section: "WORKERS" }, ...workerOutstanding,
    ]);
    add("Profit Summary", [
      { label: "Total Income (Sales)", amount: totalSales },
      { label: "Total Purchase Cost", amount: totalPurchase },
      { label: "Total Expense", amount: totalExpense },
      { label: "Total Salary", amount: totalSalary },
      { label: "Net Profit", amount: netProfit },
    ]);
    add("Banks", banks);

    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const bytes = new Uint8Array(buf);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${userId}/${label}/${fname}`;
    const up = await supabaseAdmin.storage.from("recovery").upload(path, bytes, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
    if (up.error) throw new Error(up.error.message);

    await supabase.from("monthly_exports").insert({
      period_label: label,
      file_name: fname,
      storage_path: path,
      size_bytes: bytes.byteLength,
    } as any);

    const signed = await supabaseAdmin.storage.from("recovery").createSignedUrl(path, 60 * 60 * 24 * 7);
    return { fname, path, size: bytes.byteLength, url: signed.data?.signedUrl ?? null };
  });

export const listExports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("monthly_exports").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => d)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: isAdmin } = await (supabase as any).rpc("is_admin", { _user_id: userId });
    if (!isAdmin && !data.path.startsWith(`${userId}/`)) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage.from("recovery").createSignedUrl(data.path, 60 * 60);
    if (signed.error) throw new Error(signed.error.message);
    return { url: signed.data.signedUrl };
  });

export const closeMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year: number; month: number }) => d)
  .handler(async ({ data, context }) => {
    const supabase: any = context.supabase;
    const { year, month } = data;
    const { start, end } = monthRange(year, month);
    const label = periodLabel(year, month);

    const tables: Array<{ name: string; dateCol: string }> = [
      { name: "purchases", dateCol: "entry_date" },
      { name: "sales", dateCol: "sale_date" },
      { name: "vendor_payments", dateCol: "payment_date" },
      { name: "vendor_advances", dateCol: "advance_date" },
      { name: "customer_receipts", dateCol: "receipt_date" },
      { name: "worker_advances", dateCol: "advance_date" },
      { name: "worker_salaries", dateCol: "period_end" },
      { name: "expenses", dateCol: "expense_date" },
    ];
    const inserts: any[] = [];
    for (const t of tables) {
      const rows = await fetchAll(supabase, t.name, t.dateCol, start, end);
      for (const r of rows) {
        inserts.push({
          period_label: label,
          archive_type: "month",
          table_name: t.name,
          row_id: r.id,
          payload: r,
        });
      }
    }
    if (inserts.length) {
      const { error } = await supabase.from("archived_data").insert(inserts);
      if (error) throw new Error(error.message);
    }

    const [banksRes, companyRes, vendorsRes, customersRes, workersRes] = await Promise.all([
      supabase.from("bank_accounts").select("*"),
      supabase.from("company_settings").select("*").limit(1).maybeSingle(),
      supabase.from("vendors").select("*"),
      supabase.from("customers").select("*"),
      supabase.from("workers").select("*"),
    ]);
    const banks: any[] = banksRes.data ?? [];
    const company: any = companyRes.data ?? null;
    const vendors: any[] = vendorsRes.data ?? [];
    const customers: any[] = customersRes.data ?? [];
    const workers: any[] = workersRes.data ?? [];

    const { error: closeErr } = await supabase.from("monthly_closings").insert({
      period_label: label,
      period_start: start,
      period_end: end,
      cash_closing: company?.opening_cash ?? 0,
      bank_closing: banks.map((b) => ({ id: b.id, name: b.name, balance: b.opening_balance })),
      vendor_outstanding: vendors.reduce((s, v) => s + Number(v.opening_balance || 0), 0),
      vendor_advance: vendors.reduce((s, v) => s + Number(v.opening_advance || 0), 0),
      customer_outstanding: customers.reduce((s, c) => s + Number(c.opening_balance || 0), 0),
      worker_advance: workers.reduce((s, w) => s + Number(w.opening_advance || 0), 0),
    });
    if (closeErr) throw new Error(closeErr.message);

    for (const t of tables) {
      await supabase.from(t.name).delete().gte(t.dateCol, start).lt(t.dateCol, end);
    }

    return { ok: true, archived: inserts.length, period: label };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await (supabase as any).rpc("is_admin", { _user_id: userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const [profilesR, rolesR, companiesR, purchasesR, salesR, vendorsR, customersR, workersR] = await Promise.all([
      admin.from("profiles").select("id,full_name,created_at"),
      admin.from("user_roles").select("user_id,role"),
      admin.from("company_settings").select("owner_id,company_name,village"),
      admin.from("purchases").select("created_by"),
      admin.from("sales").select("created_by"),
      admin.from("vendors").select("created_by"),
      admin.from("customers").select("created_by"),
      admin.from("workers").select("created_by"),
    ]);
    const auth = await admin.auth.admin.listUsers();
    const countBy = (arr: any[] | null, uid: string) => (arr ?? []).filter((r) => r.created_by === uid).length;
    return (profilesR.data ?? []).map((p: any) => {
      const user = auth.data?.users?.find((u: any) => u.id === p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        email: user?.email ?? "",
        created_at: p.created_at,
        roles: (rolesR.data ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
        company: (companiesR.data ?? []).find((c: any) => c.owner_id === p.id)?.company_name ?? "",
        village: (companiesR.data ?? []).find((c: any) => c.owner_id === p.id)?.village ?? "",
        counts: {
          purchases: countBy(purchasesR.data, p.id),
          sales: countBy(salesR.data, p.id),
          vendors: countBy(vendorsR.data, p.id),
          customers: countBy(customersR.data, p.id),
          workers: countBy(workersR.data, p.id),
        },
      };
    });
  });
