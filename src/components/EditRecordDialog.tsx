import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export type EditField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date";
};

// Generic edit dialog: loads current values from the row, saves changes back.
export function EditRecordDialog({
  open, onClose, onSaved, table, id, row, fields, title,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  table: string;
  id: string;
  row: Record<string, unknown>;
  fields: EditField[];
  title?: string;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    fields.forEach((f) => {
      const v = row[f.key];
      init[f.key] = v === null || v === undefined ? "" : String(v);
    });
    setValues(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  const save = async () => {
    setSaving(true);
    const patch: Record<string, unknown> = {};
    fields.forEach((f) => {
      const raw = values[f.key] ?? "";
      if (f.type === "number") patch[f.key] = Number(raw) || 0;
      else patch[f.key] = raw.trim() === "" ? null : raw;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(table as any) as any).update(patch).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title ?? t("edit_entry")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-base">{f.label}</Label>
              <Input
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                inputMode={f.type === "number" ? "decimal" : undefined}
                className="h-12 text-base"
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={save} disabled={saving}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
