# Phase D D6 QA / Integration Report

> **Superseded:** Báo cáo đầu tiên được viết trước khi isolated PostgreSQL integration/browser checks chạy. Dùng [`PHASE_D_QA_REPORT_FINAL.md`](PHASE_D_QA_REPORT_FINAL.md) làm kết luận hiện hành.

**Date:** 2026-10-23  
**Verdict:** **NO-GO / INCOMPLETE** — code-level checks pass in several slices, but Phase D P0 acceptance is not fully evidenced. Story and sprint statuses were not changed.

## Tier Results

| Tier | Verdict | Evidence |
|---|---|---|
| Prisma schema | PASS | `npm run prisma:validate`, exit 0. |
| Existing development DB migrations | PASS, limited scope | `npm exec -- prisma migrate status`, exit 0; 8 migrations found and schema up to date. This is not a clean-database migration run. |
| Clean-database migration | UNVERIFIED | Docker is unavailable; no isolated scratch database was supplied. The existing database was not reset or modified by QA. |
| API unit tests | PASS, unit/mock scope | `npm test -- --runInBand`, exit 0; 10 suites, 132 tests passed, 0 failed. This is not DB-backed integration evidence. |
| API build | PASS | `npm run build`, exit 0. |
| API startup/readiness | PASS | Fresh `npm run start:prod` on port 3001 started successfully; `/api/health` returned 200 (probe exit 0). The temporary process was stopped after the probe. Existing port 3000 service was not disturbed. |
| Unauthenticated API enforcement | PASS | `node scripts/phase-d-auth-smoke.mjs`, exit 0; health 200 and finance/receipt/arrears GETs all 401. |
| Frontend production build | PASS | `npm run build`, exit 0. Existing stale Browserslist and >500 kB chunk warnings remain. |
| D5 scoped frontend lint | PASS | ESLint on `FinancePage.tsx`, `financeApi.ts`, `App.tsx`, and `dashboardConstants.ts`, exit 0. |
| Frontend full lint | FAIL | `npm run lint`, exit 1; 32 errors and 3 warnings across 18 files. No errors in D5-scoped files; findings include D1 `StudentApiDetailPage.tsx` and unrelated existing pages/components. |
| Frontend runtime/browser workflow | UNVERIFIED | `/finance` app shell returned HTTP 200. Its redirect to `/login` is client-side (`ProtectedRoute`); no frontend test script/harness exists. Playwright/browser packages were not installed, per instruction. |
| Authenticated financial workflow | UNVERIFIED | No authorized synthetic test principal or isolated database is available. No credentials were guessed and no invoice/payment was created. |

## P0 Acceptance Evidence

