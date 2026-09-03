import type { EditField } from "@/components/EditRecordDialog";

export type Named = { id: string; name: string };
export type Lists = {
  vendors?: Named[];
  customers?: Named[];
  workers?: Named[];
  banks?: Named[];
};

type T = (k: string) => string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Patch = Record<string, any>;

export type FieldSet = {
  fields: EditField[];
  derive?: (patch: Patch) => Patch;
};

const opts = (list: Named[] | undefined) => (list ?? []).map((x) => ({ value: x.id, label: x.name }));

/** Cash / bank target as one select: empty value = cash. */
const target = (t: T, banks?: Named[]): EditField => ({
  key: "bank_account_id",
  label: t("payment_mode"),
  type: "select",
  options: [{ value: "", label: t("cash") }, ...opts(banks)],
});

const num = (v: unknown) => Number(v ?? 0) || 0;

/** Full editable field set for every non-wizard transaction table. */
export function editFieldsFor(table: string, t: T, lists: Lists): FieldSet {
  switch (table) {
    case "vendor_payments":
      return {
        fields: [
          { key: "vendor_id", label: t("vendor"), type: "select", options: opts(lists.vendors) },
          { key: "payment_date", label: t("date"), type: "date" },
          { key: "amount", label: t("amount"), type: "number" },
          target(t, lists.banks),
          { key: "remarks", label: t("remarks") },
        ],
      };
    case "customer_receipts":
      return {
        fields: [
          { key: "customer_id", label: t("customer"), type: "select", options: opts(lists.customers) },
          { key: "receipt_date", label: t("date"), type: "date" },
          { key: "amount", label: t("amount"), type: "number" },
          target(t, lists.banks),
          { key: "remarks", label: t("remarks") },
        ],
        derive: (p) => ({ ...p, mode: p.bank_account_id ? "bank" : "cash" }),
      };
    case "expenses":
      return {
        fields: [
          { key: "expense_date", label: t("date"), type: "date" },
          {
            key: "expense_type", label: t("expense_type"), type: "select",
            options: [
              { value: "maintenance", label: t("maintenance") },
              { value: "other", label: t("other_expense") },
            ],
          },
          { key: "amount", label: t("amount"), type: "number" },
          target(t, lists.banks),
          { key: "description", label: t("description") },
        ],
        derive: (p) => ({ ...p, payment_mode: p.bank_account_id ? "bank" : "cash" }),
      };
    case "worker_advances":
      return {
        fields: [
          { key: "worker_id", label: t("worker"), type: "select", options: opts(lists.workers) },
          { key: "advance_date", label: t("date"), type: "date" },
          { key: "amount", label: t("amount"), type: "number" },
          target(t, lists.banks),
          { key: "notes", label: t("remarks") },
        ],
        derive: (p) => ({ ...p, payment_mode: p.bank_account_id ? "bank" : "cash" }),
      };
    case "worker_salaries":
      return {
        fields: [
          { key: "worker_id", label: t("worker"), type: "select", options: opts(lists.workers) },
          { key: "period_label", label: t("period") },
          { key: "period_start", label: t("from"), type: "date" },
          { key: "period_end", label: t("to"), type: "date" },
          { key: "present_days", label: t("present_days"), type: "number" },
          { key: "daily_wage", label: t("daily_wage"), type: "number" },
          { key: "extra_work", label: t("extra_work"), type: "number" },
          { key: "advance_deducted", label: t("advance_deducted"), type: "number" },
          { key: "paid_amount", label: t("paid_amount"), type: "number" },
          target(t, lists.banks),
          { key: "notes", label: t("remarks") },
        ],
        // recompute totals so ledgers stay correct after an edit
        derive: (p) => {
          const gross = num(p.present_days) * num(p.daily_wage);
          const net = gross + num(p.extra_work) - num(p.advance_deducted);
          return {
            ...p,
            gross_salary: gross,
            net_payable: net,
            outstanding: net - num(p.paid_amount),
            payment_mode: p.bank_account_id ? "bank" : "cash",
          };
        },
      };
    case "vendor_advances":
      return {
        fields: [
          { key: "vendor_id", label: t("vendor"), type: "select", options: opts(lists.vendors) },
          { key: "advance_date", label: t("date"), type: "date" },
          { key: "amount", label: t("amount"), type: "number" },
          target(t, lists.banks),
          { key: "remarks", label: t("remarks") },
        ],
      };
    case "manual_adjustments":
      return {
        fields: [
          { key: "adjust_date", label: t("date"), type: "date" },
          { key: "amount", label: t("amount"), type: "number" },
          target(t, lists.banks),
          { key: "reason", label: t("remarks") },
        ],
      };
    default:
      return { fields: [] };
  }
}
