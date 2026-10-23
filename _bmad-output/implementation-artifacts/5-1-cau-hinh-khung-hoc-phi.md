# Story 5.1: Cấu hình khung học phí gốc (FR16)

Status: review

## Story

As a Học vụ hoặc Quản lý,

I want thiết lập mức học phí chuẩn (khung giá) gắn với khóa học hoặc lớp,

So that mọi giao dịch thu và công nợ có mốc giá thống nhất trước khi áp ưu đãi.

## Acceptance Criteria

1. **Đối tượng gắn giá:** Theo PRD — ít nhất một trong: **Khóa học** (course), **Lớp** (class instance), hoặc bảng giá theo chương trình/cấp độ; rõ ràng trong model và UI.
2. **CRUD:** Tạo/sửa/xem khung giá; đơn vị tiền VND; hiệu lực từ ngày (nếu cần versioning).
3. **Ngừng áp dụng:** Soft deactivate hoặc khoảng hiệu lực — không phá hợp đồng/đã thu cũ.
4. **API:** Module `billing-finance` (hoặc `system-config` nếu chỉ master); envelope; validate số không âm.
5. **Phụ thuộc Epic 1:** Liên kết `courseId` / `classId` từ master data đã có.

## Tasks / Subtasks

- [x] **Backend** (AC: 1–4)
  - [x] FeePlan schema, validation and branch ownership.
  - [x] REST CRUD/read/filter and soft deactivate.
- [x] **Frontend**
  - [x] Fee-plan management in `/finance` using the design system.
- [x] **Kiểm thử**
  - [x] Create/update/deactivate, negative amount and invoice snapshot preservation verified.

## Dev Notes

### Architecture compliance

- [Source: `architecture/04-project-structure-boundaries.md` — `billing-finance`]

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 5.1, FR16]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- D2 backend and D5 UI are implemented. D6 verified create/update/deactivate, negative amount rejection, and that an existing invoice keeps its price snapshot after plan update/deactivation. See `docs/qa/PHASE_D_QA_REPORT_FINAL.md`.
- Awaiting BA/PO review; do not mark `done` until accepted.

- D2 backend implemented fee-plan CRUD, branch/course/class validation, VND integer amount, effective date, and soft deactivation. Frontend and D6 acceptance remain.
- Prisma validation/generation, API build, and backend Jest suite passed; see `.github/modernize/rearchitecture/artifacts/D2-backend.md`.

### File List

- `pms-eng-api/prisma/schema.prisma`
- `pms-eng-api/prisma/migrations/20261023010000_finance_core/migration.sql`
- `pms-eng-api/src/modules/finance/`
