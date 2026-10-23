# D5 — Finance UI Handoff

## Task / Agent
- Task: D5 — Finance UI and arrears dashboard (FR16-FR20 frontend)
- Agent: frontend
- Result: Added the protected `/finance` workspace for fee plans, invoice/payment workflows, payment details, receipt downloads, and arrears reporting/export. Stories remain open for D6 acceptance.

## Files and Routes
- `dreamhigh-web/src/pages/Finance/FinancePage.tsx` — Finance tabs, role-aware controls, forms, report states, pagination, and spreadsheet export.
- `dreamhigh-web/src/services/financeApi.ts` — typed API calls and response parsing; all calls use the authenticated `apiClient`.
- `dreamhigh-web/src/App.tsx` — `/finance` route protected for ADMIN, MANAGER, and STAFF.
- `dreamhigh-web/src/pages/Dashboard/dashboardConstants.ts` — Finance navigation now targets `/finance` and includes STAFF.
- `dreamhigh-web/package.json`, `dreamhigh-web/package-lock.json` — SheetJS `xlsx` dependency for real `.xlsx` exports.

## Contracts Consumed
- D2: `GET/POST/PATCH /finance/fee-plans`, `POST /finance/fee-plans/:id/deactivate`, `POST /finance/invoices`, `GET /finance/invoices/:id`, `POST /finance/invoices/:id/payments` with `Idempotency-Key`, and `GET /finance/payments/:id`.
- D3: `GET /finance/payments/:id/receipt.pdf` as an authenticated PDF attachment. The frontend requests a Blob and downloads it; PDF generation remains backend-owned.
- D4: `GET /reports/arrears` with branch/date/student/status/page/pageSize. Totals are displayed for the complete filtered result; export iterates every page (maximum 100 rows per request) and writes one `.xlsx` workbook.
- Catalog inputs: live `/categories/branches`, `/categories/courses`, `/classes`, `/students`, and `/students/:id` APIs. Invoice class selection is constrained to the selected student's active matching enrollment; the server remains authoritative.

## Decisions and Boundaries
- STAFF can view Finance and use invoice/payment/arrears flows as allowed by D2-D4; fee-plan create/update/deactivate controls are shown only to ADMIN/MANAGER.
- ADMIN sees all branch options; other users see only branches in their authenticated `branchIds`. No branch ID or financial data is mocked.
- Invoice and payment balances/history are read from server responses. Client amount calculations are previews only; validation, idempotency, and transaction semantics remain on the server.
- Excel export fetches all pages for the active filter set rather than exporting only the current page.
- Payroll `AdjustmentModal.tsx` and `PayrollSlipModal.tsx` are unchanged. D1-owned `StudentApiDetailPage.tsx` and all backend/schema/migration files are unchanged by D5.
- No story was marked done.

## Upstream Artifacts Consumed
- `docs/qa/PHASE_D_EXECUTION_PLAN.md` — D5 ownership, FR16-FR20 scope, and D6 acceptance boundary.
- `.github/modernize/rearchitecture/artifacts/D2-backend.md` — fee-plan, invoice, payment routes, envelopes, roles, branch behavior, and idempotency contract.
- `.github/modernize/rearchitecture/artifacts/D3-backend.md` — receipt PDF contract and D5-owned download states.
- `.github/modernize/rearchitecture/artifacts/D4-backend.md` — arrears filters, totals, item shape, pagination, and export boundary.
- `.github/modernize/rearchitecture/learnings/backend/finance-snapshot-idempotency.md` — integer VND boundaries and server-owned idempotency semantics.
- `.github/modernize/rearchitecture/learnings/backend/arrears-date-scope.md` — date-only filter and branch-scope conventions.
- `.github/modernize/rearchitecture/learnings/backend/receipt-pdf-branch-sequence.md` — authenticated receipt retrieval and PDF ownership.

## Evidence Mapping
- Phase D plan D5 scope → `/finance` route and Invoice, FeePlan, and Arrears panels in `FinancePage.tsx`.
- D2 fee-plan route/role contract → typed API adapter and ADMIN/MANAGER-only fee-plan mutations.
- D2 invoice/payment contract → active student enrollment selection, invoice snapshot detail/history, `Idempotency-Key` request header, and server-returned balances.
- D3 receipt contract → Blob download action per payment, with pending/error/retry states.
- D4 query/response contract and BA §9 export requirement → filter-bound totals, page navigation, and all-pages `.xlsx` export.

## Test Results
- Command: `Push-Location dreamhigh-web; npm run build; Pop-Location`
  - Passed: production TypeScript/Vite build; failed: 0.
  - Note: Vite reports the existing 500 kB main chunk warning and stale Browserslist data; the XLSX code is emitted in a separate dynamic chunk.
- Command: `Push-Location dreamhigh-web; npx eslint src/pages/Finance/FinancePage.tsx src/services/financeApi.ts src/App.tsx src/pages/Dashboard/dashboardConstants.ts; Pop-Location`
  - Passed: scoped lint; errors: 0, warnings: 0.
- Command: `Push-Location dreamhigh-web; npm run lint; Pop-Location`
  - Failed: project-wide lint reports errors in files outside the D5 edit set, including `AdminSystemManagementPage.tsx`, `StudentApiDetailPage.tsx`, `StudentDetail.tsx`, `StudentListPage.tsx`, class/schedule pages, and curriculum pages.
- Tests: no frontend `test` script or test harness is configured in `dreamhigh-web/package.json`; no automated UI tests were available to run.

## Manual Workflow for D6
1. Start the backend with a database containing the applied finance migration, then start `dreamhigh-web` and sign in as ADMIN/MANAGER with an authorized branch.
2. Open `/finance` → Khung học phí; create a course-wide or class-specific plan, edit it, then deactivate it. Verify the plan state persists after refresh.
3. Open Hóa đơn & thu tiền; search for a real student, select an active fee plan and matching enrolled class, set due date and optional single discount, create the invoice, and verify the returned invoice ID/detail.
4. Record a partial payment and then a remaining payment; verify balances/status and history after a refresh. Retry an unchanged request after a simulated network interruption to exercise the same idempotency key.
5. Download each receipt and confirm the PDF is readable and contains Vietnamese text. Check STAFF cannot see fee-plan mutation controls.
6. Open Công nợ; apply branch/date/student/status filters, compare page totals/list, navigate pages, export Excel, and confirm the workbook contains all filtered rows rather than only the current page.
7. Repeat with a user lacking branch access and confirm backend 403/404 behavior is surfaced without exposing other branches.

## Open Risks / Next Dependency
- Authenticated, seeded-database UI behavior and two-branch isolation were not verified in this frontend-only task; D6 owns those checks.
- The `StudentApiDetailPage` has D1 changes and existing lint findings; it was intentionally not edited.
- Next owner: D6 QA/integration, dependent on D1-D5 completion, clean-database migration, authenticated fixtures, and end-to-end acceptance.