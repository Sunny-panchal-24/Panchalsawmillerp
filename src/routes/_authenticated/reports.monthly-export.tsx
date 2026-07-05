import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { exportMonth, listExports, closeMonth, getDownloadUrl } from "@/lib/backups.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Download, FileSpreadsheet, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/monthly-export")({
  component: MonthlyExportPage,
});

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function MonthlyExportPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const [exports, setExports] = useState<Array<{ id: string; period_label: string; file_name: string; storage_path: string; size_bytes: number; created_at: string }>>([]);
  const [askClose, setAskClose] = useState<{ year: number; month: number } | null>(null);

  const exportFn = useServerFn(exportMonth);
  const listFn = useServerFn(listExports);
  const closeFn = useServerFn(closeMonth);
  const dlFn = useServerFn(getDownloadUrl);

  const refresh = async () => {
    try { setExports(await listFn() as never); } catch (e) { console.error(e); }
  };
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, []);

  const handleExport = async () => {
    setBusy(true);
    try {
      const res = await exportFn({ data: { year, month } });
      toast.success(`Exported: ${res.fname}`);
      if (res.url) window.open(res.url, "_blank");
      await refresh();
      setAskClose({ year, month });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (!askClose) return;
    setBusy(true);
    try {
      const res = await closeFn({ data: askClose });
      toast.success(`Month closed. ${res.archived} rows archived.`);
      setAskClose(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Close failed");
    } finally { setBusy(false); }
  };

  const handleDownload = async (path: string) => {
    try {
      const { url } = await dlFn({ data: { path } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="secondary" size="icon" onClick={() => navigate({ to: "/reports" })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Monthly Export</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Export Month</h2>
          <div className="flex gap-3">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-12 flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-12 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleExport} disabled={busy} className="h-12 w-full">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
            Export & Save to Recovery
          </Button>
          <p className="text-sm text-muted-foreground">
            File: PWAE_{MONTHS[month - 1]}_{year}.xlsx (11 sheets)
          </p>
        </Card>

        <Card className="space-y-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Exports</h2>
            <Link to="/recovery" className="text-sm text-primary underline">Recovery folder</Link>
          </div>
          {exports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exports yet.</p>
          ) : (
            <div className="space-y-2">
              {exports.slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">{e.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()} · {Math.round(e.size_bytes / 1024)} KB
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(e.storage_path)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>

      <AlertDialog open={!!askClose} onOpenChange={(o) => !o && setAskClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close current month?</AlertDialogTitle>
            <AlertDialogDescription>
              This archives all {askClose ? `${MONTHS[askClose.month - 1]} ${askClose.year}` : ""} transactions and starts a new month.
              Opening balances (cash, bank, outstanding, advances) will carry forward.
              Archived data stays in the Recovery folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>No, keep open</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, close month"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// silence unused import if not used
void supabase;
