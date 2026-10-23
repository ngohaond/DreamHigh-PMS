---
title: 'Deploy DreamHigh PMS on the current Linux machine'
type: 'chore'
created: '2026-10-23'
status: 'done'
baseline_commit: 'cd79cb2b37a7326a1366b87345512a7835ed8544'
context:
  - docs/handover/TAI_LIEU_BAN_GIAO_DREAMHIGH_PMS.md
---

<frozen-after-approval reason="User authorized deployment on the current Linux machine">

## Intent

**Problem:** The current Linux host has Docker but no application configuration, PostgreSQL installation, or built application. The user explicitly requested deployment here.

**Approach:** Run a dedicated Docker Compose project containing persistent PostgreSQL 16, a one-time migration/bootstrap container, the compiled NestJS API, and an Nginx-served React production build. Publish only a loopback frontend port, with same-origin API proxying.

## Boundaries & Constraints

**Always:** Preserve existing user edits. Use the current working tree. Generate unique credentials into an ignored mode-0600 environment file, never print passwords/tokens. Persist database data in a dedicated named volume. Use production builds and restart policies. Bootstrap only missing local data; never reset an existing administrator password.

**Ask First:** Access outside sandbox must use execution approval. Using an existing business database, exposing the service beyond this host, or deleting any database volume requires separate authorization.

**Never:** Commit/push source, touch unrelated Redis containers, import business data, use the existing demo seed, weaken global production CORS validation, or run UAT scripts against the deployed database.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First deploy | Empty dedicated DB | Migrations applied; core roles, local branch and admin created; services healthy | Failed initialization prevents API/web startup |
| Repeated initialization | Existing local admin | Existing hash and permissions remain unchanged | Never overwrite credentials |
| Local browser | HTTP localhost:8080 | SPA loads and calls /api on the same origin | Backend failures remain HTTP errors |
| Backend unavailable | Database or API down | Readiness reports failure | Docker health status reveals failure |
| Direct SPA navigation | /login or /finance reload | index.html fallback | Missing assets return 404 |
| Host restart | Docker restarts | DB/API/web restart with preserved data | Inspect container logs if unhealthy |

</frozen-after-approval>

## Code Map

- `pms-eng-api/Dockerfile` -- currently runs npm postinstall before copying Prisma and uses the wrong start path.
- `pms-eng-api/prisma/schema.prisma` -- physical tables and user/branch/role relations.
- `pms-eng-api/src/modules/auth/auth.service.ts` -- password login contract and bcrypt hash verification.
- `pms-eng-api/src/common/security/security-config.ts` -- production CORS requires HTTPS origins.
- `dreamhigh-web/src/config/apiBase.ts` -- accepts /api as a build-time base.
- `dreamhigh-web/package.json` -- existing production build.

## Tasks & Acceptance

**Execution:**
- [x] `pms-eng-api/Dockerfile` -- copy schema before npm ci, install OpenSSL, include local bootstrap, verify actual compiled entrypoint and PDF asset.
- [x] `pms-eng-api/scripts/bootstrap-local.cjs` -- initialize four operational roles, a local branch and a random-password admin without resetting existing users; test first/repeated initialization.
- [x] `dreamhigh-web/Dockerfile.local`, `dreamhigh-web/.dockerignore`, `dreamhigh-web/nginx.local.conf` -- build production assets and serve SPA/API through Nginx.
- [x] `compose.local.yml` -- define health checks, startup dependency order, durable storage, loopback-only frontend, and restart policies.
- [x] `.env.local-deploy` -- generate ignored deployment secrets, preserve on subsequent runs.
- [x] `docs/deployment/LOCAL_LINUX.md` -- record deployed URL, credential location, lifecycle commands, backup and limitations.
- [x] Build, initialize and start the stack, run backend unit tests without writing deployed business data, check HTTP and authenticated read-only endpoints, and record outcomes.

**Acceptance Criteria:**
- Given this Linux host with Docker, when deployment completes, then http://localhost:8080/login serves the compiled UI and /api/health/ready confirms database connectivity.
- Given generated credentials, when login is requested through Nginx, then authentication succeeds and the ADMIN can read protected users/catalog endpoints.
- Given direct requests without authentication, when a protected endpoint is called, then access is rejected.
- Given successful initialization, when initialization runs again, then the existing admin password hash is unchanged.
- Given a deployed stack, when it restarts, then application readiness and the persisted admin remain available.

## Spec Change Log

- Review patches: preserve an administrator after email/username changes by recognizing existing bootstrap/super-admin identities; validate URL-safe local database passwords before migration. Existing accounts, permissions and password hashes remain untouched.

## Design Notes

HTTP is restricted to loopback. Nginx serves frontend and API on the same origin; API CORS can retain a strict HTTPS-only localhost allowlist because cross-origin browser access is not required. The API and database have no host-published ports. This deploy does not introduce public hosting or TLS.

## Verification

- `docker compose --env-file .env.local-deploy -f compose.local.yml config --quiet` -- valid configuration without printing resolved secrets.
- Docker builds -- both existing npm build scripts succeed; compiled API entrypoint and receipt asset exist.
- Existing backend Jest suite -- source mounted read-only into an isolated test container.
- HTTP checks -- SPA fallback, asset delivery, health/readiness, login, authenticated reads and unauthenticated denial.
- Bootstrap and container restart checks -- preserve credentials and confirm readiness after restart.

**Results:** API/frontend production builds passed; 17 Jest suites / 166 tests passed; 6 bootstrap regression tests passed. All 9 migrations applied, services are healthy, host HTTP and authenticated reads passed before/after restart and after the final image update. Invalid local database-password configuration was rejected before migration. Docker is enabled at boot. Existing user-edited files were preserved; no commit, push, public exposure or business-data import was performed.

## Suggested Review Order

**Điểm vào triển khai**

- Bốn dịch vụ, volume riêng và cổng loopback.
  [compose.local.yml:1](../../compose.local.yml#L1)

**Khởi tạo an toàn**

- Nhận diện tài khoản cũ, giữ quyền và mật khẩu.
  [bootstrap-local.cjs:33](../../pms-eng-api/scripts/bootstrap-local.cjs#L33)

**Build và phục vụ ứng dụng**

- Build Prisma và NestJS trước khi chạy dưới user node.
  [Dockerfile:1](../../pms-eng-api/Dockerfile#L1)

- Phục vụ SPA và proxy API cùng origin.
  [nginx.local.conf:1](../../dreamhigh-web/nginx.local.conf#L1)

**Kiểm tra và vận hành**

- Kiểm tra khởi tạo, đổi định danh và đầu vào sai.
  [bootstrap-local.test.cjs:1](../../pms-eng-api/scripts/bootstrap-local.test.cjs#L1)

- Địa chỉ, tài khoản, lifecycle và bằng chứng triển khai.
  [LOCAL_LINUX.md:1](../../docs/deployment/LOCAL_LINUX.md#L1)
