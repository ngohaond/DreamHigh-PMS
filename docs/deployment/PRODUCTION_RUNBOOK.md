# DreamHigh PMS — Sổ Tay Vận Hành Triển Khai Production (Production Runbook)

**Phiên bản:** 1.0 (Phase F — Production Go-Live)  
**Tác giả:** Đội ngũ Kỹ thuật & Vận hành DreamHigh PMS  
**Mục tiêu:** Cung cấp tài liệu quy chuẩn cho việc triển khai, cấu hình, giám sát và xử lý sự cố hệ thống DreamHigh PMS trên môi trường Production.

---

## 1. Cấu Trúc Kiến Trúc & Yêu Cầu Hạ Tầng

```
                      [ Người dùng / Trình duyệt ]
                                   │
                                   ▼ HTTPS (Port 443)
                    ┌──────────────────────────────┐
                    │ Nginx / Cloudflare Ingress   │
                    └──────────────┬───────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │ Reverse Proxy                           │ Static Assets (HTML/JS/CSS)
              ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │ pms-eng-api (Node.js) │                 │ dreamhigh-web (SPA)   │
   │ NestJS on Port 3000   │                 │ Nginx Static Hosting  │
   └──────────┬────────────┘                 └───────────────────────┘
              │ Prisma ORM (Connection Pool)
              ▼
   ┌───────────────────────┐
   │ PostgreSQL 16 DB      │
   │ Dedicated Instance    │
   └───────────────────────┘
```

### Yêu Cầu Tối Thiểu
- **Database:** PostgreSQL 16+, 2 vCPU, 4GB RAM, SSD 50GB (có tự động snapshot hằng ngày).
- **Backend API:** Node.js v20.x LTS, 2 vCPU, 4GB RAM.
- **Frontend:** Nginx 1.24+ hoặc CDN (Cloudflare Pages / Vercel / AWS S3 + CloudFront).

---

## 2. Cấu Hình Biến Môi Trường (Environment Variables)

### 2.1. Backend API (`pms-eng-api/.env`)
> [!CRITICAL]
> **Tuyệt đối không sử dụng giá trị mặc định (Zero-fallback policy)** đối với `JWT_SECRET` và thông tin kết nối DB trên Production.

| Tên biến | Bắt buộc | Mô tả | Giá trị mẫu |
|---|---|---|---|
| `NODE_ENV` | Có | Môi trường thực thi | `production` |
| `PORT` | Có | Port lắng nghe nội bộ | `3000` |
| `DATABASE_URL` | Có | URL kết nối PostgreSQL qua pool | `postgresql://dh_user:SECURE_PASS@db-prod.internal:5432/dreamhigh_pms?sslmode=require&connection_limit=20` |
| `DIRECT_URL` | Có | URL kết nối trực tiếp chạy migration | `postgresql://dh_user:SECURE_PASS@db-prod.internal:5432/dreamhigh_pms?sslmode=require` |
| `JWT_SECRET` | Có | Chuỗi bí mật ký Token (>=64 ký tự ngẫu nhiên) | `e7c8b1a45f9d2e3c8b7a6d5c4b3a2f1e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a` |
| `JWT_EXPIRES_IN` | Có | Thời hạn token | `1d` |
| `CORS_ORIGINS` | Có | Danh sách tên miền frontend được phép gọi API | `https://pms.dreamhigh.edu.vn` |
| `THROTTLE_TTL` | Không | Thời gian tính rate limit (giây) | `60` |
| `THROTTLE_LIMIT` | Không | Số request tối đa mỗi IP/phút | `100` |

### 2.2. Frontend Web (`dreamhigh-web/.env.production`)
| Tên biến | Bắt buộc | Mô tả | Giá trị mẫu |
|---|---|---|---|
| `VITE_API_URL` | Có | URL gốc của Backend API | `https://pms.dreamhigh.edu.vn/api` |
| `VITE_GOOGLE_CLIENT_ID` | Không | Client ID Google Sign-In nếu bật | `123456789-xyz.apps.googleusercontent.com` |

---

## 3. Quy Trình Triển Khai Chi Tiết (Deployment Steps)

### Bước 1: Sao lưu dữ liệu hiện trạng
```bash
pg_dump -h $DB_HOST -U $DB_USER -d dreamhigh_pms -F c -b -v -f /var/backups/db_pre_deploy_$(date +%Y%m%d_%H%M%S).dump
```

### Bước 2: Kéo mã nguồn & Cài đặt dependencies
```bash
git checkout master
git pull origin master

# Backend
cd pms-eng-api
npm ci --omit=dev
npx prisma generate

# Frontend
cd ../dreamhigh-web
npm ci
npm run build
```

