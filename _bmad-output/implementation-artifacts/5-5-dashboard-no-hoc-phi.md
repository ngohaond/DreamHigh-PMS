# Story 5.5: Dashboard / báo cáo công nợ & nợ quá hạn (FR20)

Status: review

## Story

As a Quản lý,

I want xem danh sách học viên còn nợ và các khoản **quá hạn** trên một màn tổng quan,

So that giao việc nhắc thu và điều phối chăm sóc kịp thời.

## Acceptance Criteria

1. **Chỉ số:** Tổng nợ; số HV còn nợ; tổng quá hạn (nếu có hạn thanh định kỳ — theo cấu hình kỳ học phí).
2. **Danh sách:** Bảng lọc theo chi nhánh (NFR5), tìm theo tên/mã HV; cột: HV, lớp liên quan, số nợ, hạn, trạng thái (Đúng hạn / Quá hạn).
3. **API:** `GET /reports/arrears` hoặc `GET /dashboard/finance-summary` với query filter; envelope; pagination.
4. **Quyền:** Manager/Admin/Học vụ theo scope chi nhánh; không lộ dữ liệu chi nhánh khác (NFR5).
5. **UI:** Data-centric grid; export Excel (NFR3); màu cảnh báo cho dòng quá hạn (semantic error/warning).

## Tasks / Subtasks

- [x] **Backend** (AC: 1–4)
  - [x] Branch-scoped arrears API with approved due-date semantics, filters, totals and pagination.
- [x] **Frontend** (AC: 2, 5)
  - [x] Finance dashboard, branch/date/student/status filters and all-pages XLSX export.
- [x] **Kiểm thử**
  - [x] Totals, paid/overdue rows, branch isolation and XLSX output verified.

## Dev Notes

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 5.5, FR20]
- FR liên quan: NFR2 (performance), NFR5 (branch isolation)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- D4/D5 arrears API, dashboard, filters, pagination, and XLSX export are implemented; D6 verified totals, overdue classification, branch isolation, and browser export artifact. See `docs/qa/PHASE_D_QA_REPORT_FINAL.md`.
- Awaiting BA/PO review; do not mark `done` until accepted.

### File List
