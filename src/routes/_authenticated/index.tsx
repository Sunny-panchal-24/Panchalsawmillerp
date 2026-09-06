import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShoppingCart,
  Package,
  Hammer,
  Wallet,
  Receipt,
  Users,
  BookOpen,
  Landmark,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Info,
  FolderArchive,
  Shield,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  computeSummary, loadRawData, money, periodRange,
  type PeriodKey, type RawData, type Summary,
} from "@/lib/summary";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

const TILES: { key: string; Icon: typeof ShoppingCart; color: string; to: string | null }[] = [
  { key: "purchases", Icon: ShoppingCart, color: "bg-blue-600", to: "/purchases" },
  { key: "waste_wood_sales", Icon: Package, color: "bg-emerald-600", to: "/sales/new?type=waste" },
  { key: "finished_wood_sales", Icon: Hammer, color: "bg-amber-600", to: "/sales/new?type=finished" },
  { key: "vendor_payments", Icon: Wallet, color: "bg-rose-600", to: "/vendor-payments" },
  { key: "customer_receipts", Icon: Receipt, color: "bg-violet-600", to: "/customer-receipts" },
  { key: "workers", Icon: Users, color: "bg-cyan-600", to: "/workers" },
  { key: "expenses", Icon: Receipt, color: "bg-orange-700", to: "/expenses" },
  { key: "ledger_file", Icon: FileText, color: "bg-fuchsia-700", to: "/ledger-file" },
  { key: "cash_book", Icon: BookOpen, color: "bg-orange-500", to: "/cash-book" },
  { key: "bank_book", Icon: Landmark, color: "bg-teal-600", to: "/bank-book" },
  { key: "reports", Icon: BarChart3, color: "bg-indigo-600", to: "/reports" },
  { key: "masters", Icon: SettingsIcon, color: "bg-slate-600", to: "/masters" },
  { key: "monthly_export", Icon: FileSpreadsheet, color: "bg-green-700", to: "/reports/monthly-export" },
  { key: "recovery", Icon: FolderArchive, color: "bg-yellow-700", to: "/recovery" },
  { key: "admin", Icon: Shield, color: "bg-red-700", to: "/admin" },
  { key: "about", Icon: Info, color: "bg-sky-600", to: "/about" },
];

const PERIODS: PeriodKey[] = ["today", "yesterday", "week", "month", "prev_month", "fy", "custom"];
const periodLabel: Record<string, string> = {
  today: "today", yesterday: "yesterday", week: "week", month: "month",
  prev_month: "prev_month", fy: "financial_year", custom: "custom",
};

function Dashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<RawData | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user;
      if (!user) return;
      const [{ data: roles }, { data: company }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("company_settings").select("id").limit(1).maybeSingle(),
      ]);
      const isOwner = roles?.some((r) => r.role === "owner");
      if (isOwner && !company) {
        navigate({ to: "/setup", replace: true });
        return;
      }
      setReady(true);
      loadRawData().then(setData);
    })();
  }, [navigate]);

  const summary: Summary | null = useMemo(() => {
    if (!data) return null;
    return computeSummary(data, periodRange(period, { from, to }));
  }, [data, period, from, to]);

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    navigate({ to: "/auth", replace: true });
  };

  const goLedger = (cat: string) =>
    navigate({ to: "/ledger-file", search: { cat, period } as never });

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-xl font-bold leading-tight">{t("app_name")}</h1>
            <p className="text-xs opacity-90">{t("dashboard")}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12"
              onClick={() => {
                handleSignOut().catch(() => toast.error("Error"));
              }}
              aria-label={t("sign_out")}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 space-y-6">
        {/* Period filter */}
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t("period")}</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {PERIODS.map((p) => (
              <Button
                key={p}
                variant={period === p ? "default" : "outline"}
                className="h-11 shrink-0 text-base"
                onClick={() => setPeriod(p)}
              >
                {t(periodLabel[p])}
              </Button>
            ))}
          </div>
          {period === "custom" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input type="date" className="h-12" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" className="h-12" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          )}
        </section>

        {/* Material summary — swipeable */}
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t("material_summary")} · {t("period_activity")}
          </h2>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
            <MaterialCard
              title={t("material_purchased")}
              qty={`${fmtQty(summary?.purchasedMan)} MAN`}
              value={summary ? money(summary.purchaseValue) : "…"}
              color="bg-blue-600"
              onClick={() => goLedger("purchase")}
            />
            <MaterialCard
              title={t("waste_material_sold")}
              qty={`${fmtQty(summary?.wasteKg)} KG`}
              value={summary ? money(summary.wasteValue) : "…"}
              color="bg-emerald-600"
              onClick={() => goLedger("waste_sale")}
            />
            <MaterialCard
              title={t("finished_material_sold")}
              qty={`${fmtQty(summary?.finishedCft)} CFT`}
              value={summary ? money(summary.finishedValue) : "…"}
              color="bg-amber-600"
              onClick={() => goLedger("finished_sale")}
            />
          </div>
        </section>

        {/* Money position */}
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t("money_position")} · {t("current_balance_note")}
          </h2>
          <button
            type="button"
            onClick={() => navigate({ to: "/cash-book" })}
            className="w-full rounded-2xl border-2 border-primary bg-primary/10 p-5 text-left active:scale-[0.99]"
          >
            <div className="text-base font-semibold">{t("total_in_hand")}</div>
            <div className="text-4xl font-extrabold">{summary ? money(summary.totalInHand) : "…"}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniStat label={t("cash")} value={summary ? money(summary.cash) : "…"} />
              {(summary?.bankBalances ?? []).map((b) => (
                <MiniStat key={b.id} label={b.name} value={money(b.balance)} />
              ))}
            </div>
          </button>
        </section>

        {/* Outstanding */}
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t("outstanding")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <BigStat label={t("vendor_payable")} value={summary ? money(summary.vendorPayable) : "…"} tone="rose" onClick={() => goLedger("vendors")} />
            <BigStat label={t("customer_outstanding")} value={summary ? money(summary.customerOutstanding) : "…"} tone="emerald" onClick={() => goLedger("customers")} />
            <BigStat label={t("worker_payable")} value={summary ? money(summary.workerPayable) : "…"} tone="rose" onClick={() => goLedger("workers")} />
            <BigStat label={`${t("worker_paid")} · ${t("period_activity")}`} value={summary ? money(summary.workerPaid) : "…"} tone="slate" onClick={() => goLedger("worker_paid")} />
          </div>
        </section>

        {/* Modules */}
        <section>
          <div className="grid grid-cols-2 gap-4">
            {TILES.map(({ key, Icon, color, to }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (!to) return toast.info(t("coming_soon"));
                  const [path, qs] = to.split("?");
                  const search = qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined;
                  navigate({ to: path, search } as never);
                }}
                className="group flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border bg-card p-4 text-card-foreground shadow-sm transition-all active:scale-95 active:shadow-inner"
              >
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-white ${color}`}>
                  <Icon className="h-9 w-9" strokeWidth={2.5} />
                </div>
                <span className="text-center text-base font-semibold leading-tight">
                  {t(key)}
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

const fmtQty = (v: number | undefined) =>
  v === undefined ? "…" : Math.round(v * 100) / 100 === 0 ? "0" : (Math.round(v * 100) / 100).toLocaleString("en-IN");

function MaterialCard({
  title, qty, value, color, onClick,
}: { title: string; qty: string; value: string; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[78%] snap-center rounded-2xl p-5 text-left text-white shadow-md active:scale-[0.98] ${color}`}
    >
      <div className="text-base font-semibold opacity-90">{title}</div>
      <div className="mt-2 text-3xl font-extrabold leading-tight">{qty}</div>
      <div className="text-2xl font-bold">{value}</div>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground truncate">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function BigStat({
  label, value, tone, onClick,
}: { label: string; value: string; tone: "rose" | "emerald" | "slate"; onClick: () => void }) {
  const toneCls =
    tone === "rose" ? "text-rose-700 border-rose-300" :
    tone === "emerald" ? "text-emerald-700 border-emerald-300" :
    "text-slate-700 border-slate-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border-2 bg-card p-4 text-left active:scale-[0.98] ${toneCls}`}
    >
      <div className="text-sm font-semibold text-foreground leading-tight">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </button>
  );
}
