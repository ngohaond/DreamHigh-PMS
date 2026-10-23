# D2 — Finance Core Handoff

## Scope Completed
- Added branch-owned fee plans for course or class pricing, CRUD/read routes, validation, active status, and soft deactivation.
- Added invoice snapshots for fee-plan name/base amount/discount/final total and required due date at creation; invoice numbering uses a non-reusable branch/year sequence.
- Added one percentage or fixed-amount discount per invoice. Percentage discount uses decimal arithmetic and floors the final VND amount.
- Added cash/bank-transfer payment recording, idempotency key replay/conflict handling, branch-scoped external reference uniqueness, row locking, overpayment prevention, and atomic invoice/payment/audit writes.
- Added invoice/payment reads with paid amount, outstanding, status, and overdue calculation. Payment responses omit idempotency internals.
- Existing D1 schema/migration/enrollment files were preserved. Updated `start:prod` to the actual Nest build output path.

## Routes
- `GET /api/finance/fee-plans` — list with optional branch/course/active filters.
- `GET /api/finance/fee-plans/:id` — read one visible plan.
- `POST /api/finance/fee-plans` — create; ADMIN/MANAGER.
- `PATCH /api/finance/fee-plans/:id` — update; ADMIN/MANAGER.
- `POST /api/finance/fee-plans/:id/deactivate` — soft deactivate; ADMIN/MANAGER.
- `POST /api/finance/invoices` — create from active fee plan and current matching enrollment; ADMIN/MANAGER/STAFF.
- `GET /api/finance/invoices/:id` — read snapshot/status/outstanding; ADMIN/MANAGER/STAFF.
- `POST /api/finance/invoices/:id/payments` — append payment; requires `Idempotency-Key`; ADMIN/MANAGER/STAFF.
- `GET /api/finance/payments/:id` — read payment; ADMIN/MANAGER/STAFF.

All routes use JWT + role guards and the standard `{ statusCode, message, data, meta }` envelope. Branch IDs are derived from the fee plan/invoice; caller scope is checked against JWT `branchIds`.

## Upstream Artifacts Consumed
- `docs/qa/PHASE_D_EXECUTION_PLAN.md` — D2 ownership, required endpoints, and downstream boundaries.
- `docs-BA/Business_Decision_Register_MVP_v0.2.md` — VND, discount, due-date, numbering, payment, idempotency, RBAC, branch, and audit rules.
- `_bmad-output/implementation-artifacts/5-1-cau-hinh-khung-hoc-phi.md` — fee-plan acceptance criteria.
- `_bmad-output/implementation-artifacts/5-2-thiet-lap-uu-dai.md` — discount acceptance criteria.
- `_bmad-output/implementation-artifacts/5-3-ghi-nhan-thu-tien.md` — transaction/payment acceptance criteria.
- `.github/modernize/rearchitecture/artifacts/D1-backend.md` — current Student branch-ownership edge case and D1 schema boundary.
- `.github/modernize/rearchitecture/learnings/backend/placement-barem-branch-scope.md` — Student ownership convention.

## Evidence Mapping
- Phase D plan D2 scope and business decision register §8/§9 → finance models, migration, service rules, DTOs, and focused tests.
- Story 5.1 fee-plan CRUD/deactivation → `finance.controller.ts`, `finance.service.ts`, fee-plan DTOs, and fee-plan schema/migration.
- Story 5.2 one discount and final amount calculation → invoice snapshot fields, decimal calculation, and percentage/fixed discount tests.
- Story 5.3 append-only payment, idempotency, and atomic status update → payment model, locked transaction service path, audit write, and payment tests.
- D1 branch ownership note → invoice branch determined only through an active class enrollment matching fee-plan course/branch; ambiguous or absent relation is rejected.

## Test Results
- Command: `npm --prefix pms-eng-api run prisma:validate`
  - Passed: schema valid.
- Command: `npm --prefix pms-eng-api run prisma:generate`
  - Passed: Prisma Client 6.19.2 generated.
- Command: `npm --prefix pms-eng-api run build`
  - Passed: NestJS build.
- Command: `npm --prefix pms-eng-api test -- --runInBand src/modules/finance/finance.service.spec.ts`
  - Passed: 1 suite, 10 tests; failed: 0.
- Command: `npm --prefix pms-eng-api test -- --runInBand`
  - Passed: 8 suites, 122 tests; failed: 0.
- Runtime: `npm --prefix pms-eng-api run start:prod` started successfully; `/api/health` returned 200; unauthenticated `/api/finance/fee-plans` returned 401 as expected. Authenticated finance operations were not probed.
- `git diff --check` passed with the existing schema LF/CRLF conversion warning.

## Decisions, Assumptions, and Open Risks
- Existing decimal Invoice/Payment amount fields were retained for compatibility with D1/current schema. New FeePlan amounts are PostgreSQL `INTEGER`; service validation and arithmetic keep newly created finance amounts integral VND.
- Student has no direct branchId. New invoices require one active enrollment matching student, fee-plan course, and branch; if multiple matches exist without explicit classId, creation asks for classId; with no matching enrollment it fails closed. This avoids inventing a Student branch assignment.
- Legacy invoices lacking a class cannot be backfilled to a branch and remain inaccessible through scoped finance reads until data ownership is resolved.
- Migration has not been applied to a database. Authenticated API/database behavior and fresh-database migration execution remain unverified.
- Payment success event integration is not included; current app has no event infrastructure in this module. Story 5.3 remains in progress for downstream review.
- Stories 5.1–5.3 remain `in-progress`: D2 backend slice is tested, but frontend work and D6 acceptance are outstanding.

## Next Agent + Exact Dependency
- D5 Finance UI can consume the routes above after a seeded database has the finance migration applied and an authenticated branch-scoped user is available.
- D3 Receipt/PDF depends on `GET /api/finance/payments/:id` for selected payment, invoice snapshot, student, branch, paid date, method, and transaction reference fields.
- D4 Arrears API depends on invoice `branchId`, `dueDate`, `paymentStatus`, `finalAmount`, and payment sum; use the `outstanding` and overdue semantics implemented by `GET /api/finance/invoices/:id`.
- D6 must run migration on a clean DB and authenticated two-branch tests before any story is marked done.