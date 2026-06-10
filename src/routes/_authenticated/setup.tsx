import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Building2, User, Phone, MapPin, Wallet, Landmark, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup")({
  component: SetupWizard,
});

type Form = {
  company_name: string;
  owner_name: string;
  mobile: string;
  village: string;
  opening_cash: string;
  opening_dad_saving: string;
  opening_dad_current: string;
  opening_sunny_saving: string;
};

const EMPTY: Form = {
  company_name: "",
  owner_name: "",
  mobile: "",
  village: "",
  opening_cash: "",
  opening_dad_saving: "",
  opening_dad_current: "",
  opening_sunny_saving: "",
};

function SetupWizard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("company_settings")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) navigate({ to: "/", replace: true });
    })();
  }, [navigate]);

  const steps = [
    { key: "company_name", label: t("company_name"), Icon: Building2, value: f.company_name, set: (v: string) => setF({ ...f, company_name: v }), required: true },
    { key: "owner_name", label: t("owner_name"), Icon: User, value: f.owner_name, set: (v: string) => setF({ ...f, owner_name: v }), required: true },
    { key: "mobile", label: t("mobile"), Icon: Phone, value: f.mobile, set: (v: string) => setF({ ...f, mobile: v }), type: "tel" },
    { key: "village", label: t("village_city"), Icon: MapPin, value: f.village, set: (v: string) => setF({ ...f, village: v }) },
    { key: "opening_cash", label: t("opening_cash"), Icon: Wallet, value: f.opening_cash, set: (v: string) => setF({ ...f, opening_cash: v }), type: "number" },
    { key: "banks", label: t("opening_bank_balances"), Icon: Landmark, bank: true },
  ] as const;

  const total = steps.length;
  const current = steps[step];
  const progress = ((step + 1) / total) * 100;

  const canNext = () => {
    if ("required" in current && current.required) {
      return ("value" in current ? current.value : "").trim().length > 0;
    }
    return true;
  };

  const onNext = () => {
    if (!canNext()) return toast.error(t("required"));
    if (step < total - 1) setStep(step + 1);
    else void save();
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("company_settings").insert({
      owner_id: userId,
      company_name: f.company_name.trim(),
      owner_name: f.owner_name.trim(),
      mobile: f.mobile.trim() || null,
      village: f.village.trim() || null,
      opening_cash: Number(f.opening_cash) || 0,
      opening_dad_saving: Number(f.opening_dad_saving) || 0,
      opening_dad_current: Number(f.opening_dad_current) || 0,
      opening_sunny_saving: Number(f.opening_sunny_saving) || 0,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("setup_complete"));
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold">{t("company_setup")}</h1>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("step")} {step + 1} {t("of")} {total}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {step === 0 && (
          <p className="text-base text-muted-foreground">{t("setup_intro")}</p>
        )}

        <div className="rounded-2xl border-2 border-border bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <current.Icon className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-bold">{current.label}</h2>
          </div>

          {"bank" in current ? (
            <div className="space-y-4">
              <BankField label={t("dad_saving")} value={f.opening_dad_saving} onChange={(v) => setF({ ...f, opening_dad_saving: v })} />
              <BankField label={t("dad_current")} value={f.opening_dad_current} onChange={(v) => setF({ ...f, opening_dad_current: v })} />
              <BankField label={t("sunny_saving")} value={f.opening_sunny_saving} onChange={(v) => setF({ ...f, opening_sunny_saving: v })} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-base">{current.label}</Label>
              <Input
                autoFocus
                type={"type" in current ? current.type : "text"}
                inputMode={"type" in current && current.type === "number" ? "decimal" : "type" in current && current.type === "tel" ? "tel" : undefined}
                value={current.value}
                onChange={(e) => current.set(e.target.value)}
                className="h-14 text-lg"
                placeholder={current.label}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-14 text-base"
            disabled={step === 0 || saving}
            onClick={() => setStep(Math.max(0, step - 1))}
          >
            {t("previous")}
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 text-base"
            disabled={saving}
            onClick={onNext}
          >
            {step === total - 1 ? (
              <span className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> {t("finish")}</span>
            ) : (
              t("next")
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}

function BankField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-base">{label}</Label>
      <Input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="h-12 text-base" placeholder="0" />
    </div>
  );
}
