# Frontend Session Log

## [D5] Finance UI and arrears dashboard
- Reused the existing authenticated axios client and React Query patterns; backend envelopes are parsed in a typed Finance API adapter.
- Invoice class assignment must come from a matching active student enrollment for the fee-plan branch/course. The student detail endpoint includes the required training-class fields.
- Arrears export must fetch every API page under the current filters; exporting visible rows alone would violate the BA requirement.
- A frontend test runner is not configured. Production build and scoped lint pass; project-wide lint has unrelated errors including in the D1-owned Student API page.
- Learnings consumed: [backend/finance-snapshot-idempotency, backend/arrears-date-scope, backend/receipt-pdf-branch-sequence]