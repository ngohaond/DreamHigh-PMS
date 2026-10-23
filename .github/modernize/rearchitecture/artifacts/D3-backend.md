# D3 — Receipt PDF Handoff

## Result
- Implemented secured `GET /api/finance/payments/:id/receipt.pdf` in the finance module.
- Returns a private, no-store PDF attachment with receipt number, paid date, branch, student, invoice, fee-plan snapshot, VND amount, method, reference, and collector.
- Uses pdfmake `0.2.20` with its embedded Roboto virtual fonts for Vietnamese Unicode. The document uses DreamHigh gold/black colors and a text wordmark.
- Collector comes from the transactional `PAYMENT/CREATE` audit record. Missing collector data fails closed; no schema or migration changes were made.
- Receipt number is `RC-{branchCode}-{UTC year}-{sequence}`. Sequence is the count of same-branch, same-UTC-year committed payments through this payment ID. It is independent per branch/year and stable for append-only payment records; payment cancellation must retain the payment and use the approved adjustment/refund ledger.
- No frontend files were changed. D5 owns the download button/loading/error state.

## API Contract
- `GET /api/finance/payments/:id/receipt.pdf`
- Authentication: existing JWT and `ADMIN`, `MANAGER`, or `STAFF` role guards.
- Authorization: payment branch is checked before loading receipt relations, audit actor, assigning the number, or rendering. A known out-of-branch payment returns `403`; unknown or legacy branchless payment returns `404`.
- Success: `200`, `Content-Type: application/pdf`, attachment filename `receipt-RC-<branch>-<year>-<sequence>.pdf`, `Cache-Control: private, no-store`.

## Upstream Artifacts Consumed
- `docs/qa/PHASE_D_EXECUTION_PLAN.md` — D3 ownership, acceptance and D5/D6 boundaries.
- `docs-BA/Business_Decision_Register_MVP_v0.2.md` §8–9 — VND, append-only payment, receipt numbering, required fields, and branch policy.
- `_bmad-output/implementation-artifacts/5-4-xuat-phieu-thu.md` — Story 5.4 acceptance criteria.
- `docs/qa/Test_Case_Suite_MVP.md` 5.4-TC-01/03 — required receipt fields and branch isolation.
- `.github/modernize/rearchitecture/artifacts/D2-backend.md` — payment read contract, branch scope, and transactional audit behavior.
- `.github/modernize/rearchitecture/learnings/backend/finance-snapshot-idempotency.md` — preserve finance boundaries and use existing branch ownership.

## Evidence Mapping
- D2 `GET /api/finance/payments/:id` contract → receipt relations are selected only after authorization; payment/invoice/student/branch/fee snapshot data and payment fields populate the PDF.
- D2 transactional audit behavior + BA §9 collector requirement → `PAYMENT/CREATE` audit actor lookup; missing actor rejects receipt generation.
- BA §8 receipt number rule + append-only payment lifecycle → stable branch/year numbering without changing finance schema; branch/year/id-boundary query is asserted by tests.
- 5.4-TC-01 → PDF header and required Vietnamese document fields are asserted in `receipt.service.spec.ts`.
- 5.4-TC-03 → branch-B payment is rejected for branch-A staff before detail lookup, audit lookup, number query, or PDF rendering.

## Test Results
- Command: `Push-Location pms-eng-api; npm test -- --runInBand src/modules/finance/receipt.service.spec.ts; Pop-Location`
  - Passed: 5; failed: 0; skipped: 0.
- Command: `Push-Location pms-eng-api; npm test -- --runInBand src/modules/finance/receipt.service.spec.ts src/modules/finance/finance.service.spec.ts; Pop-Location`
  - Passed: 15; failed: 0; skipped: 0.
- Command: `Push-Location pms-eng-api; npm run build; Pop-Location`
  - Passed.
- Runtime probe: unauthenticated receipt request returned `401` as expected. Authenticated DB-backed download was unavailable because no seeded database/token was provided.
- Font check: generated a one-page representative PDF, opened it in the workspace PDF viewer, and visually confirmed Vietnamese diacritics rendered with no missing-glyph markers; generated sample was removed. PDF contained `%PDF-` header and embedded Roboto font data.
- Command: `git diff --check` — passed; Git reported the preexisting Prisma schema LF/CRLF conversion warning.

## Open Risks / D6 Gate
- No packaged DreamHigh logo is included. The existing logo is in the frontend-only public assets, which are not reliably available in a standalone API deployment; current PDF uses a text wordmark. D6 may request a packaged logo asset.
- Runtime authorization was verified through the unauthenticated `401` guard response and service tests; authenticated branch-isolation against a live database remains for D6.
- `npm install` reported 29 dependency audit findings in the API graph; they were not assessed or remediated as part of D3.
- Keep Story 5.4 open until D5 integration and D6 acceptance, including clean-DB migration and authenticated cross-branch verification. No story status was changed.

## Next Owner + Exact Dependency
- D5: integrate a download control with loading/error states using `GET /api/finance/payments/:id/receipt.pdf`; do not reimplement PDF generation.
- D6: validate authenticated branch isolation, clean-DB migration, and end-to-end receipt rendering before accepting Story 5.4.