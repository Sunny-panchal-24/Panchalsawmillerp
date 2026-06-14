import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, BookOpen, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/about")({
  component: AboutPage,
});

function AboutPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => navigate({ to: "/" })}
            aria-label={t("back")}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-bold">{t("about")}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            {t("about_title")}
          </h2>
        </div>

        {/* Founder Card */}
        <section className="rounded-2xl border-2 border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("founder")}</p>
              <p className="text-lg font-semibold text-foreground">{t("founder_name")}</p>
            </div>
          </div>
        </section>

        {/* Background Card */}
        <section className="rounded-2xl border-2 border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <BookOpen className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t("background")}</h3>
          </div>
          <p className="text-base leading-relaxed text-foreground">
            {t("background_text")}
          </p>
        </section>

        {/* Mission Card */}
        <section className="rounded-2xl border-2 border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-600 text-white">
              <Target className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t("mission")}</h3>
          </div>
          <p className="text-base leading-relaxed text-foreground">
            {t("mission_text")}
          </p>
        </section>
      </main>
    </div>
  );
}
