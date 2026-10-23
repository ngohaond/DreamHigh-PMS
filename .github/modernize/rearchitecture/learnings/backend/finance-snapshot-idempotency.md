# Finance Snapshots and Idempotency

Use invoice snapshots and serialized payment writes to preserve finance history and prevent duplicate or over-limit collection.

## What Happened
For DreamHigh D2, existing invoices and payments had decimal amounts, nullable due dates, no branch snapshot, and no idempotency state. New invoice creation records the fee plan name/base amount and one discount; payment writes lock the invoice row, validate current outstanding, and commit payment, status, and audit together. The fee-plan sequence is atomically reserved before invoice creation so rollback does not reuse a number.

## Takeaway
Keep new VND amounts integral at DTO/service boundaries while preserving existing decimal columns for compatibility. Use decimal arithmetic for percentage calculations, floor only the final discount amount, and persist the exact inputs used on the invoice. A retry key should return the original result for an identical payload and conflict for changed content. Scope external bank references by branch, and never return internal request hashes/keys in payment responses.

## Example (optional)
Payment flow: validate caller scope → lock invoice row → re-read payments → compare idempotency key/hash → reject excess → append payment + update status + write audit in one DB transaction.

## History
- 2026-10-23 (DreamHigh/D2): initial.