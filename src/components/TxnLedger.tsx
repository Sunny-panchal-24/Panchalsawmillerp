import { Card } from "@/components/ui/card";
import { RowActions } from "@/components/RowActions";

export type TxnItem = {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  amount: number;
  tone?: "in" | "out" | "neutral";
};

// Clickable ledger list: tap a row to open the safe Edit / Delete popup.
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
        <Card key={it.id} className="flex items-center gap-2 p-3">
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
          <RowActions
            title={it.title}
            onEdit={() => onEdit(it.id)}
            onDelete={() => onDelete(it.id)}
          />
        </Card>
      ))}
    </div>
  );
}

