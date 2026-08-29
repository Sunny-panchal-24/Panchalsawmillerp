import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export function AdjustmentDialog({
  open, onClose, onSaved, bankAccountId, title,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  bankAccountId?: string | null;
  title?: string;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [dir, setDir] = useState<"in" | "out">("in");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amt = Number(amount);
    if (!amt) return toast.error(t("amount"));
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("manual_adjustments").insert({
      created_by: auth.user!.id,
      adjust_date: date,
      amount: dir === "in" ? Math.abs(amt) : -Math.abs(amt),
      bank_account_id: bankAccountId ?? null,
      reason: reason || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("saved") || "Saved");
    setAmount(""); setReason("");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title ?? t("manual_adjustment")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("date")}</Label>
            <Input type="date" className="h-12" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" className="h-12" variant={dir === "in" ? "default" : "outline"} onClick={() => setDir("in")}>+ {t("money_in")}</Button>
            <Button type="button" className="h-12" variant={dir === "out" ? "default" : "outline"} onClick={() => setDir("out")}>- {t("money_out")}</Button>
          </div>
          <div>
            <Label>{t("amount")}</Label>
            <Input type="number" inputMode="decimal" className="h-12" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>{t("remarks")}</Label>
            <Input className="h-12" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button disabled={saving} onClick={save}>{saving ? "..." : t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
