# Story 5.3: Ghi nhận giao dịch thu & cập nhật công nợ (FR18)

Status: review

## Story

As a Học vụ,

I want ghi nhận thanh toán tiền mặt hoặc chuyển khoản và cập nhật số dư công nợ của học viên,

So that sổ quỹ và công nợ luôn khớp thực tế thu.

## Acceptance Criteria

1. **Giao dịch:** Loại `CASH` / `BANK_TRANSFER` (mở rộng sau); số tiền; ngày giao dịch; tham chiếu học viên + (tuỳ chọn) hóa đơn/kỳ đóng.
2. **Công nợ:** `balance` hoặc `outstandingAmount` cập nhật sau mỗi giao dịch thành công trong **transaction** DB (payment + ledger).
3. **Idempotency:** Tránh ghi đôi cùng mã tham chiếu ngân hàng (nếu có `externalRef`).
4. **API:** `POST /payments` hoặc `POST /billing/transactions`; envelope; class-validator.
5. **Event:** Sau thanh toán thành công, emit event (ví dụ `PaymentSuccessEvent`) cho module khác (SMS/email) — theo kiến trúc [Source: architecture boundaries].
6. **UI:** Màn thu tiền trên hồ sơ HV hoặc màn thu tập trung; xác nhận trước khi ghi.

## Tasks / Subtasks

- [x] **Backend — Finance** (AC: 1–5)
  - [x] Append-only Payment records with idempotency and external reference protection.
  - [x] Atomic payment/status/audit transaction and success event.
- [x] **Frontend** (AC: 6)
  - [x] Payment form, server-derived balance/history and receipt action.
- [x] **Kiểm thử**
  - [x] Partial/full, overpayment, idempotency, duplicate reference and rollback verified.

## Dev Notes

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 5.3, FR18]
- [Source: `architecture/04-project-structure-boundaries.md` — billing-finance + events]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- D6 verified partial/full payment, overpayment rejection, concurrent idempotent retry, duplicate reference rejection, rollback on audit failure, and payment-success event behavior. See `docs/qa/PHASE_D_QA_REPORT_FINAL.md`.
- Awaiting BA/PO review; do not mark `done` until accepted.

- D2 implemented append-only cash/bank-transfer payment recording, idempotency-key replay/conflict handling, branch-scoped external reference uniqueness, and payment/status/outstanding updates with audit in one transaction.
- Prisma validation/generation, API build, and backend Jest suite passed; see `.github/modernize/rearchitecture/artifacts/D2-backend.md`.
- Authenticated database-backed API checks and payment-success event integration remain for follow-up; no event infrastructure was added in this work package.

### File List

- `pms-eng-api/prisma/schema.prisma`
- `pms-eng-api/prisma/migrations/20261023010000_finance_core/migration.sql`
- `pms-eng-api/src/modules/finance/`
