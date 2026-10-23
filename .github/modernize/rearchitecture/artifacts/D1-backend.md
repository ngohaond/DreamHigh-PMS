# D1 — Placement Test Handoff

## Summary
FR12 now stores placement results, maps totals to configured Level ranges, and exposes a student-detail entry/history flow. No threshold values were invented.

## Contract and Migration
- `POST /api/students/:id/placement-tests` accepts `branchId`, `programId`, `listeningScore`, `readingScore`, `writingScore`, `testDate`, and optional `notes`; returns the standard `{ statusCode, message, data, meta }` envelope with the persisted record and recommended Level.
- `GET /api/students/:id/placement-tests` returns persisted history in the same envelope.
- Active Levels match inclusive `minPlacementScore <= totalScore <= maxPlacementScore`; overlapping matches are rejected; no match persists a null recommendation.
- `PATCH /api/categories/levels/:id` accepts both `minPlacementScore` and `maxPlacementScore`. Configure bounds for active Levels before using placement recommendations; no seed values are supplied.
- Migration: `pms-eng-api/prisma/migrations/20261023000000_placement_tests/migration.sql` adds nullable Level bounds and `placement_tests` with student, branch, program, individual scores, total, date, and optional recommended Level.
- Branch is selected from the user’s authorized branches and stored on the result. Creation rejects a branch outside the caller’s scope or inconsistent with current enrollments. Teachers must be assigned to a class/session; Admin remains cross-branch.

## Test Results
- `npm run prisma:validate` — passed.
- `npm run prisma:generate` — passed (Prisma Client 6.19.2).
- `npm run build` in `pms-eng-api` — passed.
- `npm test -- --runInBand` in `pms-eng-api` — 7 suites passed, 112 tests passed, 0 failed.
- `npm test -- --runInBand src/modules/enrollment/enrollment.service.spec.ts` — 1 suite passed, 6 tests passed, 0 failed.
- `npm run build` in `dreamhigh-web` — passed; existing bundle-size and stale Browserslist warnings remain.
- `git diff --check` — passed; Git reported only the repository’s LF/CRLF conversion notice.
- Runtime HTTP probe — blocked: `npm run start:prod` targets `dist/main.js`, which is absent; the build emits `dist/src/main.js`. Running that compiled entry directly stayed alive without logging that it was listening, and GET/POST were unreachable. No authenticated end-to-end 2xx was verified. The migration was not applied to a database.

## Upstream Artifacts Consumed
- `docs/qa/PHASE_D_EXECUTION_PLAN.md` — D1 scope, requirements, and handoff boundary.
- `_bmad-output/implementation-artifacts/2-3-ghi-nhan-placement-test.md` — Story 2.3 acceptance criteria and API expectations.
- `docs-BA/Business_Decision_Register_MVP_v0.2.md` — role/branch ownership policy and approved baseline.

## Evidence Mapping
- D1 requirements for persistence, scores/date/student/recommended Level, and configurable inclusive bounds → Prisma model/migration, enrollment service, and focused mapping tests.
- D1 requirements for validated request and branch scope → DTO/controller/service and authorization tests.
- D1 UI/handoff requirement → `dreamhigh-web/src/pages/CRM/StudentApiDetailPage.tsx` and Story 2.3 Dev Agent Record.

## Open Risks and Next Dependency
- Fix/confirm API startup entrypoint and database readiness, apply the migration in the target database, then configure non-overlapping bounds for active Levels through the existing Level API.
- Confirm API startup/database readiness and run authenticated POST/GET checks with an authorized test account.
- D6 owns final Test Case 2.3-TC-06/07 acceptance and story completion; Story 2.3 remains `ready-for-dev` pending that gate.