### Bước 3: Áp dụng Database Migration
```bash
cd /path/to/pms-eng-api
npm run prisma:migrate:deploy
```
*Lệnh trên sẽ chạy toàn bộ các migration chưa được áp dụng mà không làm mất mát dữ liệu sản xuất.*

### Bước 4: Khởi động lại ứng dụng Backend
Sử dụng công cụ quản lý tiến trình (PM2 hoặc Docker/Systemd):
```bash
pm2 reload dreamhigh-api --update-env
# Hoặc systemctl restart dreamhigh-api
```

### Bước 5: Kiểm tra trạng thái hệ thống (Readiness & Smoke Test)
```bash
# 1. Kiểm tra Liveness probe
curl -f http://127.0.0.1:3000/api/health
# Kết quả mong đợi: {"status":"ok"}

# 2. Kiểm tra Readiness probe (kết nối database)
curl -f http://127.0.0.1:3000/api/health/ready
# Kết quả mong đợi: {"status":"ready","dependencies":{"database":"ok"}}

# 3. Chạy script smoke test tự động
npm run test:uat
```

---

## 4. Kế Hoạch Sao Lưu & Khôi Phục (Backup & Disaster Recovery)

### 4.1. Lịch trình sao lưu tự động (Cron job)
Cấu hình cron trên database server chạy lúc 02:00 sáng hằng ngày:
```bash
# /etc/cron.d/db-backup
0 2 * * * postgres /usr/local/bin/backup_db.sh > /var/log/db_backup.log 2>&1
```

Script `/usr/local/bin/backup_db.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/dreamhigh"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -h 127.0.0.1 -U dh_user -d dreamhigh_pms -F c -b -v -f $BACKUP_DIR/pms_$DATE.dump
# Xóa bản sao lưu cũ hơn 30 ngày
find $BACKUP_DIR -type f -name "*.dump" -mtime +30 -exec rm {} \;
```

### 4.2. Khôi phục dữ liệu khẩn cấp
```bash
# Dừng API
pm2 stop dreamhigh-api

# Khôi phục từ bản backup
pg_restore -h 127.0.0.1 -U dh_user -d dreamhigh_pms --clean --if-exists /var/backups/dreamhigh/pms_TARGET_DATE.dump

# Khởi động lại API
pm2 start dreamhigh-api
```

---

## 5. Quy Trình Ứng Phó Sự Cố (Incident Response Procedure)

| Mức độ sự cố | Tiêu chí | Thời gian phản hồi tối đa (SLA) | Hành động kích hoạt |
|---|---|---|---|
| **P0 (Thảm họa)** | Hệ thống sập hoàn toàn, Database hỏng, không thể thu tiền hoặc học sinh không thể điểm danh | **15 phút** | Thông báo khẩn cấp Ban Giám Đốc, dừng traffic, khôi phục từ snapshot, kích hoạt rollback nếu cần |
| **P1 (Nghiêm trọng)**| Lỗi chức năng cốt lõi (xuất hóa đơn, xếp lịch) nhưng hệ thống vẫn truy cập được | **1 giờ** | Phân tích log (`/var/log/dreamhigh/`), khoanh vùng commit lỗi, hotfix và deploy lại |
| **P2 (Trung bình)** | Lỗi giao diện, chậm tải trang, tính năng phụ trợ gặp lỗi | **4 giờ** | Ghi nhận ticket, xử lý theo luồng sprint bình thường |

### Thông tin liên hệ đội ứng cứu khẩn cấp (War Room)
- **Technical Lead:** `devops@dreamhigh.edu.vn` (SĐT: 0987.xxx.xxx)
- **Database Administrator:** `dba@dreamhigh.edu.vn`
- **Product Owner:** `po@dreamhigh.edu.vn`

---

## 6. Kế Hoạch Chăm Sóc Sau Triển Khai (Hypercare Plan — 14 Ngày)

Trong 14 ngày đầu tiên sau Go-Live:
1. **Trực hỗ trợ kỹ thuật:** Kỹ thuật viên túc trực từ 07:30 đến 21:30 hằng ngày trong giờ mở cửa của trung tâm.
2. **Đối soát hàng ngày:** 21:00 mỗi tối, bộ phận Kế toán và Học vụ so khớp dữ liệu thu học phí trên PMS với sao kê tài khoản ngân hàng.
3. **Theo dõi hiệu năng:** Kiểm tra tài nguyên CPU, RAM, Connection Pool của Database và độ trễ phản hồi trung bình (SLA < 300ms đối với thao tác thông thường).

