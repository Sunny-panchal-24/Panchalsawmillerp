import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Search, Trash2, Wrench, FileText , Pencil } from "lucide-react";
import { EditRecordDialog } from "@/components/EditRecordDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/expenses/")({
  component: ExpensesIndex,
});

type ExpenseRow = {
  id: string;
  expense_date: string;
  expense_type: "maintenance" | "other";
  amount: number;
  payment_mode: string;
  description: string | null;
};

function ExpensesIndex() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [showChooser, setShowChooser] = useState(false);
  const [list, setList] = useState<ExpenseRow[]>([]);
  const [search, setSearch] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editRow, setEditRow] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("id, expense_date, expense_type, amount, payment_mode, description")
      .order("expense_date", { ascending: false });
    if (error) {
      toast.error(t("error"));
    } else {
      setList((data as ExpenseRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!showChooser) fetchExpenses();
  }, [showChooser]);

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (e) =>
        e.expense_type.toLowerCase().includes(q) ||
        (e.description?.toLowerCase() ?? "").includes(q) ||
        e.payment_mode.toLowerCase().includes(q)
    );
  }, [list, search]);

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirm_delete"))) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error(t("error"));
    } else {
      toast.success(t("deleted"));
      setList((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const totalAmount = useMemo(() => filtered.reduce((sum, e) => sum + Number(e.amount), 0), [filtered]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10"
              onClick={() => {
                if (showChooser) navigate({ to: "/" });
                else setShowChooser(true);
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold leading-tight">{t("expenses")}</h1>
              <p className="text-xs opacity-90">{t("misc_expense")}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {showChooser ? (
          <Dialog open={showChooser} onOpenChange={setShowChooser}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center text-xl">{t("what_do_you_want")}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/expenses/new" })}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border bg-card p-6 text-card-foreground shadow-sm transition-all active:scale-95"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 text-white">
                    <Plus className="h-7 w-7" />
                  </div>
                  <span className="text-center font-semibold">{t("new_expense")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowChooser(false)}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border bg-card p-6 text-card-foreground shadow-sm transition-all active:scale-95"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-600 text-white">
                    <FileText className="h-7 w-7" />
                  </div>
                  <span className="text-center font-semibold">{t("view_expenses")}</span>
                </button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {loading ? (
              <p className="text-center text-muted-foreground">{t("loading")}</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground">{t("no_records")}</p>
            ) : (
              <>
                <div className="mb-3 rounded-xl border bg-card p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("total")}</span>
                    <span className="font-bold">₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {filtered.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-2xl border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {e.expense_type === "maintenance" ? (
                              <Wrench className="h-4 w-4 text-amber-600" />
                            ) : (
                              <FileText className="h-4 w-4 text-slate-600" />
                            )}
                            <span className="truncate font-semibold capitalize">
                              {e.expense_type === "maintenance" ? t("maintenance") : t("other_expense")}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(e.expense_date).toLocaleDateString()} · {e.payment_mode}
                          </p>
                          {e.description ? (
                            <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="font-bold">₹{Number(e.amount).toFixed(2)}</p>
                          <div className="mt-1 flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditRow(e)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(e.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        {editRow && (
          <EditRecordDialog
            open={!!editRow}
            onClose={() => setEditRow(null)}
            onSaved={load}
            table="expenses"
            id={editRow.id}
            row={editRow}
            fields={[
              { key: "expense_date", label: t("date"), type: "date" },
              { key: "amount", label: t("amount"), type: "number" },
              { key: "description", label: t("description") },
            ]}
          />
        )}
      </main>
    </div>
  );
}
