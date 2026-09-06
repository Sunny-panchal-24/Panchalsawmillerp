import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LedgerEntryList } from "@/components/LedgerEntryList";
import { buildEntries, searchEntries, type EntryCategory } from "@/lib/ledger-entries";
import {
  loadRawData, money, periodRange, vendorRows, customerRows, workerRows,
  type PeriodKey, type RawData,
} from "@/lib/summary";
import type { Lists } from "@/lib/edit-fields";

type Cat = EntryCategory | "all" | "vendors" | "customers" | "workers" | "worker_paid";

export const Route = createFileRoute("/_authenticated/ledger-file")({
  validateSearch: (s: Record<string, unknown>) => ({
    cat: (typeof s.cat === "string" ? s.cat : "all") as Cat,
    period: (typeof s.period === "string" ? s.period : "all") as PeriodKey,
  }),
  component: LedgerFile,
});

const CATS: { key: Cat; label: string }[] = [
  { key: "all", label: "all_entries" },
  { key: "vendors", label: "vendors" },
  { key: "customers", label: "customers" },
  { key: "workers", label: "workers" },
  { key: "worker_paid", label: "worker_payments" },
  { key: "purchase", label: "purchases" },
  { key: "waste_sale", label: "waste_wood_sales" },
  { key: "finished_sale", label: "finished_wood_sales" },
  { key: "vendor_payment", label: "vendor_payments" },
  { key: "vendor_advance", label: "vendor_advance" },
  { key: "customer_receipt", label: "customer_receipts" },
  { key: "worker_salary", label: "salary" },
  { key: "worker_advance", label: "worker_advance" },
  { key: "expense", label: "expenses" },
  { key: "adjustment", label: "manual_adjustment" },
];

const PERIODS: PeriodKey[] = ["all", "today", "week", "month", "prev_month", "fy"];
const periodLabel: Record<string, string> = {
  all: "all_time", today: "today", week: "week", month: "month",
  prev_month: "prev_month", fy: "financial_year",
};

function LedgerFile() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { cat, period } = Route.useSearch();
  const [data, setData] = useState<RawData | null>(null);
  const [q, setQ] = useState("");

  const load = () => { loadRawData().then(setData); };
  useEffect(() => { load(); }, []);

  const setCat = (c: Cat) => navigate({ to: "/ledger-file", search: { cat: c, period } });
  const setPeriod = (p: PeriodKey) => navigate({ to: "/ledger-file", search: { cat, period: p } });

  const range = useMemo(() => periodRange(period), [period]);

  const entries = useMemo(() => {
    if (!data) return [];
    let list = buildEntries(data);
    if (cat === "worker_paid") list = list.filter((e) => e.category === "worker_salary" && e.amount > 0);
    else if (!["all", "vendors", "customers", "workers"].includes(cat)) list = list.filter((e) => e.category === cat);
    if (range.from) list = list.filter((e) => e.date >= range.from);
    if (range.to) list = list.filter((e) => e.date <= range.to);
    return searchEntries(list, q);
  }, [data, cat, range, q]);

  const lists: Lists = useMemo(() => ({
    vendors: (data?.vendors ?? []) as Lists["vendors"],
    customers: (data?.customers ?? []) as Lists["customers"],
    workers: (data?.workers ?? []) as Lists["workers"],
    banks: (data?.banks ?? []) as Lists["banks"],
  }), [data]);

  return (
    <AppShell title={t("ledger_file")}>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {PERIODS.map((p) => (
          <Button key={p} size="sm" variant={period === p ? "default" : "outline"} className="shrink-0" onClick={() => setPeriod(p)}>
            {t(periodLabel[p])}
          </Button>
        ))}
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {CATS.map((c) => (
          <Button key={c.key} size="sm" variant={cat === c.key ? "default" : "outline"} className="shrink-0" onClick={() => setCat(c.key)}>
            {t(c.label)}
          </Button>
        ))}
      </div>

      <Input
        className="mb-3 h-12 text-base"
        placeholder={t("search_ledger")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {!data ? (
        <p className="text-center text-muted-foreground">{t("loading")}</p>
      ) : cat === "vendors" ? (
        <PartyList
          rows={vendorRows(data).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))}
          cols={[["purchase_value", "purchaseValue"], ["advance_given", "advanceGiven"], ["advance_adjusted", "advanceAdjusted"], ["paid", "paid"]]}
          onOpen={(id) => navigate({ to: "/vendors/$vendorId/ledger", params: { vendorId: id } })}
          t={t}
        />
      ) : cat === "customers" ? (
        <PartyList
          rows={customerRows(data).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))}
          cols={[["sales_value", "salesValue"], ["received", "received"]]}
          onOpen={(id) => navigate({ to: "/customers/$customerId/ledger", params: { customerId: id } })}
          t={t}
        />
      ) : cat === "workers" ? (
        <PartyList
          rows={workerRows(data).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))}
          cols={[["gross_salary", "gross"], ["extra_work", "extra"], ["advance", "advance"], ["advance_adjusted", "adjusted"], ["paid", "paid"]]}
          onOpen={(id) => navigate({ to: "/workers/$workerId/ledger", params: { workerId: id } })}
          t={t}
        />
      ) : (
        <LedgerEntryList entries={entries} lists={lists} onChanged={load} />
      )}
    </AppShell>
  );
}

type PartyRow = { id: string; name: string; balance: number } & Record<string, unknown>;

function PartyList({
  rows, cols, onOpen, t,
}: {
  rows: PartyRow[];
  cols: [string, string][];
  onOpen: (id: string) => void;
  t: (k: string) => string;
}) {
  if (rows.length === 0) return <p className="py-8 text-center text-muted-foreground">{t("no_records")}</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onOpen(r.id)}
          className="w-full rounded-xl border bg-card p-3 text-left active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-base font-bold">{r.name}</span>
            <span className={`shrink-0 font-bold ${r.balance > 0 ? "text-rose-700" : r.balance < 0 ? "text-emerald-700" : ""}`}>
              {money(Math.abs(r.balance))}{r.balance < 0 ? ` (${t("advance")})` : ""}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {cols.map(([label, key]) => (
              <span key={key}>{t(label)}: {money(Number(r[key] ?? 0))}</span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
