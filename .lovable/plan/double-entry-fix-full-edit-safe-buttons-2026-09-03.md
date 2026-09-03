# Double Entry Fix + Full Edit + Safe Buttons

## Problem 1: Ek payment, do entry (confirmed)

When a purchase is saved with "Pay Now", the app writes the payment twice:
- inside the purchase record (`paid_amount`), and
- as a separate Vendor Payment row linked to that purchase.

The database currently holds 2 such duplicate vendor-payment rows and 1 duplicate
customer-receipt row (created the same way from a sale with payment).

Because Cash Book, Bank Book, vendor/customer balances and reports count both, every
purchase/sale payment is being counted twice — cash out and outstanding are wrong.

### Fix
- Purchase wizard: stop creating the mirror Vendor Payment row. The payment lives only on
  the purchase entry, shown with the purchase serial number (e.g. `2026-Sep-P-3`).
- Sales wizard: stop creating the mirror Customer Receipt row for inline payment; it stays on
  the sale entry with the sale serial number.
- Standalone Vendor Payment / Customer Receipt wizards stay as-is (they are separate real payments).
- One-time cleanup: delete the existing linked mirror rows (2 vendor payments, 1 receipt) so old
  data stops double-counting.
- Verify after the change: Cash Book, Bank Book, vendor ledger, customer ledger and reports
  each show exactly one line per payment.

## Problem 2: Edit only shows amount/name/remarks

Today the Cash Book / Bank Book edit popup only exposes 2-3 fields.

### Fix
Tapping any entry opens the same full wizard/form used when creating it, pre-filled:
- Purchase and Sale entries: open their full wizards (already supported).
- Vendor Payment, Customer Receipt, Expense, Worker Advance, Worker Salary, Vendor Advance,
  Manual Adjustment: full edit form with every field captured at entry time — party (vendor/
  customer/worker), date, amount, payment mode + bank account, entry no, description/remarks,
  and for salary: present days, wage, extra work, advance deducted, paid amount.
- Payment mode changes move the entry between Cash Book and Bank Book correctly.
- After save, all lists, ledgers and books re-read from the database, so balances update everywhere.

## Problem 3: Buttons not done yet

- Home button in the top bar of every page (next to Back), so the user can always return to the
  dashboard; also fix the Expenses back button.
- Replace direct pencil/trash icons everywhere with the safe options popup already built
  (`RowActions`): tap an entry -> "Edit Entry" / "Delete Entry", and delete asks for confirmation.
  Applies to: Cash Book, Bank Book, report ledgers, purchases, sales, vendor payments,
  customer receipts, expenses, workers (advance/salary), masters.
- Deleting a purchase/sale removes it in one place only (no orphan payment rows left behind).

## Technical notes

- Remove the `vendor_payments` insert in `purchases.new.tsx` and the `customer_receipts` insert in
  `sales.new.tsx`; keep the existing linked-row cleanup on edit/delete for legacy data.
- `src/lib/balances.ts` already subtracts both `purchases.paid_amount` and vendor payments — with
  mirrors gone this becomes correct; no formula change needed.
- Cash/Bank Book will also defensively skip any `vendor_payments.purchase_id` /
  `customer_receipts.sale_id` linked rows.
- Extend `EditRecordDialog` to support select fields (vendor/customer/worker/bank/mode) and
  per-table full field maps; keep wizard routing for purchases and sales.
- Add Home action to `AppShell`; wire `RowActions` into all list/ledger surfaces.
