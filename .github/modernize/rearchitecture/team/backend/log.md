## [D1] Implement FR12 Placement Test persistence and mapping
- Codebase discoveries: Student has no direct branch owner; class enrollments provide current branch/teacher assignment, while each placement record stores the branch selected within the caller’s authorized scope.
- Design decision: keep barem bounds on Level as nullable inclusive total-score bounds; do not seed unspecified business thresholds. Store each placement as an append-only record with a nullable recommended Level.
- Verification: Prisma validate/generate, API build, full Jest suite, focused placement tests, frontend build, and diff hygiene passed. Runtime HTTP readiness could not be verified because the compiled API did not reach its listening log.
- Learnings consumed: (none).

## [D2] Implement Finance Core FR16-FR18
- Codebase discoveries: Existing Invoice/Payment use decimal columns and have no branch snapshot or payment idempotency; global audit interception is fire-and-forget and must be skipped for finance routes that write audit inside the business transaction.
- Design decisions: integer fee-plan VND, immutable invoice fee/discount snapshots, branch/year invoice sequence reserved outside invoice transaction, and payment serialized by invoice row lock plus idempotency advisory lock. Because Student has no direct branch, require an active matching class enrollment and reject ambiguous ownership.
- Verification: Prisma validate/generate, API build, focused finance tests (10), full API Jest suite (122), start:prod + health (200) + unauthenticated finance route (401). Migration was not applied and authenticated behavior was not exercised.
- Learnings consumed: [backend/placement-barem-branch-scope].

## [D3] Implement FR19 Receipt PDF
- Codebase discoveries: D2 records collector identity in transactional `PAYMENT/CREATE` audit rows; `Payment` itself has no collector field. pdfmake 0.2.20 exposes embedded Roboto fonts through `build/vfs_fonts` in Node.
- Design decisions: keep payment reads branch-checked before receipt relations/rendering; derive receipt ordinal from immutable payment IDs grouped by branch and UTC payment year, avoiding schema changes.
- Verification: focused receipt tests (5), combined D2+receipt tests (15), API build, unauthenticated route probe (401), PDF opened and Vietnamese rendering visually inspected, diff check passed with preexisting Prisma line-ending warning.
- Learnings consumed: [backend/finance-snapshot-idempotency].

## [D4] Implement FR20 Arrears API
- Codebase discoveries: `dueDate` is PostgreSQL `DATE`; class labels are `TrainingClass.classCode`; invoice payment status is updated with payment creation, while recomputing paid amount also safely excludes inconsistent fully-paid rows.
- Design decisions: keep report controller/service in finance module; use strict UTC calendar-day overdue checks and a Repeatable Read snapshot for aggregate/list consistency; apply status filtering before totals/pagination.
- Verification: focused arrears tests (5), all finance tests (20), API build, diff hygiene; runtime unauthenticated route returned 401, but no valid local identity was available for an authenticated 2xx.
- Learnings consumed: [backend/finance-snapshot-idempotency, backend/receipt-pdf-branch-sequence].