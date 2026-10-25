# DreamHigh PMS — Cẩm Nang Hướng Dẫn Nghiệm Thu Nghiệp Vụ (UAT Persona Guide)

**Mục tiêu:** Cung cấp tài liệu hướng dẫn từng bước cho các phòng ban nghiệp vụ (Admin, Quản lý đào tạo, Tư vấn tuyển sinh, Giáo viên, Học vụ/Thu ngân) thực hiện kiểm thử nghiệm thu người dùng (UAT) và vận hành hệ thống.

---

## 1. Persona 1: Quản Trị Viên Hệ Thống (System Admin)

**Đường dẫn truy cập:**
- Quản lý tài khoản & phân quyền: `/admin/users`
- Danh mục đào tạo: `/admin/categories` hoặc `/admin/category-catalog`
- Nhật ký hệ thống: `/admin/audit-logs`

### 1.1. Kịch bản kiểm thử: Phân quyền & Giới hạn chi nhánh
1. Đăng nhập với tài khoản có quyền `ADMIN`.
2. Vào màn hình **Quản trị người dùng** (`/admin/users`).
3. Tạo tài khoản mới:
   - Điền Họ tên, Email, Mật khẩu.
   - Gán vai trò (`TEACHER` hoặc `STAFF`).
   - Gán cơ sở trực thuộc (ví dụ: Cơ sở Cầu Giấy).
4. Đăng xuất và đăng nhập lại bằng tài khoản vừa tạo:
   - **Xác nhận:** Người dùng chỉ xem được dữ liệu thuộc cơ sở được gán. Các menu quản trị hệ thống (`/admin/users`, `/admin/audit-logs`) không thể truy cập (hệ thống chặn 403 hoặc tự động ẩn).

### 1.2. Kịch bản kiểm thử: Cấu hình Khung danh mục & Barem Cấp độ
1. Vào mục **Cấu hình danh mục** (`/admin/categories`).
2. Chọn loại danh mục **Cấp độ (Levels)**.
3. Kiểm tra hoặc tạo các cấp độ kèm dải điểm Placement Test:
   - Ví dụ: `STARTER` (0 - 49 điểm), `INTERMEDIATE` (50 - 79 điểm), `ADVANCED` (80 - 100 điểm).
4. Chọn danh mục **Khóa học (Courses)**:
   - Tạo khóa học mới, liên kết với Cấp độ, điền số buổi học và mức học phí chuẩn.

### 1.3. Kịch bản kiểm thử: Kiểm tra Nhật ký Audit (Audit Log)
1. Thực hiện một thao tác ghi nhận (tạo lớp, sửa học phí hoặc đổi phòng học).
2. Vào màn hình **Nhật ký hệ thống** (`/admin/audit-logs`).
3. **Xác nhận:** Thao tác vừa thực hiện hiển thị đầy đủ: Thời gian, Người thực hiện, Hành động (CREATE/UPDATE), Bảng dữ liệu và Địa chỉ IP.

---

## 2. Persona 2: Tư Vấn Tuyển Sinh (Admissions Consultant)

**Đường dẫn truy cập:**
- Danh sách khách hàng tiềm năng: `/crm/leads`
- Hồ sơ chi tiết & Placement Test: `/crm/students/:id`

### 2.1. Kịch bản kiểm thử: Tiếp nhận Lead & Chuyển đổi thành Học viên
1. Vào màn hình **Quản lý Lead** (`/crm/leads`).
2. Nhấn nút **Thêm mới Lead**:
   - Nhập Họ tên ứng viên, Số điện thoại (10 chữ số), Email, Nhu cầu tư vấn.
   - Lưu lại. Trạng thái Lead hiển thị là `NEW`.
3. Nhấn vào Lead và chọn **Chuyển đổi thành học viên (Convert to Student)**:
   - Chọn Chi nhánh tiếp nhận, Ngày sinh, Giới tính.
   - Nhấn **Xác nhận chuyển đổi**.
4. **Xác nhận:** Lead chuyển sang trạng thái `CONVERTED`. Hệ thống tự động sinh Mã học viên (ví dụ: `ST1005`) và tạo bản ghi Phụ huynh tương ứng với số điện thoại của Lead.

### 2.2. Kịch bản kiểm thử: Nhập kết quả Kiểm tra đầu vào (Placement Test)
1. Mở hồ sơ học viên vừa chuyển đổi (`/crm/students/:id`).
2. Chuyển sang tab **Kiểm tra đầu vào (Placement Test)**.
3. Nhấn **Ghi nhận điểm thi**:
   - Chọn Chương trình học quan tâm.
   - Nhập điểm: Nghe (Listening), Đọc (Reading), Viết (Writing).
   - Nhập ghi chú nhận xét của giáo viên chấm thi.
