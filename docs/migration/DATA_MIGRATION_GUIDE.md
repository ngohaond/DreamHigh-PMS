# Hướng Dẫn Chuyển Đổi Dữ Liệu (Data Migration Guide) — DreamHigh PMS

**Phiên bản:** 1.0 (Phase F — Go-Live)  
**Mục tiêu:** Chuyển đổi và đối soát toàn bộ dữ liệu lịch sử từ file bảng tính Excel/CSV của trung tâm vào cơ sở dữ liệu PostgreSQL của DreamHigh PMS mà không làm gián đoạn vận hành hoặc sai lệch công nợ.

---

## 1. Nguyên Tắc & Quy Trình Chuyển Đổi

Quy trình chuyển đổi tuân thủ nghiêm ngặt 5 bước:
1. **Thu thập & Làm sạch (Extract & Cleanse):** Chuẩn hóa file Excel từ các cơ sở theo mẫu chuẩn (`.csv` UTF-8).
2. **Đối soát & Chuyển đổi (Transform & Validate):** Kiểm tra trùng lặp điện thoại, email, mã lớp, mã học viên.
3. **Thử nghiệm Staging (Dress Rehearsal):** Chạy script import trên môi trường Staging/Test và đối soát 100% số dư công nợ.
4. **Nghiệm thu Dữ liệu (Business Sign-off):** Bộ phận Học vụ và Kế toán ký biên bản xác nhận số liệu.
5. **Cắt chuyển Production (Cutover & Live Import):** Thực hiện trong khung giờ bảo trì (Maintenance Window), có sao lưu (Backup) trước khi chạy.

---

## 2. Đặc Tả Cấu Trúc File Dữ Liệu Mẫu (CSV Schemas)

### 2.1. File 1: Danh mục Khóa học & Cấp độ (`01_courses_levels.csv`)
| Tên cột | Bắt buộc | Định dạng | Ví dụ | Diễn giải |
|---|---|---|---|---|
| `program_code` | Có | Chuỗi (A-Z, 0-9) | `KIDS` | Mã chương trình (Tiếng Anh Trẻ Em) |
| `program_name` | Có | Chuỗi | `Tiếng Anh Thiếu Nhi` | Tên chương trình |
| `level_code` | Có | Chuỗi | `STARTER` | Cấp độ |
| `min_score` | Có | Số (0-100) | `0` | Điểm sàn placement test |
| `max_score` | Có | Số (0-100) | `49` | Điểm trần placement test |
| `course_code` | Có | Chuỗi duy nhất | `ENG-KID-01` | Mã khóa học |
| `course_name` | Có | Chuỗi | `Super Kids 1` | Tên khóa học |
| `total_sessions`| Có | Số nguyên (>0) | `24` | Tổng số buổi học |
| `tuition_fee` | Có | Số tiền (VND) | `4500000` | Học phí niêm yết |

### 2.2. File 2: Học viên & Phụ huynh (`02_students_parents.csv`)
| Tên cột | Bắt buộc | Định dạng | Ví dụ | Diễn giải |
|---|---|---|---|---|
| `student_code` | Có | Chuỗi duy nhất | `ST1001` | Mã học viên |
| `full_name` | Có | Chuỗi tiếng Việt | `Nguyễn Hoàng Long`| Tên học viên |
| `dob` | Có | `YYYY-MM-DD` | `2015-06-20` | Ngày sinh |
| `gender` | Không | `MALE` / `FEMALE` / `OTHER` | `MALE` | Giới tính |
| `branch_code` | Có | Chuỗi mã cơ sở | `HN-CG` | Cơ sở trực thuộc |
| `status` | Có | Enum | `ACTIVE` | `ACTIVE`, `RESERVED`, `DROPPED`, `GRADUATED` |
| `parent_name` | Có | Chuỗi tiếng Việt | `Nguyễn Văn Hùng` | Họ tên phụ huynh |
| `parent_phone`| Có | SĐT VN (10 chữ số) | `0912345678` | Số điện thoại phụ huynh (Khóa chính định danh) |
| `parent_email`| Không | Email hợp lệ | `hung.nv@gmail.com`| Email phụ huynh |

> **Quy tắc làm sạch:**
> - Số điện thoại: Chuẩn hóa loại bỏ khoảng trắng, dấu chấm, dấu gạch nối, chuyển tiền tố `+84` thành `0`.
> - Nếu một phụ huynh có 2 con: `parent_phone` trùng nhau sẽ tự động map vào cùng 1 bản ghi `Parent`, tránh tạo bản ghi trùng lặp.

