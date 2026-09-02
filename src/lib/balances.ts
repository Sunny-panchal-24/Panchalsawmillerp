// Single-balance model: advances are simply negative outstanding, never a
// separate bucket. Tractor (transport) cost is NEVER part of vendor balance —
// it is a sawmill transportation expense paid to the driver, though it still
// counts inside raw-material cost for profit.

export type VendorBalanceInput = {
  opening_balance?: number | null;
  opening_advance?: number | null;
  purchases: { vendor_payable?: number | null; advance_deducted?: number | null; paid_amount?: number | null }[];
  payments: { amount?: number | null }[];
  advances: { amount?: number | null }[];
};

const n = (v: unknown) => Number(v ?? 0) || 0;

/** Positive = we owe the vendor. Negative = vendor holds our advance. */
export function vendorBalance(i: VendorBalanceInput) {
  // Charge = material value after deductions, BEFORE advance adjustment
  // (the advance itself is credited separately so it is never counted twice).
  const charge = i.purchases.reduce((s, p) => s + n(p.vendor_payable) + n(p.advance_deducted), 0);
  const purchasePaid = i.purchases.reduce((s, p) => s + n(p.paid_amount), 0);
  const payments = i.payments.reduce((s, p) => s + n(p.amount), 0);
  const advances = i.advances.reduce((s, a) => s + n(a.amount), 0);
  return n(i.opening_balance) - n(i.opening_advance) + charge - purchasePaid - payments - advances;
}

/** Positive = we owe the worker (pending salary). Negative = worker holds advance. */
export function workerBalance(i: {
  opening_advance?: number | null;
  salaries: { gross_salary?: number | null; extra_work?: number | null; paid_amount?: number | null }[];
  advances: { amount?: number | null }[];
}) {
  const earned = i.salaries.reduce((s, x) => s + n(x.gross_salary) + n(x.extra_work), 0);
  const paid = i.salaries.reduce((s, x) => s + n(x.paid_amount), 0);
  const advances = i.advances.reduce((s, x) => s + n(x.amount), 0);
  return earned - paid - advances - n(i.opening_advance);
}

/** Positive = customer owes us (credit sale). Negative = customer advance. */
export function customerBalance(i: {
  opening_balance?: number | null;
  sales: { total_amount?: number | null; paid_amount?: number | null }[];
  receipts: { amount?: number | null }[];
}) {
  const billed = i.sales.reduce((s, x) => s + n(x.total_amount), 0);
  const paid = i.sales.reduce((s, x) => s + n(x.paid_amount), 0);
  const receipts = i.receipts.reduce((s, x) => s + n(x.amount), 0);
  return n(i.opening_balance) + billed - paid - receipts;
}