4. **Xác nhận:**
   - Hệ thống tự động tính Tổng điểm.
   - Dựa trên dải điểm cấu hình ở Cấp độ, hệ thống tự động đưa ra gợi ý Cấp độ lớp phù hợp (Recommended Level).
   - Lịch sử kiểm tra đầu vào được lưu vĩnh viễn trong hồ sơ học viên.

---

## 3. Persona 3: Quản Lý Đào Tạo (Academic Manager)

**Đường dẫn truy cập:**
- Quản lý khóa học: `/courses`
- Quản lý lớp học: `/classes`
- Xếp lịch học & sinh buổi: `/classes/schedule`
- Báo cáo giờ dạy giáo viên: `/reports/teaching-hours`

### 3.1. Kịch bản kiểm thử: Mở Lớp học & Sinh Lịch học tự động
1. Vào màn hình **Danh sách lớp học** (`/classes`).
2. Nhấn **Mở lớp mới**:
   - Chọn Khóa học, Cơ sở, Giáo viên chủ nhiệm, Sĩ số tối đa (ví dụ: 15 học viên), Ngày khai giảng.
3. Nhấn **Xếp lịch học tự động (Generate Sessions)**:
   - Chọn lịch học định kỳ trong tuần (ví dụ: Thứ 3 và Thứ 5, từ 18:00 - 20:00).
   - Chọn Phòng học chỉ định.
   - Nhập tổng số buổi học cần sinh (ví dụ: 24 buổi).
4. **Xác nhận:** Hệ thống tự động sinh danh sách 24 buổi học trong cơ sở dữ liệu, tự động bỏ qua các ngày nghỉ lễ nếu có cấu hình, và kiểm tra không trùng lịch giáo viên/phòng học.

### 3.2. Kịch bản kiểm thử: Dời lịch, Đổi phòng, Phân công Giáo viên dạy thay
1. Vào màn hình **Lịch học lớp** (`/classes/schedule`).
2. Chọn một buổi học cụ thể và bấm nút **Thao tác**:
   - **Đổi phòng học:** Chọn phòng học mới còn trống, nhập lý do.
   - **Đổi giáo viên (Dạy thay):** Chọn giáo viên khác cùng chi nhánh, nhập lý do.
   - **Dời ngày học (Reschedule):** Chọn ngày/giờ mới, có tùy chọn dời tịnh tiến các buổi tiếp theo.
3. **Xác nhận:** Thông tin buổi học cập nhật ngay lập tức. Lịch sử thay đổi được ghi nhận trong `SessionHistory`.

### 3.3. Kịch bản kiểm thử: Báo cáo Thống kê Giờ dạy
1. Vào màn hình **Báo cáo giờ dạy** (`/reports/teaching-hours`).
2. Chọn khoảng thời gian (Từ ngày - Đến ngày), lọc theo Giáo viên hoặc Cơ sở.
3. **Xác nhận:** Bảng thống kê hiển thị chi tiết tổng số giờ dạy chính thức, giờ dạy thay của từng giáo viên trong tháng để phục vụ tính lương.

---

## 4. Persona 4: Giáo Viên (Teacher)

**Đường dẫn truy cập:**
- Thời khóa biểu cá nhân: `/classes/my-schedule`
- Chi tiết lớp học & Sổ điểm: `/classes/:id`

### 4.1. Kịch bản kiểm thử: Tra cứu Thời khóa biểu Cá nhân
1. Đăng nhập bằng tài khoản Giáo viên.
2. Vào menu **Lịch dạy của tôi** (`/classes/my-schedule`).
3. **Xác nhận:**
   - Chỉ hiển thị các buổi học mà giáo viên được phân công làm giáo viên chính hoặc giáo viên dạy thay.
   - Không nhìn thấy lịch dạy của giáo viên khác.

### 4.2. Kịch bản kiểm thử: Điểm danh & Nhập Nhận xét buổi học
1. Trên màn hình lịch dạy hoặc chi tiết lớp học (`/classes/:id`), nhấn **Điểm danh buổi học**.
2. Danh sách học viên trong lớp hiển thị:
   - Tích chọn trạng thái: Có mặt (Present), Vắng mặt (Absent), Đi muộn (Late), Có phép (Excused).
   - Nhập nhận xét bài học hoặc đánh giá thái độ từng học viên.
