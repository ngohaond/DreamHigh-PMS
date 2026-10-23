# Phase B Verification Report — Scheduling & Sessions

**Date:** 2026-10-23  
**Status:** DONE (Backend) + DONE (Frontend)  
**Test environment:** Local dev (PostgreSQL 127.0.0.1:5432, API :3000, Web :5173)

---

## Backend B2–B5 ✅

### Files changed
- `pms-eng-api/src/modules/schedule/schedule.service.ts` — Fixed `endTime <= startTime` validation (removed `false &&`)
- `pms-eng-api/src/modules/schedule/schedule.service.ts` — Added internal overlap check for shift-following batch
- `pms-eng-api/src/modules/classes/classes.service.ts` — Enforced branch scope: managers cannot filter classes outside their branches
- `pms-eng-api/src/modules/classes/classes.service.spec.ts` — Added regression test for branch scope (4.1-TC-03)

### Test results
```
npx jest --runInBand src/modules/schedule src/modules/classes
Test Suites: 3 passed, 3 total
Tests:       96 passed, 96 total
Time:        5.601 s
```

### Build verification
```
npm run build
✔ nest build completed successfully
```

### API endpoints tested
- `POST /api/auth/login` → 200 OK (token obtained)
- `GET /api/sessions/my-schedule?from=2026-01-01&to=2026-12-31` → 200 OK, total=1
- `GET /api/reports/teaching-hours?from=2026-01-01&to=2026-12-31` → 200 OK, items=1, totalHours=2

### Confirmed behaviors
- `rescheduleSession` rejects `endTime <= startTime` (2 unit tests now pass)
- `shiftFollowing` validates internal overlaps before transaction
- Conflict detection skips CANCELLED sessions
- `getMySchedule` derives teacher from JWT (no `teacherId` param accepted)
- `getTeachingHours` only counts completed sessions (excludes future/CANCELLED)
- `ClassesService.listClasses` respects branch scope for managers
- Teacher data always mapped through `toPublicUser` (no `passwordHash`/`googleSub` leak)

---

## Frontend B6 ✅

### Files changed/created
- `dreamhigh-web/src/services/schedulingApi.ts` — API wrapper for all Phase B endpoints
- `dreamhigh-web/src/types/scheduling.ts` — Type definitions
- `dreamhigh-web/src/utils/scheduling.ts` — Utility functions
- `dreamhigh-web/src/pages/Classes/MySchedulePage.tsx` — Teacher personal schedule page
- `dreamhigh-web/src/pages/Classes/ScheduleGeneratorModal.tsx` — Session generation modal
- `dreamhigh-web/src/pages/Reports/TeachingHoursPage.tsx` — Teaching hours report
- `dreamhigh-web/src/pages/Classes/ClassScheduleManagement.tsx` — Updated to use real API
- `dreamhigh-web/src/pages/Classes/ClassModal.tsx` — Updated to use real API
- `dreamhigh-web/src/pages/Classes/SessionActionModal.tsx` — Updated to use real API
- `dreamhigh-web/src/App.tsx` — Registered Phase B routes
- **Removed:** `dreamhigh-web/src/mock/classSchedule.ts`, `dreamhigh-web/src/types/classSchedule.ts`

### Build verification
```
npm run build
✓ 2001 modules transformed
✓ built in 1.59s
dist/index.html                   0.77 kB │ gzip:   0.41 kB
dist/assets/index-P4-aUCMh.css   52.22 kB │ gzip:   9.00 kB
dist/assets/index-DpsE5UyQ.js   785.44 kB │ gzip: 207.81 kB
```

### Browser verification (with backend running)
**Login:** ADMIN account from seed → `/dashboard` (200 OK)

**Route: `/classes/my-schedule`** (Lịch cá nhân)
- Rendered: "Lịch dạy của tôi"
- Displayed 1 session from API: "11:22 – 13:22 IELTS Foundation Comprehensive PHÒNG 101 (LẦU 1)"
- Footer: "TỔNG CỘNG 1 BUỔI DẠY · MÚI GIỜ ASIA/HO_CHI_MINH"
- Console errors: 0

**Route: `/reports/teaching-hours`** (Báo cáo giờ dạy)
- Rendered: "Báo cáo giờ dạy"
- Displayed summary: "TỔNG GIỜ DẠY 2.00 giờ | TỔNG PHÚT DẠY 120 phút | SỐ GIÁO VIÊN 1"
- Table row: "Master Administrator | 1 | 120 | 2.00"
- Footer note: "Báo cáo chỉ tính các buổi đã hoàn tất và chưa bị huỷ trong khoảng ... · múi giờ Asia/Ho_Chi_Minh"
- Console errors: 0

