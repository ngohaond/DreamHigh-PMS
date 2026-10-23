# Story 2.3: Ghi nhận Placement Test & gợi ý cấp độ (FR12)

Status: review

## Story

As a Tư vấn viên (hoặc Học vụ),

I want nhập điểm bài kiểm tra xếp lớp đầu vào (Placement) và nhận gợi ý cấp độ / khóa phù hợp,

So that tư vấn chốt lớp đúng trình độ và giảm sai lệch phân lớp.

## Acceptance Criteria

1. **Điều kiện:** Chỉ ghi nhận placement cho học viên đã có hồ sơ (Story 2.1).
2. **Nhập điểm:** Form nhập các kỹ năng theo BA (tối thiểu: Listening, Reading, Writing — hoặc bộ điểm đã thống nhất); validate khoảng điểm (Zod + UI).
3. **Barem:** Sau khi lưu, backend tính tổng/điểm quy đổi và **map** sang `Level` (hoặc dải điểm) trong master data (Story 1.2): `minScore ≤ điểm ≤ maxScore` (hoặc quy tắc bảng lookup).
4. **Hiển thị:** Màn hình hiển thị rõ **Cấp độ / chương trình gợi ý** (badge nổi bật theo DS — ví dụ gold) để tư vấn thấy ngay.
5. **Lưu trữ:** Bản ghi placement gắn `studentId`, điểm từng kỹ năng, ngày thi, `recommendedLevelId` (nullable nếu không khớp barem).
6. **API:** Envelope; transaction khi ghi DB + cập nhật gợi ý.

## Tasks / Subtasks

- [x] **Backend** (AC: 3, 5, 6)
  - [x] Model Prisma `PlacementTest`: student, skill scores, total, `recommendedLevelId`, branch/program, test date.
  - [x] Student-scoped POST + GET history endpoints with validation and authorization.
  - [x] Lookup configured active Level bounds; reject overlapping ranges.
- [x] **Frontend** (AC: 2, 4)
  - [x] Student detail form validates scores and displays persisted recommendations.
  - [x] Kept the form in the existing page; a separate component was not needed.
- [x] **Kiểm thử**
  - [x] Boundary, no-match, persistence, remapping and browser form submission verified.

## Dev Notes

### Phụ thuộc

- **Story 1.2:** Cấu hình Level / barem trong danh mục; nếu chưa có API, có thể mock mapping trong FE tạm thời (ghi chú nợ technical).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 2.3, FR12]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- D1 implementation adds persisted placement tests and student-scoped POST/GET endpoints with branch and teacher-assignment checks.
- Placement totals map to inclusive `Level.minPlacementScore` / `Level.maxPlacementScore` ranges. No score ranges were invented or seeded; configure both bounds on each active Level before using recommendations.
- Verification: Prisma validate/generate, API build, API Jest suite, focused enrollment tests, and frontend production build. Detailed handoff: `.github/modernize/rearchitecture/artifacts/D1-backend.md`.
- D6 isolated PostgreSQL/API and browser checks pass persistence, configured-bound remapping, and form submission. Story is in review; configure operational Level bounds and obtain BA/PO sign-off before `done`.

### File List

- `pms-eng-api/prisma/schema.prisma`
- `pms-eng-api/prisma/migrations/20261023000000_placement_tests/migration.sql`
- `pms-eng-api/src/modules/categories/categories.service.ts`
- `pms-eng-api/src/modules/enrollment/dto/create-placement-test.dto.ts`
- `pms-eng-api/src/modules/enrollment/enrollment.controller.ts`
- `pms-eng-api/src/modules/enrollment/enrollment.module.ts`
- `pms-eng-api/src/modules/enrollment/enrollment.service.ts`
- `pms-eng-api/src/modules/enrollment/enrollment.service.spec.ts`
- `dreamhigh-web/src/pages/CRM/StudentApiDetailPage.tsx`