| Criterion | Available evidence | D6 status |
|---|---|---|
| 2.3-TC-06 — persist placement result and recommended Level | Service unit test asserts the Prisma create call and returned recommendation using mocked Prisma. No live DB write/read round trip. | PARTIAL; acceptance unverified |
| 2.3-TC-07 — mapping follows configured Level bounds | Unit tests use configured inclusive bounds and cover a no-match result. No live change-to-barem then remap scenario. | PARTIAL; acceptance unverified |
| 5.1-TC-01 — create fee plan | No positive persistence test or authenticated runtime evidence in this run. | UNVERIFIED |
| 5.2-TC-01 — percentage discount | Unit tests cover percentage arithmetic/flooring. No DB-backed invoice snapshot verification. | PARTIAL |
| 5.2-TC-02 — fixed discount | Over-limit rejection is tested; a valid fixed-discount creation path was not evidenced. | UNVERIFIED |
| 5.2-TC-03 — discount exceeds base | Unit test expects rejection. Approved BA baseline says discount must not exceed base; the older test-suite wording “Clamp = base / 400” is ambiguous and should be reconciled by BA before treating this TC as pass. | PARTIAL; expected result needs owner confirmation |
| 5.3-TC-01 — partial payment / PARTIAL / outstanding | Mock-based unit test covers atomic service path and resulting outstanding/status. No live transaction evidence. | PARTIAL |
| 5.3-TC-02 — full payment / COMPLETED | No full-payment case was identified in the current finance service spec. | UNVERIFIED |
| 5.3-TC-03 — reject overpayment | Mock-based unit test verifies rejection and no payment/status writes. | PARTIAL |
| 5.3-TC-04 — idempotency | Unit tests cover same-key replay and same-key/different-payload conflict. External transaction-reference uniqueness and concurrent DB requests were not verified. | PARTIAL |
| 5.3-TC-05 — transaction rollback | No injected mid-transaction failure against PostgreSQL; current service tests mock `$transaction`. | UNVERIFIED |
| Branch isolation — fee plans, invoices, payments, receipts, arrears | Service tests assert branch filters/denials with mocks. Live anonymous probes establish 401 before resource access, but do not prove authenticated branch-A versus branch-B behavior. | PARTIAL; authenticated isolation unverified |
| 5.4-TC-01 — receipt fields/PDF | Unit test checks required Vietnamese document fields and `%PDF-` output. No authenticated DB-backed receipt download in this run. | PARTIAL |
| 5.4-TC-03 — cannot download another branch receipt | Mock service test denies out-of-branch payment before loading details/rendering. No authenticated two-branch runtime test. | PARTIAL |
| 5.5-TC-01 — debt/student/overdue aggregates | Mock-based arrears tests cover aggregates, paid-row exclusion, filters and pagination. No comparison against live fixture data. | PARTIAL |
| 5.5-TC-02 — branch-isolated arrears | Mock-based service test rejects an out-of-scope branch filter. No authenticated two-branch runtime test. | PARTIAL |

All live unauthenticated probes passed: `GET /api/health` 200; `GET /api/finance/fee-plans`, `/api/finance/invoices/1`, `/api/finance/payments/1`, `/api/finance/payments/1/receipt.pdf`, and `/api/reports/arrears` each returned 401. The smoke script contains only GET requests and creates no data.

## Blockers and Next Owners

- **Infra/DB owner + project coordinator:** provide an isolated PostgreSQL database (or approved disposable test environment) and a supported way to run migrations from empty state. Do not use/reset the existing development DB as a substitute.
- **IAM/project coordinator:** provide an authorized synthetic STAFF/MANAGER test principal with known branch scope, or approve a controlled fixture strategy. Public registration only assigns the STUDENT role; it cannot create the needed finance tester.
- **D2 backend owner:** add/run DB-backed transaction rollback, full-payment, idempotency concurrency/reference uniqueness, and two-branch finance tests against isolated fixtures.
- **D0/BA:** resolve the old 5.2-TC-03 “clamp/400” expectation against the approved decision that discounts cannot exceed base amount.
- **D3 + QA:** retain or reproduce inspectable evidence that a generated receipt PDF renders Vietnamese glyphs; no browser tooling was installed in this run.
- **D5 frontend owner:** add/approve a frontend test harness for authenticated finance UI workflow. No test script currently exists; no UI smoke was simulated as a browser test.

**Next decision owner:** project coordinator, with Infra/DB and D0/BA inputs, to unblock isolated fixtures and settle the one acceptance expectation. Keep stories unchanged/open. Once blockers are resolved, rerun clean migration, authenticated branch/transaction/receipt/arrears checks, and the complete finance UI workflow before a GO decision.

## Compact Handoff

```text
Task: D6 QA/integration
Result: NO-GO / INCOMPLETE; no story or sprint status changes
Tests: Prisma validate 0; migrate status 0 (8 applied/up-to-date); API 132/132 tests 0; API build 0; fresh API startup + health 200; read-only auth smoke 6/6, exit 0; frontend build 0; D5 lint 0; full frontend lint 1 (32 errors, 3 warnings)
Evidence boundary: unit specs mostly mock Prisma; authenticated DB-backed flow, clean DB migration, rollback, two-branch isolation and browser workflow remain unverified
Changed: added pms-eng-api/scripts/phase-d-auth-smoke.mjs and this report only; existing dirty worktree preserved
Next: project coordinator / Infra-DB for isolated DB and synthetic authorized principal; D0/BA for discount expectation; D2/D3/D5 owners for remaining scoped evidence
```