import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

interface AppShellProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  backTo?: string;
}

export function AppShell({ title, children, action, backTo = "/" }: AppShellProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="secondary"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={() => navigate({ to: backTo })}
              aria-label={t("back")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={() => navigate({ to: "/" })}
              aria-label={t("home")}
            >
              <Home className="h-5 w-5" />
            </Button>
            <h1 className="truncate text-lg font-bold">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {action}
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 py-4">{children}</main>
    </div>
  );
}
