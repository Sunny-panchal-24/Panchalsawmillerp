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
        <Card className="p-6 border-rose-300 bg-rose-50/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-1" />
            <div className="flex-1">
              <h2 className="font-bold text-lg text-rose-800">Reset Current Month</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Delete all transactions of <strong>{range.label}</strong> ({range.start} → {range.end}).
                Opening balances, vendors, customers & masters are preserved.
                Download a backup first from Monthly Export.
              </p>
              <div className="flex gap-2">
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
