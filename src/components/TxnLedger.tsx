import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type TxnItem = {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  amount: number;
  tone?: "in" | "out" | "neutral";
};

// Clickable ledger list: tap a row (or the pencil) to edit, trash to delete.
export function TxnLedger({
  items,
  onEdit,
  onDelete,
  emptyText = "No transactions",
}: {
  items: TxnItem[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <Card className="p-4 text-center text-sm text-muted-foreground">{emptyText}</Card>;
  }
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <Card
          key={it.id}
          role="button"
          tabIndex={0}
          onClick={() => onEdit(it.id)}
          onKeyDown={(e) => { if (e.key === "Enter") onEdit(it.id); }}
          className="flex items-center gap-2 p-3 active:scale-[0.99] transition-transform cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{it.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {it.date}{it.subtitle ? ` · ${it.subtitle}` : ""}
            </div>
          </div>
          <div
            className={`shrink-0 text-sm font-bold ${
              it.tone === "in" ? "text-emerald-700" : it.tone === "out" ? "text-rose-700" : ""
            }`}
          >
            ₹{Number(it.amount || 0).toFixed(2)}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            aria-label="Edit"
            onClick={(e) => { e.stopPropagation(); onEdit(it.id); }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 text-red-600"
            aria-label="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(it.id); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </Card>
      ))}
    </div>
  );
}
