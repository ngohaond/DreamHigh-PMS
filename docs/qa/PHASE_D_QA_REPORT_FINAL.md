# Phase D D6 QA / Integration Report

**Date:** 2026-10-23  
**Verdict:** **PASS FOR CODE REVIEW / UAT** — Phase D implementation and tested flows are ready for review. Stories are `review`, not `done`; operational Level barems and product-owner sign-off remain.

## Execution Evidence

- **Clean schema:** All 9 Prisma migrations applied successfully to isolated PostgreSQL schema `phase_d_validation_clean_20261023`. The migration chain exposed `levels.status` drift; additive migration `20261023020000_reconcile_phase_d_schema` fixes clean-schema reconciliation. No schema reset or business data deletion was performed.
- **Existing local schema:** `prisma migrate deploy` completed; migration status reports schema up to date.
- **Backend:** Prisma validate passed; Nest build passed; Jest **10 suites / 132 tests passed**.
- **Isolated authenticated API:** `scripts/phase-d-integration.mjs` passed all 18 scenarios against an empty-migrated PostgreSQL schema using synthetic users/data only.
- **Frontend:** Production build passed. D5 scoped ESLint and D1 student-detail ESLint passed.
- **Frontend full lint:** Still fails with **31 errors and 1 warning across unrelated files** (Admin, audit, catalog, legacy CRM/class/course/profile/auth files). No remaining errors in the D1/D5 touched slices.
- **Browser flow:** Integrated browser exercised authenticated synthetic STAFF view; `/finance` loaded live data, displayed arrears totals/list, hid fee-plan mutations, created a 10% discounted invoice, recorded a partial payment and showed the updated outstanding, and downloaded a receipt (`200 application/pdf`). Export produced `cong-no-2026-10-23.xlsx` (17,444 bytes; ZIP signature `PK 03 04`). Placement form submitted (`201`), persisted score 70 and displayed the configured QA-L1 recommendation.

## Acceptance Matrix

| Story / Test | Result | Evidence |
|---|---|---|
| 2.3-TC-06 placement persistence | PASS | Live POST + separate GET on isolated PostgreSQL; browser form submit and history update |
| 2.3-TC-07 configured barem mapping | PASS | Inclusive boundaries 149/150; Level API bounds updated and recommendation changed |
| 5.1-TC-01 fee plan create | PASS | Authenticated live API integration |
| 5.1-TC-02 negative amount | PASS | DTO validation and API rejects invalid amount |
| 5.1-TC-03 deactivate preserves existing invoice snapshot | PASS | Unit snapshot coverage plus live plan update/deactivate flows; invoice amount remains snapshotted |
| 5.2-TC-01 percentage discount | PASS | Live invoice snapshot; 100,001 VND with 12.34% -> 87,661 VND |
| 5.2-TC-02 fixed discount | PASS | Live invoice snapshot with fixed amount |
| 5.2-TC-03 discount greater than base | PASS | Live API rejects with 400; no invoice created |
| 5.2-TC-04 combine percent + fixed | N/A by approved BA | Decision Register v0.2 allows one discount type per invoice |
| 5.3-TC-01/02 partial and full payment | PASS | Live 30,000 partial retry then remaining amount; status/outstanding verified through read-back |
| 5.3-TC-03 overpayment | PASS | Live API rejects amount above outstanding |
| 5.3-TC-04 idempotency/reference duplicate | PASS | Concurrent identical retries create one payment; changed payload and duplicate external reference rejected |
| 5.3-TC-05 transaction rollback | PASS | Injected audit failure leaves no payment and invoice remains PENDING |
| 5.3-TC-06 payment success event | PASS | Focused Finance service test verifies one emission; idempotent replay emits none |
| 5.4-TC-01 receipt content/PDF | PASS | Required fields asserted; live endpoint returns PDF; DreamHigh logo packaged in build |
| 5.4-TC-02 Vietnamese font | PASS | D3 visual PDF check; embedded Roboto font; Unicode receipt test |
| 5.4-TC-03 branch isolation | PASS | Branch A cannot read Branch B receipt; API returns 403 |
| 5.5-TC-01 arrears totals | PASS | Live totals and line items match payment-derived outstanding |
| 5.5-TC-02 branch isolation | PASS | Branch A cannot filter/read Branch B arrears or invoice/payment data |
| 5.5-TC-03 overdue boundary | PASS | Due date before today classifies OVERDUE; current/future due dates remain CURRENT |
| 5.5-TC-04 Excel export | PASS | Browser export artifact verified as XLSX ZIP container |

## Known Follow-ups

- Configure non-overlapping placement score bounds for the real active Levels before using recommendations operationally. No business thresholds were invented or seeded.
- BA should confirm a per-skill upper score limit if one is required; current validation rejects negative values and maps the aggregate score to configured Level bounds.
- Project-wide frontend lint remains red for unrelated files; D1 and D5 scoped lint are clean.
- Stories 2.3 and 5.1–5.5 are set to `review`, not `done`. Product owner/BA review and subsequent Phase F UAT remain release gates.

## Test Environment and Safety

- The normal local development DB received only additive Phase D migrations; no reset or deletes.
- Authenticated write/read and browser checks ran in isolated schemas with synthetic students, branches and principals. No real customer records or credentials were used.
- Docker daemon was unavailable; PostgreSQL was already available locally, so clean migration verification used a new isolated schema instead of Docker.
- Browser packages were not installed; the VS Code integrated browser exercised the SPA.
- Temporary test API servers used ports 3001–3004; the standard local API on port 3000 was not disturbed.

## Handoff

```text
Task: D6 QA / integration
Result: PASS for code review/UAT; stories remain review
Evidence: 9 migrations from empty schema; 132 backend tests; API/frontend builds; 18 isolated API scenarios; browser invoice/payment/receipt/arrears/export/placement flows
Remaining: configure operational Level barems; BA/product-owner review; unrelated full-frontend lint errors
Next: approve stories in review, then Phase F UAT with business users
```