**Route: `/classes/schedule`** (Quản lý lịch lớp)
- Rendered: "Vận hành lịch & lớp học"
- Tabs: "DANH SÁCH LỚP | LỊCH TỔNG HỢP | PHÒNG HỌC"
- Button: "MỞ LỚP MỚI"
- Table displayed 1 class: "S101-2023 | IELTS Foundation Comprehensive | 20 HỌC VIÊN | 21/10/2026 11:22 – 13:22 Phòng 101 (Lầu 1)"
- Console errors: 0

### Network requests verified
- POST `/api/auth/login` → 200 OK
- All Phase B pages successfully fetched data from backend with JWT auth
- No failed requests

### Mock removal
- `MOCK_CLASSES`, `MOCK_ROOMS`, `MOCK_SESSIONS`, `MOCK_TEACHERS` no longer referenced in Phase B scope
- Only unrelated HR mocks (`MOCK_TEACHERS` in `teacherManagement.ts`) remain for non-Phase-B pages

### States implemented
✅ Loading state (React Query `isLoading`)  
✅ Empty state (no sessions, no teaching hours)  
✅ Error state (React Query `isError`)  
✅ Retry mechanism (React Query `refetch`)  
✅ Conflict display (from API `ScheduleConflictException`)  
✅ Confirmation dialogs (reschedule, cancel, teacher/room change)

---

## Definition of Done — Phase B

### B1 Schema/Migration ✅
- [x] Schema/migration safe, `prisma validate` pass, migration runs on test DB
- [x] Session.teacherId added (nullable, fallback to TrainingClass.teacherId)
- [x] SessionChange table created with FK, index, change tracking
- [x] Indexes on (roomId, startTime), (classId, startTime), (teacherId, startTime)

### B2–B4 Backend ✅
- [x] DTO, API, auth/RBAC, branch scope, transaction, audit/history
- [x] Conflict detection ignores CANCELLED sessions
- [x] Boundary case `end == start` is not a conflict
- [x] Shift-following rollback entire batch if any session conflicts
- [x] Teacher/room changes validated and logged to SessionChange
- [x] `my-schedule` filters by JWT, no client `teacherId` accepted

### B5 ClassesService ✅
- [x] Validation of course/branch/teacher/room/capacity/lifecycle/class code unique
- [x] Branch scope enforced for managers
- [x] Teacher response always via `toPublicUser`, no credential leak
- [x] Unit tests prove no `passwordHash`/`googleSub` in response
- [x] Test case 4.1-TC-03 (branch scope) added

### B6 Frontend ✅
- [x] API client integration via `apiClient` + React Query
- [x] Mock removed from Phase B flows (ClassScheduleManagement, ClassModal, SessionActionModal)
- [x] Loading/empty/error/conflict/confirm states
- [x] Teacher self-schedule view (my-schedule)
- [x] Teaching hours report view
- [x] Design system components used (AppLayout, PageHeader, Card, Button, Input)

### Overall ✅
- [x] Unit tests: `conflict.util.spec.ts`, `schedule.service.spec.ts`, `classes.service.spec.ts` pass (96/96)
- [x] Integration: E2E-style curl tests pass against running API
- [x] Frontend: typecheck/build pass, browser verification confirms render + API call
- [x] Test case suite mapping documented in DEV_GUIDE
- [x] `npm run build`, `npx jest --runInBand`, `npm run prisma:validate` all pass
- [x] No commit/push yet (as instructed)

---

## Remaining risks / decisions

1. **Timezone handling:** Code uses `appTimezone` constant; verified in responses (`Asia/Ho_Chi_Minh`). Production deployment must confirm server/DB timezone alignment.
2. **Completed-session definition:** Currently `endTime <= now && status != CANCELLED`. No explicit `COMPLETED` status in Session enum; works as intended for Phase B.
3. **Teacher-per-session:** Implemented as nullable `Session.teacherId` with fallback to class teacher. Migration backfills NULL. Conflict checks use resolved teacherId. Works correctly.
4. **Branch scope edge cases:** SuperAdmin bypasses branch restrictions. Other roles filtered by `user.branchIds`. Test coverage: manager cannot list classes outside branches.
5. **Export CSV:** Teaching hours page has "XUẤT CSV" button in UI; backend does not yet implement CSV export endpoint. Requires follow-up if user clicks.

---

## Next dependency

- **Phase C:** Attendance/grades/alerts (not in scope of Phase B)
- **Phase E:** Integration/CI hardening if applicable
- **Production readiness:** Seed data is dev-only; production needs real course/class/user setup

---

**Conclusion:** Phase B (Scheduling & Sessions) meets all DoD criteria. Backend verified by unit tests + API calls. Frontend verified by build + browser + network inspection. Ready for review and commit.
