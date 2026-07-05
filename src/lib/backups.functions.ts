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

async function fetchAll(supabase: ReturnType<typeof supabaseFake>, table: string, dateCol: string | null, start: string, end: string) {
  const q = supabase.from(table).select("*");
  const res = dateCol ? await q.gte(dateCol, start).lt(dateCol, end) : await q;
  if (res.error) throw new Error(`${table}: ${res.error.message}`);
  return res.data ?? [];
}
// helper only for typing
function supabaseFake() { return null as never; }

export const exportMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year: number; month: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { year, month } = data;
    const { start, end } = monthRange(year, month);
    const label = periodLabel(year, month);
    const fname = fileName(year, month);

    // Fetch all datasets in parallel
    const [
      purchases, sales, vendors, customers, workers, tractors,
      vpay, vadv, creceipts, wadv, wsal, expenses, banks, company,
    ] = await Promise.all([
      fetchAll(supabase as never, "purchases", "entry_date", start, end),
      fetchAll(supabase as never, "sales", "sale_date", start, end),
      fetchAll(supabase as never, "vendors", null, start, end),
      fetchAll(supabase as never, "customers", null, start, end),
      fetchAll(supabase as never, "workers", null, start, end),
      fetchAll(supabase as never, "tractors", null, start, end),
      fetchAll(supabase as never, "vendor_payments", "payment_date", start, end),
      fetchAll(supabase as never, "vendor_advances", "advance_date", start, end),
      fetchAll(supabase as never, "customer_receipts", "receipt_date", start, end),
      fetchAll(supabase as never, "worker_advances", "advance_date", start, end),
      fetchAll(supabase as never, "worker_salaries", "period_end", start, end),
      fetchAll(supabase as never, "expenses", "expense_date", start, end),
      fetchAll(supabase as never, "bank_accounts", null, start, end),
      fetchAll(supabase as never, "company_settings", null, start, end),
    ]);

    // Compute simple summary
    const sum = (arr: Array<Record<string, unknown>>, k: string) =>
      arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);

    const totalSales = sum(sales, "total_amount");
    const totalPurchase = sum(purchases, "total_cost");
    const totalExpense = sum(expenses, "amount");
    const totalSalary = sum(wsal, "net_payable");
    const netProfit = totalSales - totalPurchase - totalExpense - totalSalary;

    // Ledger builders
    const vendorLedger = [
      ...vpay.map((r) => ({ date: r.payment_date, vendor_id: r.vendor_id, type: "Payment", amount: r.amount, mode: r.mode })),
      ...vadv.map((r) => ({ date: r.advance_date, vendor_id: r.vendor_id, type: "Advance", amount: r.amount, mode: r.bank_account_id ? "bank" : "cash" })),
      ...purchases.map((r) => ({ date: r.entry_date, vendor_id: r.vendor_id, type: "Purchase", amount: r.vendor_payable ?? r.total_cost, mode: "" })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const customerLedger = [
      ...sales.map((r) => ({ date: r.sale_date, customer_id: r.customer_id, type: "Sale", amount: r.total_amount, paid: r.paid_amount })),
      ...creceipts.map((r) => ({ date: r.receipt_date, customer_id: r.customer_id, type: "Receipt", amount: r.amount, paid: r.amount })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const workerLedger = [
      ...wadv.map((r) => ({ date: r.advance_date, worker_id: r.worker_id, type: "Advance", amount: r.amount })),
      ...wsal.map((r) => ({ date: r.period_end, worker_id: r.worker_id, type: "Salary", amount: r.net_payable })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const cashBook = [
      ...purchases.filter((r) => r.paid_mode === "cash").map((r) => ({ date: r.entry_date, ref: `Purchase #${r.entry_no}`, in: 0, out: r.paid_amount })),
      ...sales.filter((r) => r.payment_mode === "cash").map((r) => ({ date: r.sale_date, ref: `Sale #${r.sale_no}`, in: r.paid_amount, out: 0 })),
      ...expenses.filter((r) => r.payment_mode === "cash").map((r) => ({ date: r.expense_date, ref: r.expense_type, in: 0, out: r.amount })),
      ...creceipts.filter((r) => r.mode === "cash").map((r) => ({ date: r.receipt_date, ref: "Receipt", in: r.amount, out: 0 })),
      ...vpay.filter((r) => r.mode === "cash").map((r) => ({ date: r.payment_date, ref: "Vendor Payment", in: 0, out: r.amount })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const bankBook = [
      ...purchases.filter((r) => r.paid_mode === "bank").map((r) => ({ date: r.entry_date, bank: r.bank_account_id, ref: `Purchase #${r.entry_no}`, in: 0, out: r.paid_amount })),
      ...sales.filter((r) => r.payment_mode === "bank").map((r) => ({ date: r.sale_date, bank: r.bank_account_id, ref: `Sale #${r.sale_no}`, in: r.paid_amount, out: 0 })),
      ...expenses.filter((r) => r.payment_mode === "bank").map((r) => ({ date: r.expense_date, bank: r.bank_account_id, ref: r.expense_type, in: 0, out: r.amount })),
      ...creceipts.filter((r) => r.mode === "bank").map((r) => ({ date: r.receipt_date, bank: r.bank_account_id, ref: "Receipt", in: r.amount, out: 0 })),
      ...vpay.filter((r) => r.mode === "bank").map((r) => ({ date: r.payment_date, bank: r.bank_account_id, ref: "Vendor Payment", in: 0, out: r.amount })),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    // Outstanding
    const vendorOutstanding = vendors.map((v) => {
      const paid = vpay.filter((p) => p.vendor_id === v.id).reduce((s, p) => s + Number(p.amount || 0), 0);
      const billed = purchases.filter((p) => p.vendor_id === v.id).reduce((s, p) => s + Number(p.vendor_payable ?? p.total_cost ?? 0), 0);
      return { name: v.name, opening: v.opening_balance, billed, paid, outstanding: Number(v.opening_balance || 0) + billed - paid };
    });
    const customerOutstanding = customers.map((c) => {
      const billed = sales.filter((s) => s.customer_id === c.id).reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const paid = sales.filter((s) => s.customer_id === c.id).reduce((s, r) => s + Number(r.paid_amount || 0), 0)
        + creceipts.filter((r) => r.customer_id === c.id).reduce((s, r) => s + Number(r.amount || 0), 0);
      return { name: c.name, opening: c.opening_balance, billed, paid, outstanding: Number(c.opening_balance || 0) + billed - paid };
    });
    const workerOutstanding = workers.map((w) => {
      const adv = wadv.filter((a) => a.worker_id === w.id).reduce((s, a) => s + Number(a.amount || 0), 0);
      const sal = wsal.filter((s) => s.worker_id === w.id).reduce((s, r) => s + Number(r.net_payable || 0), 0);
      return { name: w.name, opening_advance: w.opening_advance, advances: adv, salaries: sal, net: Number(w.opening_advance || 0) + adv - sal };
    });

    // Build workbook
    const wb = XLSX.utils.book_new();
    const add = (name: string, rows: Array<Record<string, unknown>>) => {
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

    // Upload via admin (bucket needs privileged upload; RLS on storage.objects checks folder)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${userId}/${label}/${fname}`;
    const up = await supabaseAdmin.storage.from("recovery").upload(path, bytes, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });
    if (up.error && !/exists/i.test(up.error.message)) throw new Error(up.error.message);

    // Record
    await supabase.from("monthly_exports").insert({
      period_label: label,
      file_name: fname,
      storage_path: path,
      size_bytes: bytes.byteLength,
    });

    // Signed URL for immediate download (7 days)
    const signed = await supabaseAdmin.storage.from("recovery").createSignedUrl(path, 60 * 60 * 24 * 7);

    return { fname, path, size: bytes.byteLength, url: signed.data?.signedUrl ?? null };
  });

export const listExports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("monthly_exports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => d)
  .handler(async ({ data, context }) => {
    // Verify caller owns file (path starts with userId/) or is admin
    const { userId, supabase } = context;
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
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
    const { supabase, userId } = context;
    const { year, month } = data;
    const { start, end } = monthRange(year, month);
    const label = periodLabel(year, month);

    // Archive current month's transactional data
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
    const inserts: Array<Record<string, unknown>> = [];
    for (const t of tables) {
      const rows = await fetchAll(supabase as never, t.name, t.dateCol, start, end);
      for (const r of rows) {
        inserts.push({
          period_label: label,
          archive_type: "month",
          table_name: t.name,
          row_id: (r as Record<string, unknown>).id,
          payload: r,
        });
      }
    }
    if (inserts.length) {
      const { error } = await supabase.from("archived_data").insert(inserts);
      if (error) throw new Error(error.message);
    }

    // Compute closing balances (use whole business, not just month)
    const [{ data: banks }, { data: company }, { data: vendors }, { data: customers }, { data: workers }] = await Promise.all([
      supabase.from("bank_accounts").select("*"),
      supabase.from("company_settings").select("*").limit(1).maybeSingle(),
      supabase.from("vendors").select("*"),
      supabase.from("customers").select("*"),
      supabase.from("workers").select("*"),
    ]);

    // Persist closing snapshot
    const { error: closeErr } = await supabase.from("monthly_closings").insert({
      period_label: label,
      period_start: start,
      period_end: end,
      cash_closing: company?.opening_cash ?? 0,
      bank_closing: (banks ?? []).map((b) => ({ id: b.id, name: b.name, balance: b.opening_balance })),
      vendor_outstanding: (vendors ?? []).reduce((s, v) => s + Number(v.opening_balance || 0), 0),
      vendor_advance: (vendors ?? []).reduce((s, v) => s + Number(v.opening_advance || 0), 0),
      customer_outstanding: (customers ?? []).reduce((s, c) => s + Number(c.opening_balance || 0), 0),
      worker_advance: (workers ?? []).reduce((s, w) => s + Number(w.opening_advance || 0), 0),
    });
    if (closeErr) throw new Error(closeErr.message);

    // Delete archived transactional rows (only current user's rows — RLS enforces)
    for (const t of tables) {
      await supabase.from(t.name).delete().gte(t.dateCol, start).lt(t.dateCol, end);
    }

    return { ok: true, archived: inserts.length, period: label };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }, { data: companies }, purchasesCount, salesCount, vendorsCount, customersCount, workersCount] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,full_name,created_at"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("company_settings").select("owner_id,company_name,village"),
      supabaseAdmin.from("purchases").select("created_by"),
      supabaseAdmin.from("sales").select("created_by"),
      supabaseAdmin.from("vendors").select("created_by"),
      supabaseAdmin.from("customers").select("created_by"),
      supabaseAdmin.from("workers").select("created_by"),
    ]);
    const auth = await supabaseAdmin.auth.admin.listUsers();
    const countBy = (arr: { created_by: string }[] | null, uid: string) => (arr ?? []).filter((r) => r.created_by === uid).length;
    return (profiles ?? []).map((p) => {
      const user = auth.data?.users?.find((u) => u.id === p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        email: user?.email ?? "",
        created_at: p.created_at,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
        company: companies?.find((c) => c.owner_id === p.id)?.company_name ?? "",
        village: companies?.find((c) => c.owner_id === p.id)?.village ?? "",
        counts: {
          purchases: countBy(purchasesCount.data as never, p.id),
          sales: countBy(salesCount.data as never, p.id),
          vendors: countBy(vendorsCount.data as never, p.id),
          customers: countBy(customersCount.data as never, p.id),
          workers: countBy(workersCount.data as never, p.id),
        },
      };
    });
  });
