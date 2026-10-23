# D4 — Arrears API (FR20)

## Task / Agent
- Task: D4 — Arrears API (FR20 backend)
- Agent: backend
- Result: Implemented a read-only branch-scoped arrears report inside the existing finance module. Story 5.5 remains unchanged pending D5 UI and D6 acceptance.

## Scope Completed
- Added `GET /api/reports/arrears`, guarded by JWT and the ADMIN/MANAGER/STAFF role set.
- Added optional `branchId`, inclusive `fromDate`/`toDate` (due-date calendar dates), `student` name/code search, `status` (`CURRENT`/`OVERDUE`), `page`, and `pageSize` filters.
- Response envelope: `data.totals` (`totalDebt`, distinct `studentCount`, `overdueTotal`), `data.items` (invoice, student, class, amount due, date, report/payment status), and pagination in `meta`.
- Totals and page data are calculated from the same PostgreSQL Repeatable Read transaction. Matching candidate invoices are rechecked from payment sums, so completed or stale-status fully paid invoices are excluded.
- No schema/migration changes and no D2 invoice/payment write behavior or D3 receipt implementation changes.

## Changed Files
- `pms-eng-api/src/modules/finance/dto/arrears-query.dto.ts`
- `pms-eng-api/src/modules/finance/arrears.service.ts`
- `pms-eng-api/src/modules/finance/arrears.controller.ts`
- `pms-eng-api/src/modules/finance/arrears.service.spec.ts`
- `pms-eng-api/src/modules/finance/finance.module.ts` — registers the D4 controller/service only.

## Upstream Artifacts Consumed
- `.github/modernize/rearchitecture/artifacts/D2-backend.md` — invoice branch, due date, status, payment/outstanding contract.
- `docs/qa/PHASE_D_EXECUTION_PLAN.md` — D4 scope, test expectations, D5/D6 ownership boundaries.
- `docs-BA/Business_Decision_Register_MVP_v0.2.md` §8–9 — strict overdue boundary, finance branch policy, FR20 requirements.
- `_bmad-output/implementation-artifacts/5-5-dashboard-no-hoc-phi.md` — report acceptance criteria and route contract.
- `docs/qa/Test_Case_Suite_MVP.md` — 5.5-TC-01..03 expected outcomes.
- `.github/modernize/rearchitecture/learnings/backend/finance-snapshot-idempotency.md` — preserve decimal compatibility and derive outstanding from payments.
- `.github/modernize/rearchitecture/learnings/backend/receipt-pdf-branch-sequence.md` — authorize before branch data access and respect append-only payment history.

## Evidence Mapping
- Business Decision Register §8 (`today > dueDate` and `outstanding > 0`) → UTC calendar-date classification and positive payment-derived balance in `arrears.service.ts`; boundary/timezone and paid-row tests.
- Business Decision Register §2/§9 (JWT branch scope and FR20 branch isolation) → `branchId` allowlist check and scoped Prisma query; branch isolation test.
- Story 5.5 AC1–4 / 5.5-TC-01..03 → aggregate, student/class items, filters, pagination, and read-only report service tests.
- D2-backend invoice/payment contract → invoice final amount less append-only payment sum; no D2 service/schema changes.

## Test Results
- Command: `npm test -- --runInBand src/modules/finance/arrears.service.spec.ts`
  - Passed: 5; failed: 0.
- Command: `npm test -- --runInBand src/modules/finance`
  - Passed: 20; failed: 0; suites: 3.
- Command: `npm run build`
  - Passed: NestJS API build.
- Command: `git diff --check`
  - Passed: no whitespace errors; Git emitted the pre-existing `schema.prisma` LF/CRLF warning.
- Runtime: API started from `pms-eng-api`; anonymous `GET /api/reports/arrears` returned 401, confirming route registration and JWT enforcement. An authenticated 2xx was not verified because no valid local account/token was available; a signed token for nonexistent local user ID 1 also returned 401.

## Assumptions / Open Risks
- Date range filters apply inclusively to `dueDate`; query dates are strict `YYYY-MM-DD` and UTC calendar dates. This matches PostgreSQL `DATE` storage and the established D2 UTC overdue calculation.
- `status` filters report classification (`CURRENT`/`OVERDUE`), not invoice payment status; the response also exposes `paymentStatus`.
- Report totals honor all active filters, including report status, and are calculated across all matching rows before pagination; `studentCount` counts distinct students.
- Matching unpaid invoices and payment amounts are loaded in one repeatable-read operation, then aggregates and report-status filtering are computed in memory. This avoids schema/ledger changes and preserves consistency, but may need a database-side aggregate/index strategy for large datasets (NFR2).
- Live authenticated data behavior, two-branch database fixtures, and export remain for D6/D5 respectively. Export is not part of this backend slice.

## Next Owner + Exact Dependency
- D5 Finance UI — consume `GET /api/reports/arrears` with `branchId`, `fromDate`, `toDate`, `student`, `status`, `page`, and `pageSize`; render `data.totals`, `data.items`, and `meta` pagination. Export remains a D5/UI concern.
- D6 QA — run authenticated two-branch integration checks and confirm 5.5-TC-01..03 before changing story status. Story 5.5 remains pending.