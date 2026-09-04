import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RowActions } from "@/components/RowActions";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {  } from "lucide-react";
import { EditRecordDialog } from "@/components/EditRecordDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/workers/$workerId/ledger")({
  component: WorkerLedger,
});

type Entry = {
  id: string;
  source: "salary" | "advance" | "opening";
  date: string;
  description: string;
  debit: number; // owed to worker
  credit: number; // paid / advance given
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
};

function WorkerLedger() {
  const { workerId } = Route.useParams();
  const [name, setName] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState<Entry | null>(null);

  const load = async () => {
    setLoading(true);
    const [w, s, a] = await Promise.all([
      supabase.from("workers").select("name,opening_advance").eq("id", workerId).maybeSingle(),
      supabase.from("worker_salaries").select("*").eq("worker_id", workerId).order("created_at"),
      supabase.from("worker_advances").select("*").eq("worker_id", workerId).order("advance_date"),
    ]);
    setName(w.data?.name ?? "");
    const items: Entry[] = [];
    const opening = Number(w.data?.opening_advance ?? 0);
    if (opening > 0) {
      items.push({ id: "opening", source: "opening", date: "—", description: "Opening Advance", debit: 0, credit: opening });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s.data ?? []).forEach((r: any) => {
      const date = r.period_end ?? r.created_at?.slice(0, 10) ?? "";
      items.push({
        id: r.id,
        source: "salary",
        date,
        description: `Salary ${r.period_label} (${r.present_days}d × ₹${Number(r.daily_wage).toFixed(0)}${Number(r.extra_work ?? 0) > 0 ? ` + Extra ₹${Number(r.extra_work).toFixed(0)}` : ""})`,
        debit: Number(r.gross_salary) + Number(r.extra_work ?? 0),
        credit: Number(r.advance_deducted) + Number(r.paid_amount),
        raw: r,
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a.data ?? []).forEach((r: any) => {
      items.push({
        id: r.id,
        source: "advance",
        date: r.advance_date,
        description: `Advance (${r.payment_mode})`,
        debit: 0,
        credit: Number(r.amount),
        raw: r,
      });
    });
    items.sort((x, y) => (x.date < y.date ? -1 : 1));
    setEntries(items);
    setLoading(false);
  };

  useEffect(() => { load(); }, [workerId]);

  const withBalance = useMemo(() => {
    let bal = 0;
    return entries.map((e) => {
      // balance = worker owes us if positive (advance > salary)
      // worker credit − debit
      bal += e.credit - e.debit;
      return { ...e, balance: bal };
    });
  }, [entries]);

  const finalBal = withBalance.at(-1)?.balance ?? 0;

  const del = async (e: Entry) => {
    if (e.source === "opening") return;
    const table = e.source === "salary" ? "worker_salaries" : "worker_advances";
    const { error } = await supabase.from(table).delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <AppShell title={`Ledger — ${name}`} backTo="/workers">
      <div className="mb-3 rounded-lg border bg-card p-3">
        <div className="text-sm text-muted-foreground">Current Balance</div>
        <div className={`text-xl font-bold ${finalBal > 0 ? "text-rose-600" : finalBal < 0 ? "text-emerald-600" : ""}`}>
          {finalBal > 0 ? `Worker owes ₹${finalBal.toFixed(2)} (unadjusted advance)` : finalBal < 0 ? `We owe ₹${Math.abs(finalBal).toFixed(2)} (pending salary)` : "Settled"}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">Loading...</div>
      ) : withBalance.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">No entries</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 whitespace-nowrap">Date</th>
                <th className="p-2 whitespace-nowrap">Description</th>
                <th className="p-2 text-right whitespace-nowrap">Salary/Extra</th>
                <th className="p-2 text-right whitespace-nowrap">Paid/Advance</th>
                <th className="p-2 text-right whitespace-nowrap">Balance</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {withBalance.map((e) => (
                <tr key={`${e.source}-${e.id}`} className="border-b">
                  <td className="p-2 whitespace-nowrap">{e.date}</td>
                  <td className="p-2">{e.description}</td>
                  <td className="p-2 text-right whitespace-nowrap">{e.debit > 0 ? `₹${e.debit.toFixed(2)}` : "—"}</td>
                  <td className="p-2 text-right whitespace-nowrap">{e.credit > 0 ? `₹${e.credit.toFixed(2)}` : "—"}</td>
                  <td className="p-2 text-right whitespace-nowrap font-medium">₹{e.balance.toFixed(2)}</td>
                  <td className="p-2">
                    {e.source !== "opening" && (
                      <div className="flex gap-1">
                        <RowActions onEdit={() => setEditRow(e)} onDelete={() => del(e)} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editRow && (
        <EditRecordDialog
          open={!!editRow}
          onClose={() => setEditRow(null)}
          onSaved={load}
          table={editRow.source === "salary" ? "worker_salaries" : "worker_advances"}
          id={editRow.id}
          row={editRow.raw ?? {}}
          fields={editRow.source === "salary" ? [
            { key: "present_days", label: "Present Days", type: "number" },
            { key: "daily_wage", label: "Daily Wage", type: "number" },
            { key: "extra_work", label: "Extra Work", type: "number" },
            { key: "advance_deducted", label: "Advance Deducted", type: "number" },
            { key: "paid_amount", label: "Paid Amount", type: "number" },
          ] : [
            { key: "advance_date", label: "Date", type: "date" },
            { key: "amount", label: "Amount", type: "number" },
            { key: "notes", label: "Notes" },
          ]}
        />
      )}
    </AppShell>
  );
}
