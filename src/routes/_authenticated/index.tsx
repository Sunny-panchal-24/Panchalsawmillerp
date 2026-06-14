import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

const TILES: { key: string; Icon: typeof ShoppingCart; color: string; to: string | null }[] = [
  { key: "purchases", Icon: ShoppingCart, color: "bg-blue-600", to: "/purchases" },
  { key: "waste_wood_sales", Icon: Package, color: "bg-emerald-600", to: "/sales" },
  { key: "finished_wood_sales", Icon: Hammer, color: "bg-amber-600", to: "/sales" },
  { key: "vendor_payments", Icon: Wallet, color: "bg-rose-600", to: null },
  { key: "customer_receipts", Icon: Receipt, color: "bg-violet-600", to: null },
  { key: "workers", Icon: Users, color: "bg-cyan-600", to: "/workers" },
  { key: "expenses", Icon: Receipt, color: "bg-orange-700", to: "/expenses" },
  { key: "cash_book", Icon: BookOpen, color: "bg-orange-500", to: null },
  { key: "bank_book", Icon: Landmark, color: "bg-teal-600", to: null },
  { key: "reports", Icon: BarChart3, color: "bg-indigo-600", to: "/reports" },
  { key: "masters", Icon: SettingsIcon, color: "bg-slate-600", to: "/masters" },
];

function Dashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
    })();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

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

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="grid grid-cols-2 gap-4">
          {TILES.map(({ key, Icon, color, to }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (to) navigate({ to });
                else toast.info(t("coming_soon"));
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
      </main>
    </div>
  );
}