### 2.3. File 3: Lớp học & Xếp lớp (`03_classes_enrollments.csv`)
| Tên cột | Bắt buộc | Định dạng | Ví dụ | Diễn giải |
|---|---|---|---|---|
| `class_code` | Có | Chuỗi duy nhất | `ENG-K1-2026A` | Mã lớp học |
| `course_code` | Có | Khóa ngoại | `ENG-KID-01` | Khóa học tương ứng |
| `branch_code` | Có | Khóa ngoại | `HN-CG` | Cơ sở mở lớp |
| `teacher_email`| Có | Email GV | `teacher.lan@dreamhigh.edu.vn` | Giáo viên chủ nhiệm |
| `room_code` | Có | Khóa ngoại | `R201` | Phòng học chính |
| `start_date` | Có | `YYYY-MM-DD` | `2026-03-01` | Ngày khai giảng |
| `end_date` | Không | `YYYY-MM-DD` | `2026-06-01` | Ngày kết thúc dự kiến |
| `max_students`| Có | Số nguyên | `18` | Sĩ số tối đa |
| `status` | Có | Enum | `ACTIVE` | `PLANNED`, `ACTIVE`, `COMPLETED` |
| `student_code_list` | Không | Danh sách cách nhau dấu phẩy | `ST1001,ST1002,ST1003` | Danh sách học viên đang theo học |

### 2.4. File 4: Hóa đơn & Công nợ Lịch sử (`04_historical_invoices.csv`)
| Tên cột | Bắt buộc | Định dạng | Ví dụ | Diễn giải |
|---|---|---|---|---|
| `invoice_code` | Có | Chuỗi duy nhất | `INV-2026-001` | Số hóa đơn gốc |
| `student_code` | Có | Khóa ngoại | `ST1001` | Mã học viên |
| `class_code` | Có | Khóa ngoại | `ENG-K1-2026A` | Lớp học tính phí |
| `original_amount` | Có | Tiền VND | `4500000` | Số tiền trước giảm trừ |
| `discount_amount` | Không | Tiền VND | `500000` | Số tiền đã miễn giảm |
| `final_amount` | Có | Tiền VND | `4000000` | Tiền phải đóng thực tế |
| `paid_amount` | Có | Tiền VND | `2000000` | Số tiền đã thực đóng |
| `due_date` | Có | `YYYY-MM-DD` | `2026-03-10` | Ngày hạn đóng học phí |
| `payment_method` | Không | Enum | `BANK_TRANSFER`| `CASH`, `BANK_TRANSFER`, `POS` |
| `reference_code` | Không | Chuỗi | `MB-987654` | Mã giao dịch ngân hàng cũ |

---

## 3. Kịch Bản & Kiểm Tra Dữ Liệu Tự Động (Data Integrity Checks)

Trước khi chuyển dữ liệu sang Production, hệ thống chạy script kiểm tra toàn vẹn SQL:

```sql
-- 1. Kiểm tra học viên mồ côi (không có chi nhánh hoặc không có phụ huynh)
SELECT s."studentCode", s."fullName"
FROM "Student" s
LEFT JOIN "Parent" p ON s."parentId" = p.id
WHERE p.id IS NULL OR s."branchId" IS NULL;

-- 2. Kiểm tra lớp học không có giáo viên hợp lệ
SELECT c."classCode", c."teacherId"
FROM "TrainingClass" c
LEFT JOIN "SystemUser" u ON c."teacherId" = u.id
WHERE u.id IS NULL;

-- 3. Kiểm tra số dư công nợ hóa đơn không âm và khớp với bảng Payment
SELECT i.id, i."invoiceNumber", i."finalAmount",
       COALESCE(SUM(p.amount), 0) AS total_paid,
       (i."finalAmount" - COALESCE(SUM(p.amount), 0)) AS computed_outstanding
FROM "Invoice" i
LEFT JOIN "Payment" p ON p."invoiceId" = i.id
GROUP BY i.id
HAVING (i."finalAmount" - COALESCE(SUM(p.amount), 0)) < 0;
```

---

## 4. Kế Hoạch Cắt Chuyển (Cutover Runbook) & Rollback

### 4.1. Lịch trình giờ G (Maintenance Window)
- **T-24h:** Khóa tính năng tạo mới học viên/thu tiền trên hệ thống cũ. Xuất file dữ liệu chốt cuối ngày.
- **T-2h:** Tạo bản sao lưu (Full Database Backup) trên hệ thống production:
  ```bash
  pg_dump -h $DB_HOST -U $DB_USER -d dreamhigh_prod -F c -b -v -f /backups/pre_migration_backup_$(date +%Y%m%d_%H%M%S).dump
  ```
- **T-0:** Thực thi script import tuần tự:
  1. Branches & Rooms
  2. Programs, Levels & Courses
  3. System Users & Staff/Teacher accounts
  4. Parents & Students
  5. Classes, Sessions & ClassEnrollments
  6. Invoices, Payments & Receipts
- **T+1h:** Đối soát tổng số dư công nợ toàn hệ thống giữa Excel kế toán và báo cáo `/api/reports/arrears`.
- **T+2h:** Ký biên bản nghiệm thu chuyển đổi dữ liệu và mở cổng hệ thống cho người dùng.

### 4.2. Phương Án Phục Hồi Dữ Liệu (Rollback Plan)
Nếu phát sinh sai lệch không thể khắc phục trong thời gian bảo trì:
```bash
# 1. Dừng ứng dụng API
npm run pm2:stop || systemctl stop dreamhigh-api

# 2. Khôi phục lại bản sao lưu trước khi migration
pg_restore -h $DB_HOST -U $DB_USER -d dreamhigh_prod --clean --if-exists /backups/pre_migration_backup_*.dump

# 3. Khởi động lại ứng dụng và thông báo sự cố
npm run pm2:start || systemctl start dreamhigh-api
```

