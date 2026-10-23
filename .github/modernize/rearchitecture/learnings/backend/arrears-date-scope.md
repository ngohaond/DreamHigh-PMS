# Arrears Date and Scope

For finance reports on PostgreSQL `DATE` fields, use UTC calendar dates and apply JWT branch scope before reading invoice/payment data.

## What Happened
For DreamHigh D4, `Invoice.dueDate` is `@db.Date`; comparing local timestamps against that value shifts overdue boundaries by timezone. The report compares UTC date boundaries with strict `today > dueDate`, recomputes outstanding from append-only payments, and holds candidate invoices/payment sums in a Repeatable Read transaction so totals and pagination share a snapshot.

## Takeaway
Keep report date inputs as validated `YYYY-MM-DD` values, compare date-only values in UTC, and enforce a requested branch against authenticated `branchIds` before querying. Compute totals over the full filtered result before pagination. If report volume grows, move outstanding/status aggregation into a database-side query without weakening snapshot consistency.

## History
- 2026-10-23 (DreamHigh/D4): initial.