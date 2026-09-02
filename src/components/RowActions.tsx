import { useState, MouseEvent } from "react";
import { MoreVertical, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

/**
 * Safe row actions: one button opens a popup that offers
 * "Edit entry" / "Delete entry", and delete asks for confirmation.
 */
export function RowActions({
  onEdit,
  onDelete,
  title,
  disabled,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const stop = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); };

  return (
    <>
      <Button
        size="icon"
        variant="outline"
        className="h-11 w-11 shrink-0"
        aria-label={t("options")}
        disabled={disabled}
        onClick={(e) => { stop(e); setOpen(true); }}
      >
        <MoreVertical className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirm(false); }}>
        <DialogContent className="max-w-sm" onClick={stop}>
          <DialogHeader>
            <DialogTitle className="text-center text-lg">
              {confirm ? t("confirm_delete") : (title ?? t("what_do_you_want"))}
            </DialogTitle>
          </DialogHeader>

          {confirm ? (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3 rounded-xl border-2 border-destructive/40 bg-destructive/10 p-4">
                <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
                <span className="text-sm font-medium">{t("delete_warning")}</span>
              </div>
              <Button
                variant="destructive"
                className="h-14 w-full text-base font-bold"
                onClick={() => { setOpen(false); setConfirm(false); onDelete?.(); }}
              >
                <Trash2 className="mr-2 h-5 w-5" /> {t("yes_delete")}
              </Button>
              <Button
                variant="secondary"
                className="h-14 w-full text-base font-bold"
                onClick={() => setConfirm(false)}
              >
                {t("cancel")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => { setOpen(false); onEdit(); }}
                  className="flex w-full items-center gap-3 rounded-xl border-2 border-primary bg-primary/10 p-4 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Pencil className="h-6 w-6" />
                  </div>
                  <span className="text-base font-bold">{t("edit_entry")}</span>
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => setConfirm(true)}
                  className="flex w-full items-center gap-3 rounded-xl border-2 border-destructive/50 bg-destructive/5 p-4 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive text-destructive-foreground">
                    <Trash2 className="h-6 w-6" />
                  </div>
                  <span className="text-base font-bold">{t("delete_entry")}</span>
                </button>
              )}
              <Button variant="secondary" className="h-12 w-full" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
