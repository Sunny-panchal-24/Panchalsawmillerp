import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Wrench,
  FileText,
  Banknote,
  Landmark,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/expenses/new")({
  component: ExpenseNew,
});

type Step =
  | "date"
  | "type"
  | "amount"
  | "description"
  | "payment"
  | "confirm";

type Bank = { id: string; name: string };

function ExpenseNew() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("date");
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [dateMode, setDateMode] = useState<"today" | "manual">("today");
  const [expenseType, setExpenseType] = useState<"maintenance" | "other">("maintenance");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("bank_accounts").select("id, name").eq("is_active", true);
      if (data) setBanks(data as Bank[]);
    })();
  }, []);

  useEffect(() => {
    if (dateMode === "today") {
      setExpenseDate(new Date().toISOString().split("T")[0]);
    }
  }, [dateMode]);

  const stepOrder: Step[] = ["date", "type", "amount", "description", "payment", "confirm"];
  const stepIndex = stepOrder.indexOf(step);

  const nextStep = () => {
    if (stepIndex < stepOrder.length - 1) setStep(stepOrder[stepIndex + 1]);
  };
  const prevStep = () => {
    if (stepIndex > 0) setStep(stepOrder[stepIndex - 1]);
  };

  const canNext = useMemo(() => {
    switch (step) {
      case "date":
        return !!expenseDate;
      case "type":
        return !!expenseType;
      case "amount":
        return !!amount && Number(amount) > 0;
      case "description":
        return true;
      case "payment":
        if (paymentMode === "bank" && !bankAccountId) return false;
        return !!paymentMode;
      default:
        return true;
    }
  }, [step, expenseDate, expenseType, amount, paymentMode, bankAccountId]);

  const handleSave = async () => {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t("error"));
      setSaving(false);
      return;
    }

    const finalPaymentMode = paymentMode === "bank" && bankAccountId
      ? banks.find((b) => b.id === bankAccountId)?.name ?? "bank"
      : paymentMode;

    const { error } = await supabase.from("expenses").insert({
      created_by: user.id,
      expense_date: expenseDate,
      expense_type: expenseType,
      amount: Number(amount),
      payment_mode: finalPaymentMode,
      bank_account_id: paymentMode === "bank" ? bankAccountId : null,
      description: description || null,
    });

    if (error) {
      toast.error(t("error"));
    } else {
      toast.success(t("saved"));
      navigate({ to: "/expenses" });
    }
    setSaving(false);
  };

  const renderStep = () => {
    switch (step) {
      case "date":
        return (
          <div className="space-y-4">
            <h2 className="text-center text-lg font-semibold">{t("date")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setDateMode("today");
                  setExpenseDate(new Date().toISOString().split("T")[0]);
                }}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-all ${
                  dateMode === "today"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <CalendarDays className="h-6 w-6" />
                <span className="font-medium">{t("today_auto")}</span>
              </button>
              <button
                type="button"
                onClick={() => setDateMode("manual")}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-all ${
                  dateMode === "manual"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <CalendarDays className="h-6 w-6" />
                <span className="font-medium">{t("manual_date")}</span>
              </button>
            </div>
            {dateMode === "manual" && (
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            )}
          </div>
        );

      case "type":
        return (
          <div className="space-y-4">
            <h2 className="text-center text-lg font-semibold">{t("expense_type_label")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExpenseType("maintenance")}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-all ${
                  expenseType === "maintenance"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <Wrench className="h-8 w-8 text-amber-600" />
                <span className="font-medium">{t("maintenance")}</span>
              </button>
              <button
                type="button"
                onClick={() => setExpenseType("other")}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-all ${
                  expenseType === "other"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <FileText className="h-8 w-8 text-slate-600" />
                <span className="font-medium">{t("other_expense")}</span>
              </button>
            </div>
          </div>
        );

      case "amount":
        return (
          <div className="space-y-4">
            <h2 className="text-center text-lg font-semibold">{t("amount")}</h2>
            <div className="rounded-2xl border bg-card p-6">
              <Label className="mb-2 block text-sm font-medium">{t("amount")}</Label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg"
              />
            </div>
          </div>
        );

      case "description":
        return (
          <div className="space-y-4">
            <h2 className="text-center text-lg font-semibold">{t("description")}</h2>
            <div className="rounded-2xl border bg-card p-6">
              <Label className="mb-2 block text-sm font-medium">{t("description")} ({t("optional")})</Label>
              <Input
                placeholder={t("expense_description_hint")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        );

      case "payment":
        return (
          <div className="space-y-4">
            <h2 className="text-center text-lg font-semibold">{t("payment_mode")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPaymentMode("cash");
                  setBankAccountId(null);
                }}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-all ${
                  paymentMode === "cash"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <Banknote className="h-7 w-7 text-emerald-600" />
                <span className="font-medium">{t("cash")}</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("bank")}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-all ${
                  paymentMode === "bank"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <Landmark className="h-7 w-7 text-blue-600" />
                <span className="font-medium">{t("bank")}</span>
              </button>
            </div>
            {paymentMode === "bank" && banks.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("select_bank")}</Label>
                <div className="grid gap-2">
                  {banks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBankAccountId(b.id)}
                      className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-all ${
                        bankAccountId === b.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      }`}
                    >
                      <span className="font-medium">{b.name}</span>
                      {bankAccountId === b.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "confirm":
        return (
          <div className="space-y-4">
            <h2 className="text-center text-lg font-semibold">{t("confirm_save")}</h2>
            <div className="rounded-2xl border bg-card p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("date")}</span>
                <span className="font-medium">{new Date(expenseDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("expense_type_label")}</span>
                <span className="font-medium capitalize">
                  {expenseType === "maintenance" ? t("maintenance") : t("other_expense")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("amount")}</span>
                <span className="font-bold">₹{Number(amount).toFixed(2)}</span>
              </div>
              {description ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("description")}</span>
                  <span className="font-medium">{description}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("payment_mode")}</span>
                <span className="font-medium">
                  {paymentMode === "bank" && bankAccountId
                    ? banks.find((b) => b.id === bankAccountId)?.name ?? t("bank")
                    : t("cash")}
                </span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10"
              onClick={() => {
                if (stepIndex === 0) navigate({ to: "/expenses" });
                else prevStep();
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold leading-tight">{t("new_expense")}</h1>
              <p className="text-xs opacity-90">
                {t("step")} {stepIndex + 1} {t("of")} {stepOrder.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6">
          <div className="flex gap-1">
            {stepOrder.map((s, i) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full ${
                  i <= stepIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {renderStep()}

        <div className="mt-8 flex gap-3">
          {step === "confirm" ? (
            <Button
              className="flex-1 h-14 text-lg font-bold"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t("saving") : t("save_expense")}
            </Button>
          ) : (
            <Button
              className="flex-1 h-14 text-lg font-bold"
              onClick={nextStep}
              disabled={!canNext}
            >
              {t("next")} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
