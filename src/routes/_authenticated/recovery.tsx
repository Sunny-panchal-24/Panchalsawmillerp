import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listExports, getDownloadUrl } from "@/lib/backups.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Download, FolderArchive, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/recovery")({
  component: RecoveryPage,
});

function currentMonthRange() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end, label: `${d.toLocaleString("en-US", { month: "long" })} ${d.getFullYear()}` };
}

function RecoveryPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<Array<{ id: string; period_label: string; file_name: string; storage_path: string; size_bytes: number; created_at: string }>>([]);
  const [resetting, setResetting] = useState(false);
  const listFn = useServerFn(listExports);
  const dlFn = useServerFn(getDownloadUrl);
  const range = currentMonthRange();

  useEffect(() => {
    listFn().then((d) => setFiles(d as never)).catch(() => toast.error("Failed to load"));
  }, [listFn]);

  const handleDownload = async (path: string) => {
    try {
      const { url } = await dlFn({ data: { path } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const handleResetMonth = async () => {
    const confirm1 = window.confirm(
      `⚠️ WARNING\n\nThis will PERMANENTLY DELETE all transactions of ${range.label}:\n\n• Purchases\n• Sales\n• Vendor Payments\n• Customer Receipts\n• Expenses\n• Vendor / Worker Advances\n• Worker Salaries\n\nOpening balances stay untouched.\n\nAre you sure?`,
    );
    if (!confirm1) return;
    const confirm2 = window.prompt(`Type RESET to confirm deletion of ${range.label} data:`);
    if (confirm2 !== "RESET") { toast.info("Cancelled"); return; }

    setResetting(true);
    try {
      const deletes = [
        supabase.from("customer_receipts").delete().gte("receipt_date", range.start).lte("receipt_date", range.end),
        supabase.from("vendor_payments").delete().gte("payment_date", range.start).lte("payment_date", range.end),
        supabase.from("vendor_advances").delete().gte("advance_date", range.start).lte("advance_date", range.end),
        supabase.from("worker_advances").delete().gte("advance_date", range.start).lte("advance_date", range.end),
        supabase.from("worker_salaries").delete().gte("period_end", range.start).lte("period_end", range.end),
        supabase.from("expenses").delete().gte("expense_date", range.start).lte("expense_date", range.end),
        supabase.from("sales").delete().gte("sale_date", range.start).lte("sale_date", range.end),
        supabase.from("purchases").delete().gte("entry_date", range.start).lte("entry_date", range.end),
      ];
      const results = await Promise.all(deletes);
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
      toast.success(`${range.label} data cleared`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const handleCloseMonth = async () => {
    const c1 = window.confirm(
      `📅 CLOSE ${range.label.toUpperCase()}\n\nThis will:\n1. Carry current outstanding balances forward (vendors, customers, workers)\n2. Update bank & cash opening balances to current closing balances\n3. DELETE this month's transactions\n\nBackup first! Continue?`,
    );
    if (!c1) return;
    const c2 = window.prompt(`Type CLOSE to confirm closing ${range.label}:`);
    if (c2 !== "CLOSE") { toast.info("Cancelled"); return; }

    setResetting(true);
    try {
      // 1. Fetch everything
      const [vendors, customers, workers, banks, company, purchases, sales, vpay, crecs, expenses, vadv, wadv, wsal] = await Promise.all([
        supabase.from("vendors").select("id,opening_balance,opening_advance"),
        supabase.from("customers").select("id,opening_balance"),
        supabase.from("workers").select("id,opening_advance"),
        supabase.from("bank_accounts").select("id,opening_balance"),
        supabase.from("company_settings").select("id,opening_cash").limit(1).maybeSingle(),
        supabase.from("purchases").select("*"),
        supabase.from("sales").select("*"),
        supabase.from("vendor_payments").select("*"),
        supabase.from("customer_receipts").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("vendor_advances").select("*"),
        supabase.from("worker_advances").select("*"),
        supabase.from("worker_salaries").select("*"),
      ]);

      // 2. Compute new opening_balance / opening_advance per vendor
      const vendorUpdates = (vendors.data ?? []).map((v) => {
        const purchTotal = (purchases.data ?? []).filter((p) => p.vendor_id === v.id).reduce((s, r) => s + Number(r.vendor_payable ?? 0), 0);
        const dedTotal = (purchases.data ?? []).filter((p) => p.vendor_id === v.id).reduce((s, r) => s + Number(r.advance_deducted ?? 0), 0);
        const paidTotal = (vpay.data ?? []).filter((p) => p.vendor_id === v.id).reduce((s, r) => s + Number(r.amount ?? 0), 0);
        const advTotal = (vadv.data ?? []).filter((p) => p.vendor_id === v.id).reduce((s, r) => s + Number(r.amount ?? 0), 0);
        const newOutstanding = Number(v.opening_balance ?? 0) + purchTotal - paidTotal;
        const newAdvance = Math.max(0, Number(v.opening_advance ?? 0) + advTotal - dedTotal);
        return { id: v.id, opening_balance: newOutstanding, opening_advance: newAdvance };
      });

      // 3. Customers
      const customerUpdates = (customers.data ?? []).map((c) => {
        const salesOut = (sales.data ?? []).filter((s) => s.customer_id === c.id).reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
        const genericRec = (crecs.data ?? []).filter((r) => r.customer_id === c.id && !r.sale_id).reduce((s, r) => s + Number(r.amount ?? 0), 0);
        return { id: c.id, opening_balance: Number(c.opening_balance ?? 0) + salesOut - genericRec };
      });

      // 4. Workers (opening_advance = outstanding advances)
      const workerUpdates = (workers.data ?? []).map((w) => {
        const advTotal = (wadv.data ?? []).filter((a) => a.worker_id === w.id).reduce((s, r) => s + Number(r.amount ?? 0), 0);
        const salDed = (wsal.data ?? []).filter((s) => s.worker_id === w.id).reduce((s, r) => s + Number(r.advance_deducted ?? 0), 0);
        return { id: w.id, opening_advance: Math.max(0, Number(w.opening_advance ?? 0) + advTotal - salDed) };
      });

      // 5. Banks
      const bankUpdates = (banks.data ?? []).map((b) => {
        const inflow = (crecs.data ?? []).filter((r) => r.bank_account_id === b.id).reduce((s, r) => s + Number(r.amount ?? 0), 0)
          + (sales.data ?? []).filter((r) => r.bank_account_id === b.id).reduce((s, r) => s + Number(r.paid_amount ?? 0), 0);
        const outflow = (vpay.data ?? []).filter((r) => r.bank_account_id === b.id).reduce((s, r) => s + Number(r.amount ?? 0), 0)
          + (purchases.data ?? []).filter((r) => r.bank_account_id === b.id).reduce((s, r) => s + Number(r.paid_amount ?? 0), 0)
          + (purchases.data ?? []).filter((r) => r.tractor_bank_account_id === b.id).reduce((s, r) => s + Number(r.tractor_paid_amount ?? 0), 0)
          + (expenses.data ?? []).filter((r) => r.bank_account_id === b.id).reduce((s, r) => s + Number(r.amount ?? 0), 0)
          + (vadv.data ?? []).filter((r) => r.bank_account_id === b.id).reduce((s, r) => s + Number(r.amount ?? 0), 0)
          + (wadv.data ?? []).filter((r) => r.bank_account_id === b.id).reduce((s, r) => s + Number(r.amount ?? 0), 0)
          + (wsal.data ?? []).filter((r) => r.bank_account_id === b.id).reduce((s, r) => s + Number(r.paid_amount ?? 0), 0);
        return { id: b.id, opening_balance: Number(b.opening_balance ?? 0) + inflow - outflow };
      });

      // 6. Cash
      let newCash = Number(company.data?.opening_cash ?? 0);
      newCash += (crecs.data ?? []).filter((r) => r.mode === "cash").reduce((s, r) => s + Number(r.amount ?? 0), 0);
      newCash += (sales.data ?? []).filter((r) => r.payment_mode === "cash").reduce((s, r) => s + Number(r.paid_amount ?? 0), 0);
      newCash -= (vpay.data ?? []).filter((r) => r.mode === "cash").reduce((s, r) => s + Number(r.amount ?? 0), 0);
      newCash -= (purchases.data ?? []).filter((r) => r.paid_mode === "cash").reduce((s, r) => s + Number(r.paid_amount ?? 0), 0);
      newCash -= (purchases.data ?? []).filter((r) => r.tractor_paid_mode === "cash").reduce((s, r) => s + Number(r.tractor_paid_amount ?? 0), 0);
      newCash -= (expenses.data ?? []).filter((r) => r.payment_mode === "cash").reduce((s, r) => s + Number(r.amount ?? 0), 0);
      newCash -= (vadv.data ?? []).filter((r) => !r.bank_account_id).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      newCash -= (wadv.data ?? []).filter((r) => r.payment_mode === "cash").reduce((s, r) => s + Number(r.amount ?? 0), 0);
      newCash -= (wsal.data ?? []).filter((r) => r.payment_mode === "cash").reduce((s, r) => s + Number(r.paid_amount ?? 0), 0);

      // 7. Write updates
      await Promise.all([
        ...vendorUpdates.map((u) => supabase.from("vendors").update({ opening_balance: u.opening_balance, opening_advance: u.opening_advance }).eq("id", u.id)),
        ...customerUpdates.map((u) => supabase.from("customers").update({ opening_balance: u.opening_balance }).eq("id", u.id)),
        ...workerUpdates.map((u) => supabase.from("workers").update({ opening_advance: u.opening_advance }).eq("id", u.id)),
        ...bankUpdates.map((u) => supabase.from("bank_accounts").update({ opening_balance: u.opening_balance }).eq("id", u.id)),
        company.data?.id ? supabase.from("company_settings").update({ opening_cash: newCash }).eq("id", company.data.id) : Promise.resolve(),
      ]);

      // 8. Delete ALL transactions (not just current month — we carried forward everything as opening)
      await Promise.all([
        supabase.from("customer_receipts").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("vendor_payments").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("vendor_advances").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("worker_advances").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("worker_salaries").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("sales").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("purchases").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      ]);

      toast.success(`${range.label} closed. Balances carried forward.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Close failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="secondary" size="icon" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <FolderArchive className="h-5 w-5" />
          <h1 className="text-xl font-bold">Recovery</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <Card className="p-6 border-emerald-300 bg-emerald-50/50">
          <div className="flex items-start gap-3">
            <FolderArchive className="h-6 w-6 text-emerald-700 shrink-0 mt-1" />
            <div className="flex-1">
              <h2 className="font-bold text-lg text-emerald-800">Close Month (Carry Forward)</h2>
              <p className="text-sm text-muted-foreground mb-3">
                End of <strong>{range.label}</strong>. This carries outstanding balances (vendors, customers, workers) and closing cash/bank balances forward as new opening balances, then clears all transactions for a fresh start.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => navigate({ to: "/reports/monthly-export" })}>
                  Backup First
                </Button>
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" disabled={resetting} onClick={handleCloseMonth}>
                  {resetting ? "Closing..." : `Close ${range.label}`}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-rose-300 bg-rose-50/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-1" />
            <div className="flex-1">
              <h2 className="font-bold text-lg text-rose-800">Reset Current Month</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Delete all transactions of <strong>{range.label}</strong> ({range.start} → {range.end}). Opening balances stay untouched. Use this only if you need to redo the month from scratch.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => navigate({ to: "/reports/monthly-export" })}>
                  Backup First
                </Button>
                <Button variant="destructive" size="sm" disabled={resetting} onClick={handleResetMonth}>
                  {resetting ? "Resetting..." : `Reset ${range.label}`}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-3">Archived Backups</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Every monthly export is archived here. Files are never overwritten automatically.
          </p>
          {files.length === 0 ? (
            <p className="text-center text-muted-foreground">No backups yet.</p>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">{f.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.period_label} · {new Date(f.created_at).toLocaleString()} · {Math.round(f.size_bytes / 1024)} KB
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(f.storage_path)}>
                    <Download className="mr-1 h-4 w-4" /> Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
