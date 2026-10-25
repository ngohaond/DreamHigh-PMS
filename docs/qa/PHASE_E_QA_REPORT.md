# Phase E QA / Security & Integration Report

**Date:** 2026-10-23  
**Verdict:** **READY FOR PHASE F (UAT)** — Phase E hardening, branch isolation, and automated testing are complete.

---

## 1. Executive Summary

Phase E focuses on Cross-Cutting Requirements (NFRs), QA, Branch Isolation, and CI/CD Automation.
All critical security controls, pipeline workflows, branch isolation boundaries, and automated test specifications have been implemented and aligned with `ACTION_PLAN_GO_LIVE.md` (Phase 4) and `docs/qa/Development_Roadmap_MVP.md`.

---

## 2. Acceptance Matrix (Cross-Cutting / NFR)

| TC ID | Category | Priority | Description & Implementation Evidence | Verdict |
|---|---|---|---|---|
| **X-TC-01** | Security | P0 | **Global DTO Validation:** `main.ts` configured with `ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })`. Unauthorized fields in mutations are rejected with 400. | **PASS** |
| **X-TC-02** | Contract | P0 | **Response Envelope:** Handled via custom service wrappers and `ApiResponse<T>`. Existing legacy module contracts maintained to avoid breaking frontend screens. | **ACKNOWLEDGED (MAINTAINED)** |
| **X-TC-03** | Security | P0 | **Full Branch Isolation:** Enforced across Finance, Schedule, Classes, PlacementTest, and now **Students & Leads** (`StudentsService`, `LeadsService`). Requests from non-admin users cannot spoof or access cross-branch entities; queries are scoped to `req.user.branchIds`. Unit specs added (`students.service.spec.ts`, `leads.service.spec.ts`). | **PASS** |
| **X-TC-04** | Security | P0 | **Sanitized Output & Error Masking:** `toPublicUser` strips `passwordHash` and `googleSub`. `PrismaExceptionFilter` catches database errors (P2002, P2025, P2003) and masks raw internal details with clean error payloads and `requestId`. | **PASS** |
| **X-TC-05** | Security | P0 | **Rate Limiting / Brute-force Protection:** `@nestjs/throttler` activated on Auth controller (`ThrottlerGuard`, 5 req/min). Verified returning 429 via `phase-d-auth-smoke.mjs`. | **PASS** |
| **X-TC-06** | Performance | P2 | **10.000 Students Grid / Report SLA:** Indexed queries on `parentId`, `classId`, and branch keys; pagination implemented on grids. Operational benchmark deferred to production sizing. | **DEFERRED (OPS)** |
| **X-TC-07** | UI / Responsive | P1 | **Tablet & Mobile Navigation:** `MobileNavigation.tsx` introduced when Sidebar collapses under `md` breakpoint. Responsive padding tuned in `AppLayout.tsx`. | **PASS** |
| **X-TC-08** | Security | P1 | **Idle Session Timeout (30 mins):** Auto-logout triggered after 30 minutes of inactivity. Verified via Playwright test (`auth-routing.spec.ts`). | **PASS** |

---

## 3. Automated CI/CD Pipeline (`.github/workflows/ci.yml`)

The GitHub Actions workflow includes 3 unified jobs:
1. **Frontend Job:**
   - Node 20 runtime.
   - `npm run lint` & `npm run build`.
2. **Backend Job:**
   - PostgreSQL 16 service container with health checks.
   - `prisma validate` & `prisma migrate deploy`.
   - Jest test suite with coverage reporting.
   - Production API startup and readiness probe verification (`/api/health/ready`).
   - Authenticated live integration script (`scripts/phase-d-integration.mjs`).
   - Unauthenticated & throttling security verification (`scripts/phase-d-auth-smoke.mjs`).
3. **Browser E2E Job:**
   - Playwright test runner (`npm run test:e2e`).
   - Validates authentication form rendering, protected route redirects, idle session expiration (`auth-routing.spec.ts`), and CRM branch scoping (`crm-branch-isolation.spec.ts`).

---

## 4. Remediation Details Completed in Phase E

1. **Branch Isolation Hardening in CRM**:
   - `pms-eng-api/src/modules/students/students.service.ts` & `students.controller.ts`:
     - Injected `@Request() req: { user: StudentsAuthUser }`.
     - Non-admin users are restricted to `user.branchIds`. Unauthorized `branchId` queries throw `403 Forbidden`.
   - `pms-eng-api/src/modules/leads/leads.service.ts` & `leads.controller.ts`:
     - Injected `@Request() req: { user: LeadsAuthUser }`.
     - Non-admin users only see leads assigned to staff within `user.branchIds`.
2. **Unit Test Coverage**:
   - `pms-eng-api/src/modules/students/students.service.spec.ts`: Tests admin unrestricted query, non-admin branch scoping, and 403 Forbidden on cross-branch access.
   - `pms-eng-api/src/modules/leads/leads.service.spec.ts`: Tests admin unrestricted query, non-admin branch scoping, and 403 Forbidden on cross-branch access.
3. **End-to-End Browser Coverage**:
   - `dreamhigh-web/e2e/crm-branch-isolation.spec.ts`: Verifies staff access to branch-scoped student list and route-guard rejection on admin endpoints.
4. **Test Suite Matrix Traceability**:
   - Updated `docs/qa/Test_Case_Suite_MVP.md` reflecting completed status of all cross-cutting NFRs.

---

## 5. Handoff to Phase F (UAT & Go-Live)

With Phase E completed, the system is fully hardened and ready for persona-based User Acceptance Testing (Admin, Quản lý đào tạo, Học vụ, Giáo viên, Thu ngân) under **Phase F**.

