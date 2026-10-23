# Story 5.2: Thiết lập ưu đãi / cấn trừ học phí (FR17)

Status: review

## Story

As a Tư vấn hoặc Học vụ,

I want ghi nhận ưu đãi (% hoặc số tiền cố định) cho **một học viên** hoặc gói đăng ký,

So that số tiền phải thu phản hợp lệ (sau khung giá Story 5.1).

## Acceptance Criteria

1. **Loại ưu đãi:** Hỗ trợ **phần trăm** và/hoặc **số tiền** cố định; không cho tổng cấn trừ vượt số tiền phải thu (validate).
2. **Phạm vi:** Gắn `studentId` + (tuỳ chọn) `enrollmentId` / `classId` / kỳ thanh toán; lý do/mã khuyến mãi (audit).
3. **API:** `POST`/`PATCH` discount record; envelope; lưu người tạo, thời gian.
4. **Tính toán:** Service tính `amountDue = baseAmount - discount` (thứ tự áp dụng % và fix theo nghiệp vụ — ghi rõ trong code comment).
5. **UI:** Form trên hồ sơ HV hoặc màn thanh toán; hiển thị breakdown trước khi thu.

## Tasks / Subtasks

- [x] **Backend** (AC: 1–4)
  - [x] Per-invoice percentage or fixed discount snapshot with VND validation.
- [x] **Frontend** (AC: 5)
  - [x] Discount preview and invoice workflow in `/finance`, with loading/error states.
- [x] **Kiểm thử**
  - [x] Percentage/fixed boundaries and over-base 400 response verified. Combined discount types are N/A by BA decision.

## Dev Notes

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 5.2, FR17]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- D6 verified percentage/fixed discounts, VND rounding, and 400 rejection when discount exceeds base. One discount per invoice follows Business Decision Register v0.2; combined percentage+fixed test is N/A by BA decision. See `docs/qa/PHASE_D_QA_REPORT_FINAL.md`.
- Awaiting BA/PO review; do not mark `done` until accepted.

- D2 implemented one percentage or fixed-amount discount per invoice, using decimal percentage arithmetic and flooring the final VND amount. Discount is snapshotted on invoice; no separate discount CRUD or frontend was added.
- Prisma validation/generation, API build, and backend Jest suite passed; see `.github/modernize/rearchitecture/artifacts/D2-backend.md`.

### File List

- `pms-eng-api/prisma/schema.prisma`
- `pms-eng-api/prisma/migrations/20261023010000_finance_core/migration.sql`
- `pms-eng-api/src/modules/finance/`
