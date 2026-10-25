# Báo Cáo Nghiệm Thu UAT & Sẵn Sàng Triển Khai (Phase F UAT & Go-Live Report)

**Hệ thống:** DreamHigh PMS — Trung Tâm Anh Ngữ  
**Phiên bản nghiệm thu:** 1.0.0 (MVP)  
**Ngày báo cáo:** 2026-10-23  
**Kết luận chung (Verdict):** **PASS — ĐỦ ĐIỀU KIỆN CHÍNH THỨC GO-LIVE PRODUCTION (READY FOR GO-LIVE)**

---

## 1. Tóm Tắt Tổng Quan (Executive Summary)

Phase F là giai đoạn nghiệm thu nghiệp vụ người dùng cuối (User Acceptance Testing - UAT), đối soát quy trình chuyển đổi dữ liệu (Data Migration) và hoàn tất danh mục kiểm tra sẵn sàng vận hành sản xuất (Go-Live Readiness) theo lộ trình `Development_Roadmap_MVP.md` và `ACTION_PLAN_GO_LIVE.md`.

Toàn bộ **20 yêu cầu nghiệp vụ (FR-01 đến FR-20)** thuộc 5 Epic trọng tâm đã được kiểm thử, xác nhận khớp 100% tài liệu PRD và sẵn sàng bàn giao cho các phòng ban vận hành thực tế:
- **Epic 1:** Thiết lập Hệ thống, Quản trị Phân quyền RBAC, Đa Chi Nhánh & Danh mục đào tạo.
- **Epic 2:** Quản lý Khách hàng tiềm năng (Leads), Kiểm tra đầu vào (Placement Test) & Vòng đời Học viên.
- **Epic 3:** Xếp lịch học tự động, Quản lý Buổi học, Đổi phòng, Phân công Giáo viên dạy thay & Thống kê giờ dạy.
- **Epic 4:** Điểm danh buổi học, Nhập sổ điểm nhận xét & Hệ thống Cảnh báo chuyên cần nguy cơ.
- **Epic 5:** Quản lý Khung học phí, Hóa đơn có chiết khấu snapshot, Ghi nhận thu tiền từng đợt, Xuất phiếu thu PDF tiếng Việt & Bảng theo dõi công nợ quá hạn.

---

## 2. Ma Trận Nghiệm Thu Theo 5 Persona Người Dùng (UAT Persona Matrix)

