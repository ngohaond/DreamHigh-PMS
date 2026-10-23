# Finance UI API Contracts

For the DreamHigh Finance UI, use the authenticated `apiClient` with path-only finance endpoints, consume response envelope `data`, and let the server own validation, branch enforcement, invoice balances, and idempotency.

## What Happened
For DreamHigh D5, fee-plan inputs used live catalogs, invoice class selection used the selected student's active enrollment, payment history came from the invoice read, and receipt downloads used authenticated Blob requests. Arrears export fetched every filtered page before creating an `.xlsx` workbook.

## Takeaway
Keep finance API shapes in a typed service adapter. Treat summaries and previews as presentation only. Use authenticated branch IDs only to constrain visible selectors; backend authorization remains authoritative. Export pagination is part of correctness when the API returns paged data.

## History
- 2026-10-23 (DreamHigh/D5): initial.