3. Nhấn **Lưu điểm danh**.
4. **Xác nhận:** Trạng thái điểm danh được lưu thành công.
   - Nếu có học viên vắng mặt liên tiếp từ 3 buổi trở lên, hệ thống tự động gắn nhãn cảnh báo chuyên cần (`CHUYÊN CẦN NGUY CƠ`) để giáo viên và học vụ can thiệp kịp thời.

---

## 5. Persona 5: Học Vụ & Thu Ngân (Registrar / Cashier)

**Đường dẫn truy cập:**
- Hồ sơ học viên & Xếp lớp: `/crm/students`
- Thu học phí & Quản lý Công nợ: `/finance`
- Báo cáo tuổi nợ: `/reports/arrears` (tích hợp trong `/finance`)

### 5.1. Kịch bản kiểm thử: Xếp Lớp & Cập nhật Trạng thái Học viên
1. Vào danh sách học viên (`/crm/students`), chọn học viên.
2. Gán học viên vào lớp học đang hoạt động.
3. Chuyển đổi trạng thái học viên theo chu trình chuẩn:
   - `ACTIVE` (Đang học) ➜ `RESERVED` (Bảo lưu).
   - Kiểm tra ràng buộc máy trạng thái: Học viên ở trạng thái `RESERVED` không thể nhảy thẳng sang `GRADUATED` mà phải qua `ACTIVE` hoặc kết thúc khóa.

### 5.2. Kịch bản kiểm thử: Xuất Hóa đơn Học phí & Áp dụng Ưu đãi
1. Vào phân hệ **Tài chính** (`/finance`).
2. Nhấn nút **Tạo hóa đơn học phí**:
   - Chọn Học viên và Lớp học.
   - Chọn Khung học phí (Fee Plan) niêm yết (ví dụ: 4.500.000 VND).
   - Thiết lập ưu đãi: Giảm 10% (hoặc giảm cố định 500.000 VND).
   - Chọn Ngày hạn đóng học phí.
3. Nhấn **Phát hành hóa đơn**.
4. **Xác nhận:** Hóa đơn được tạo với số tiền phải thu chính xác (4.500.000 - 10% = 4.050.000 VND). Trạng thái hóa đơn là `PENDING`. Mức giá và chiết khấu được cố định (snapshot) vĩnh viễn, không bị thay đổi nếu khung học phí sau này điều chỉnh.

### 5.3. Kịch bản kiểm thử: Ghi nhận Thu tiền & In Phiếu thu PDF
1. Tại hóa đơn vừa tạo, nhấn **Ghi nhận thanh toán**:
   - **Đợt 1 (Đóng 1 phần):** Nhập 2.000.000 VND, phương thức Chuyển khoản, nhập mã giao dịch ngân hàng.
   - Nhấn **Xác nhận**.
   - **Xác nhận:** Trạng thái hóa đơn chuyển thành `PARTIALLY_PAID`, số tiền còn nợ cập nhật thành 2.050.000 VND.
2. **Đợt 2 (Hoàn tất học phí):** Nhập 2.050.000 VND, phương thức Tiền mặt.
   - **Xác nhận:** Trạng thái hóa đơn chuyển thành `PAID`, số nợ về 0 VND.
3. Tại bản ghi thanh toán, nhấn nút **In phiếu thu (PDF)**:
   - **Xác nhận:** Trình duyệt tải xuống file phiếu thu dạng PDF.
   - Nội dung hiển thị logo DreamHigh, thông tin chi nhánh, họ tên học viên, người nộp tiền, số tiền bằng số và bằng chữ tiếng Việt có dấu đầy đủ, chuẩn font Unicode, không bị lỗi hiển thị.

### 5.4. Kịch bản kiểm thử: Bảng Theo Dõi Công Nợ & Xuất Excel
1. Chuyển sang tab **Theo dõi công nợ (Arrears & Aging)** trong `/finance`.
2. **Xác nhận:**
   - Hiển thị danh sách các học viên còn nợ học phí phân loại theo thời hạn: Trong hạn (Current) và Quá hạn (Overdue).
   - Thống kê tổng số tiền phải thu toàn cơ sở.
3. Nhấn nút **Xuất báo cáo Excel**:
   - **Xác nhận:** File Excel định dạng chuẩn `.xlsx` được tải về máy với đầy đủ cột thông tin và số liệu khớp 100% với màn hình.

