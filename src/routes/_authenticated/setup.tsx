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
import { Building2, User, Phone, MapPin, Wallet, Landmark, CheckCircle2, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup")({
  component: SetupWizard,
});

type Bank = { name: string; opening_balance: string };

type Form = {
  company_name: string;
  owner_name: string;
  mobile: string;
  village: string;
  opening_cash: string;
  banks: Bank[];
};

const EMPTY: Form = {
  company_name: "",
  owner_name: "",
  mobile: "",
  village: "",
  opening_cash: "",
  banks: [],
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
    { key: "company_name", label: t("company_name"), Icon: Building2, required: true },
    { key: "owner_name", label: t("owner_name"), Icon: User, required: true },
    { key: "mobile", label: t("mobile"), Icon: Phone, type: "tel" as const },
    { key: "village", label: t("village_city"), Icon: MapPin },
    { key: "opening_cash", label: t("opening_cash"), Icon: Wallet, type: "number" as const },
    { key: "banks", label: t("opening_bank_balances"), Icon: Landmark, bank: true as const },
  ];

  const total = steps.length;
  const current = steps[step];
  const progress = ((step + 1) / total) * 100;

  const getStr = (k: string): string => (f as unknown as Record<string, string>)[k] ?? "";
  const setStr = (k: string, v: string) => setF({ ...f, [k]: v } as Form);

  const canNext = () => {
    if (current.required) return getStr(current.key).trim().length > 0;
    return true;
  };

  const addBank = () => setF({ ...f, banks: [...f.banks, { name: "", opening_balance: "" }] });
  const removeBank = (i: number) => setF({ ...f, banks: f.banks.filter((_, idx) => idx !== i) });
  const updateBank = (i: number, patch: Partial<Bank>) =>
    setF({ ...f, banks: f.banks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });

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
    });
    if (error) { setSaving(false); return toast.error(error.message); }

    const banks = f.banks
      .filter((b) => b.name.trim().length > 0)
      .map((b) => ({
        owner_id: userId,
        name: b.name.trim(),
        opening_balance: Number(b.opening_balance) || 0,
      }));
    if (banks.length > 0) {
      const { error: bErr } = await supabase.from("bank_accounts").insert(banks);
      if (bErr) { setSaving(false); return toast.error(bErr.message); }
    }

    setSaving(false);
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

          {"bank" in current && current.bank ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("add_bank_hint")}</p>
              {f.banks.map((b, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t("bank")} #{i + 1}</span>
                    <Button size="icon" variant="ghost" onClick={() => removeBank(i)} aria-label={t("delete")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder={t("bank_name")}
                    value={b.name}
                    onChange={(e) => updateBank(i, { name: e.target.value })}
                    className="h-11 text-base"
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder={t("opening_balance")}
                    value={b.opening_balance}
                    onChange={(e) => updateBank(i, { opening_balance: e.target.value })}
                    className="h-11 text-base"
                  />
                </div>
              ))}
              <Button variant="outline" className="w-full h-12" onClick={addBank}>
                <Plus className="mr-2 h-4 w-4" /> {t("add_bank")}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-base">{current.label}</Label>
              <Input
                autoFocus
                type={"type" in current ? current.type : "text"}
                inputMode={"type" in current && current.type === "number" ? "decimal" : "type" in current && current.type === "tel" ? "tel" : undefined}
                value={getStr(current.key)}
                onChange={(e) => setStr(current.key, e.target.value)}
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