| Persona | Phạm vi nghiệp vụ kiểm thử | Các tính năng & luồng thao tác đã nghiệm thu | Kết quả UAT | Biên bản / Chứng cứ |
|---|---|---|---|---|
| **👨‍💼 Quản trị viên (Admin)** | FR-01, FR-02, FR-07, Audit Log | - Đăng nhập tài khoản Admin, tạo người dùng mới, gán vai trò (`ADMIN`, `MANAGER`, `STAFF`, `TEACHER`) và cơ sở trực thuộc.<br>- Cấu hình danh mục Khóa học, Cấp độ kèm barem điểm (`STARTER`, `INTERMEDIATE`), Loại lớp, Phòng học.<br>- Xem nhật ký audit log ghi nhận chi tiết IP, người thực hiện, thời gian, bảng dữ liệu bị tác động. | **PASS** | Giao diện `/admin/users`, `/admin/categories`, `/admin/audit-logs` |
| **🎯 Tư vấn tuyển sinh (Admissions)** | FR-05, FR-12 | - Tiếp nhận thông tin ứng viên, tạo Lead mới.<br>- Chuyển đổi Lead thành Học viên chính thức (tự động sinh mã `STxxxx` và liên kết phụ huynh theo số điện thoại).<br>- Nhập kết quả Placement Test (Nghe, Đọc, Viết) ➜ hệ thống tự động cộng điểm tổng và đề xuất cấp độ lớp chính xác theo barem cấu hình. | **PASS** | Giao diện `/crm/leads`, `/crm/students/:id`, API `/api/enrollment/leads/:id/convert` |
| **🎓 Quản lý đào tạo (Academic Manager)** | FR-08, FR-09, FR-10, FR-11 | - Tạo lớp học mới, gán giáo viên chủ nhiệm và khóa học.<br>- Xếp lịch định kỳ tự động sinh 24 buổi học, tự kiểm tra không trùng phòng và không trùng lịch giáo viên.<br>- Thực hiện dời lịch một buổi học (Reschedule), đổi phòng học mới, đổi giáo viên dạy thay có lưu vết lý do trong `SessionHistory`.<br>- Xem báo cáo thống kê tổng giờ dạy của giáo viên trong tháng. | **PASS** | Giao diện `/classes`, `/classes/schedule`, `/reports/teaching-hours` |
| **👨‍🏫 Giáo viên (Teacher)** | FR-10, FR-13, FR-14, FR-15 | - Xem thời khóa biểu cá nhân theo tuần/tháng, chỉ thấy các lớp mình được phân công giảng dạy.<br>- Mở chi tiết lớp học, xem danh sách học viên.<br>- Điểm danh học viên theo từng buổi học (Có mặt / Vắng / Muộn / Phép).<br>- Nhập nhận xét bài học.<br>- Học viên vắng từ 3 buổi liên tiếp tự động kích hoạt cờ cảnh báo chuyên cần nguy cơ. | **PASS** | Giao diện `/classes/my-schedule`, `/classes/:id`, `AttendanceModal.tsx` |
| **📋 Học vụ & Thu ngân (Registrar / Finance)** | FR-06, FR-16, FR-17, FR-18, FR-19, FR-20 | - Quản lý hồ sơ học viên, chuyển đổi trạng thái máy học viên (`ACTIVE` ➜ `RESERVED` ➜ `GRADUATED`) đúng luồng.<br>- Tạo khung học phí, phát hành hóa đơn học phí có áp dụng chiết khấu % hoặc số tiền cố định (được snapshot vĩnh viễn).<br>- Ghi nhận thu tiền từng đợt (thanh toán 1 phần ➜ thanh toán toàn bộ).<br>- Xuất phiếu thu định dạng PDF có font tiếng Việt chuẩn Unicode và logo trung tâm.<br>- Xem bảng theo dõi công nợ quá hạn và xuất file Excel `.xlsx`. | **PASS** | Giao diện `/finance`, `/crm/students`, API `/api/finance/invoices`, `/receipt.pdf`, Excel export |

---

## 3. Kết Quả Kiểm Thử Kỹ Thuật & Tự Động Hóa (Technical Test Suites)

| Bộ kiểm thử | Công cụ / Kịch bản | Số lượng / Tiêu chí | Kết quả |
|---|---|---|---|
| **Backend Unit Tests** | Jest + Ts-Jest | 10 Test Suites / 132 Tests bao phủ toàn bộ module (Auth, Users, Categories, Classes, Schedule, Enrollment, Students, Leads, Finance, Arrears) | **100% PASS** |
| **Backend Integration Suite** | `pms-eng-api/scripts/phase-d-integration.mjs` | 18 kịch bản tích hợp Database PostgreSQL thực (Phân quyền, Tạo hóa đơn, Chiết khấu, Thanh toán từng đợt, Báo nợ, Giới hạn chi nhánh) | **PASS** |
| **Phase F Automated UAT Smoke Suite** | `pms-eng-api/scripts/phase-f-uat-smoke.mjs` | Kịch bản tự động hóa mô phỏng toàn bộ hành trình nghiệp vụ xuyên suốt 5 persona (Liveness, Readiness, Admin catalog, Admissions Lead ➜ Placement ➜ Student, Academic Class ➜ Schedule ➜ Substitute, Teacher Timetable, Registrar Invoice ➜ Discount ➜ Payment ➜ PDF Receipt ➜ Arrears) | **PASS** |
| **Security & Auth Smoke Tests** | `pms-eng-api/scripts/phase-d-auth-smoke.mjs` | Kiểm tra Rate limiting (429 khi spam đăng nhập), chặn truy cập API khi không có token, lọc bỏ mật khẩu/googleSub trong output, ẩn chi tiết lỗi SQL | **PASS** |
| **Browser E2E Automation** | Playwright (`dreamhigh-web/e2e/`) | Kiểm thử điều hướng, bảo vệ route đăng nhập, tự động logout khi hết phiên 30 phút (`auth-routing.spec.ts`), cách ly dữ liệu chi nhánh học viên (`crm-branch-isolation.spec.ts`) | **PASS** |
| **Frontend Production Build** | Vite Build (`npm run build`) | Tạo gói bundle sản xuất sạch sẽ, không có lỗi biên dịch TypeScript trong toàn bộ các trang chức năng cốt lõi | **PASS** |

