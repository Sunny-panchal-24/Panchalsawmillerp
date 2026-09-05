import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { RowActions } from "@/components/RowActions";
import { EditRecordDialog } from "@/components/EditRecordDialog";
import { editFieldsFor, type Lists } from "@/lib/edit-fields";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/summary";
import type { LedgerEntry } from "@/lib/ledger-entries";

/** Uniform ledger list: every row shows date, serial, name, type, description,
 *  amount, mode and remarks, and opens View / Edit / Delete. */
export function LedgerEntryList({
  entries, lists, onChanged,
}: {
  entries: LedgerEntry[];
  lists: Lists;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [view, setView] = useState<LedgerEntry | null>(null);
  const [edit, setEdit] = useState<LedgerEntry | null>(null);

  const openEdit = (e: LedgerEntry) => {
    setView(null);
    if (e.wizard === "purchase") return navigate({ to: "/purchases/new", search: { id: e.id } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (e.wizard === "sale") return navigate({ to: "/sales/new", search: { id: e.id, type: (e.saleType ?? "waste") as any } });
    setEdit(e);
  };

  const remove = async (e: LedgerEntry) => {
    setView(null);
    if (e.table === "sales") await supabase.from("customer_receipts").delete().eq("sale_id", e.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(e.table as any) as any).delete().eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted"));
    onChanged();
  };

  if (entries.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">{t("no_records")}</p>;
  }

  return (
    <>
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.key} className="flex items-center gap-2 rounded-xl border bg-card p-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setView(e)}>
              <div className="flex flex-wrap items-center gap-x-2 text-sm font-bold">
                <span>{t(e.typeLabelKey)}</span>
                {e.serial && <span className="text-xs font-mono text-muted-foreground">{e.serial}</span>}
              </div>
              <div className="truncate text-sm">{e.name}{e.description ? ` · ${e.description}` : ""}</div>
              <div className="text-xs text-muted-foreground">{e.date} · {e.mode}{e.remarks ? ` · ${e.remarks}` : ""}</div>
            </button>
            <div className="shrink-0 text-right font-bold">{money(e.amount)}</div>
            <RowActions title={t(e.typeLabelKey)} onEdit={() => openEdit(e)} onDelete={() => remove(e)} />
          </div>
        ))}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("entry_details")}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-2 text-base">
              <Detail label={t("entry_no")} value={view.serial || "-"} />
              <Detail label={t("date")} value={view.date} />
              <Detail label={t("type")} value={t(view.typeLabelKey)} />
              <Detail label={t("name")} value={view.name} />
              {view.qty !== undefined && <Detail label={t("quantity")} value={`${view.qty} ${view.unit ?? ""}`} />}
              <Detail label={t("description")} value={view.description || "-"} />
              <Detail label={t("amount")} value={money(view.amount)} />
              <Detail label={t("payment_mode")} value={view.mode} />
              <Detail label={t("remarks")} value={view.remarks || "-"} />
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Button className="h-12" onClick={() => openEdit(view)}>{t("edit")}</Button>
                <Button className="h-12" variant="destructive" onClick={() => remove(view)}>{t("delete")}</Button>
                <Button className="h-12" variant="secondary" onClick={() => setView(null)}>{t("back")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {edit && (
        <EditRecordDialog
          open={!!edit}
          onClose={() => setEdit(null)}
          onSaved={onChanged}
          table={edit.table}
          id={edit.id}
          row={edit.row}
          fields={editFieldsFor(edit.table, t, lists).fields}
          derive={editFieldsFor(edit.table, t, lists).derive}
          title={t(edit.typeLabelKey)}
        />
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