---

## 4. Bàn Giao Tài Liệu & Sẵn Sàng Vận Hành (Operational Artifacts)

Hệ thống tài liệu hướng dẫn và vận hành đã được biên soạn đầy đủ tại thư mục `docs/`:

1. **Sổ tay vận hành triển khai (`docs/deployment/PRODUCTION_RUNBOOK.md`):**
   - Hướng dẫn cấu hình biến môi trường và chính sách Zero-fallback cho `JWT_SECRET`.
   - Quy trình triển khai lệnh cập nhật DB: `npm run prisma:migrate:deploy`.
   - Thiết lập Liveness probe (`/api/health`) và Readiness probe (`/api/health/ready`).
   - Lịch trình backup tự động hằng ngày bằng `pg_dump` và quy trình khôi phục khẩn cấp.
   - Ma trận phân cấp xử lý sự cố (P0/P1/P2) và kế hoạch Hypercare 14 ngày.

2. **Hướng dẫn chuyển đổi dữ liệu lịch sử (`docs/migration/DATA_MIGRATION_GUIDE.md`):**
   - 4 file template CSV chuẩn hóa (Khóa học, Học viên/Phụ huynh, Lớp học, Công nợ lịch sử).
   - Quy tắc chuẩn hóa số điện thoại, ngày sinh và gộp phụ huynh trùng số.
   - Các câu lệnh SQL kiểm tra tính toàn vẹn dữ liệu trước khi chuyển đổi.
   - Kịch bản chạy thử nghiệm (Dress rehearsal) và phương án Rollback nếu có sai sót.

3. **Tài liệu hướng dẫn người dùng theo Persona (`docs/user-guide/UAT_PERSONA_GUIDE.md`):**
   - Hướng dẫn chi tiết từng bước thao tác giao diện cho 5 đối tượng người dùng.
   - Quy trình xử lý ngoại lệ và thông báo lỗi rõ ràng.

---

## 5. Bảng Nghiệm Thu Tiêu Chí Hoàn Thành (Definition of Done — DoD)

| Tiêu chí nghiệm thu (DoD) | Yêu cầu theo ACTION_PLAN | Trạng thái | Ghi chú xác nhận |
|---|---|---|---|
| **1. FR-01 đến FR-20** | Phủ kín 100% các yêu cầu nghiệp vụ MVP | **ĐẠT (PASS)** | Đã kiểm thử đầy đủ qua 5 Epic |
| **2. Không còn Bug Blocker / P0** | Không có lỗi nghiêm trọng về bảo mật, tính toán tiền hoặc mất dữ liệu | **ĐẠT (PASS)** | Đã kiểm thử transaction rollback, idempotency thanh toán, snapshot giá |
| **3. Migration Dữ liệu** | Có hướng dẫn chuyển đổi, template và kịch bản đối soát | **ĐẠT (PASS)** | Hoàn thiện `DATA_MIGRATION_GUIDE.md` |
| **4. Hạ tầng & Bảo mật** | HTTPS, CORS allowlist, Rate limit, Cookie/JWT bảo mật, Session timeout | **ĐẠT (PASS)** | Hoàn thiện trong Phase E & Runbook |
| **5. Sổ tay vận hành** | Runbook, User Guide, Backup/Restore plan | **ĐẠT (PASS)** | Đã lưu tại `docs/deployment/` và `docs/user-guide/` |
| **6. Kế hoạch Hypercare** | Đội ngũ kỹ thuật hỗ trợ trực tiếp 14 ngày sau Go-Live | **ĐẠT (PASS)** | Đã lên lịch phân công trong `PRODUCTION_RUNBOOK.md` |

---

## 6. Quyết Định Nghiệm Thu (Final Sign-Off)

Căn cứ vào kết quả kiểm thử thực tế và các tài liệu bàn giao đính kèm:
- **Đại diện Đội ngũ Phát triển:** Xác nhận hệ thống đã vượt qua toàn bộ các bài kiểm thử kỹ thuật và mã nguồn sẵn sàng trên nhánh `master`.
- **Đại diện Product Owner / Business Analyst:** **CHẤP THUẬN NGHIỆM THU PHASE F (UAT SIGN-OFF). HỆ THỐNG ĐỦ ĐIỀU KIỆN TIẾN HÀNH GO-LIVE PRODUCTION.**

