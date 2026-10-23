# Triển khai DreamHigh PMS trên máy Linux hiện tại

Ứng dụng được cấu hình chạy bằng Docker Compose tại **http://localhost:8080/login**. Frontend là bản build React phục vụ qua Nginx, API NestJS chạy production và PostgreSQL 16 lưu trong volume riêng. Chỉ cổng web được mở trên loopback `127.0.0.1`; API và database không công bố cổng ra máy chủ.

## Cấu hình và tài khoản

File `.env.local-deploy` ở thư mục gốc repository lưu `POSTGRES_PASSWORD`, `JWT_SECRET`, `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD`. File này bị Git bỏ qua và cần quyền `0600`. Mở file trực tiếp trên máy để lấy thông tin đăng nhập; không đưa nội dung vào log, commit hoặc ticket.

`POSTGRES_PASSWORD` phải dài ít nhất 32 ký tự và chỉ gồm `A-Z`, `a-z`, `0-9`, `_`, `-`, vì giá trị này được chèn trực tiếp vào URL kết nối database. Khi chuẩn bị cấu hình mới, có thể tạo chuỗi phù hợp bằng `openssl rand -hex 32` và lưu vào file bảo mật; không thay hoặc in lại bí mật của bản triển khai hiện tại. Service `init` kiểm tra điều kiện này trước khi chạy migration và dừng nếu không hợp lệ.

Email mặc định của quản trị viên local là `admin@dreamhigh.local`. Mật khẩu được tạo ngẫu nhiên riêng cho lần triển khai, không dùng mật khẩu từ script seed cũ. Nếu đã đổi email, username hoặc mật khẩu trong ứng dụng, dữ liệu mới trong database có hiệu lực. Bootstrap nhận diện tài khoản hiện có qua email cấu hình, username `admin` hoặc cờ super admin; chạy lại không tạo thêm quản trị viên, không đặt lại mật khẩu hoặc cấp lại quyền cho tài khoản đã có.

Giữ nguyên file cấu hình khi triển khai lại. Thay `POSTGRES_PASSWORD` trong file không tự thay mật khẩu trong database đã tồn tại. Sao lưu file này qua kênh bảo mật cùng thông tin phục hồi.

## Khởi động và quản lý

Chạy các lệnh dưới đây từ thư mục gốc repository, trên máy có Docker Engine và Docker Compose. Trước lần chạy đầu cần chuẩn bị `.env.local-deploy` với các bí mật ngẫu nhiên; không dùng giá trị mẫu hay file env của môi trường khác.

```bash
docker compose --env-file .env.local-deploy -f compose.local.yml config --quiet
docker compose --env-file .env.local-deploy -f compose.local.yml build
docker compose --env-file .env.local-deploy -f compose.local.yml up -d --wait
```

Service `init` chạy 9 migration hiện có rồi tạo các role ADMIN/MANAGER/STAFF/TEACHER, chi nhánh `DREAMHIGH_LOCAL` và tài khoản quản trị nếu chưa có. Service này kết thúc với mã 0 sau khi hoàn tất; API và web chỉ khởi động sau khi các dependency sẵn sàng. Không chạy `prisma/seed.ts` hoặc `test:uat` vào database đang triển khai.

Kiểm tra trạng thái và log:

```bash
docker compose --env-file .env.local-deploy -f compose.local.yml ps -a
docker compose --env-file .env.local-deploy -f compose.local.yml logs --tail=100 init api web
curl --fail http://localhost:8080/api/health
curl --fail http://localhost:8080/api/health/ready
```

Readiness thành công trả `{"status":"ready","dependencies":{"database":"ok"}}`. Nếu migration hoặc bootstrap lỗi, kiểm tra log `init`; không bỏ qua bước init để ép ứng dụng chạy.

Khởi động lại các dịch vụ đang chạy:

```bash
docker compose --env-file .env.local-deploy -f compose.local.yml restart db api web
```

Dừng ứng dụng nhưng giữ volume dữ liệu:

```bash
docker compose --env-file .env.local-deploy -f compose.local.yml down
```

Không thêm `-v` vào lệnh `down`, không xóa volume `dreamhigh-pms-local_postgres-data`. Database, API và web dùng chính sách `unless-stopped`; chúng khởi động lại khi Docker khởi động, trừ khi trước đó đã bị dừng thủ công. Docker Engine phải được cấu hình khởi động cùng máy chủ để cơ chế này hoạt động sau reboot.

## Cập nhật mã nguồn

Chốt và kiểm tra mã nguồn trước khi build lại. Sao lưu database trước khi áp dụng migration mới; lệnh triển khai có thể áp dụng thay đổi schema trên volume hiện tại.

```bash
docker compose --env-file .env.local-deploy -f compose.local.yml build
docker compose --env-file .env.local-deploy -f compose.local.yml up -d --wait
```

Sau cập nhật, xác minh readiness, đăng nhập, role/branch và các màn hình nghiệp vụ cần dùng. Các hạn chế nghiệp vụ trong tài liệu bàn giao vẫn cần xử lý riêng; việc ứng dụng chạy được không thay thế nghiệm thu chức năng.

## Sao lưu và phục hồi

Tạo thư mục lưu riêng có quyền hạn chế, rồi sao lưu database qua service `db`:

```bash
install -d -m 700 backups.local
umask 077
docker compose --env-file .env.local-deploy -f compose.local.yml exec -T db pg_dump -U dreamhigh -d dreamhigh_pms -Fc > "backups.local/dreamhigh-$(date +%Y%m%d-%H%M%S).dump"
```

Thư mục `backups.local` được quy tắc `*.local` trong `.gitignore` bỏ qua. Bản dump có dữ liệu ứng dụng; chuyển bản sao sang nơi lưu bảo mật ngoài máy triển khai và chỉ cho người có quyền truy cập. Cần phục hồi thử vào database tách biệt trước khi coi backup là sử dụng được. Không tự restore đè volume hiện tại; xác nhận database đích, thời điểm backup và giao dịch cần giữ trước khi phục hồi.

## Giới hạn triển khai

- Cấu hình này chỉ cho truy cập từ máy Linux hiện tại; chưa mở LAN, Internet, domain hoặc TLS.
- API giữ nguyên quy tắc CORS production chỉ cho HTTPS. `CORS_ORIGINS=https://localhost` không mở CORS cho nguồn HTTP; trình duyệt dùng cùng origin HTTP thông qua Nginx và `/api`, nên không cần truy cập chéo origin.
- Google Sign-In chưa được cấu hình. Dùng email/mật khẩu local để đăng nhập.
- Đây là database mới của bản local, không chứa dữ liệu nghiệp vụ từ hệ thống khác.
- Image API giữ Prisma CLI và các công cụ build để chạy migration, phục vụ kiểm tra trên máy local. Việc tối giản image cho hosting công cộng cần quy trình phát hành riêng.

## Kết quả triển khai ngày 23 tháng 10 năm 2026

| Kiểm tra | Kết quả thực tế |
|---|---|
| Build API | `npm run build` đạt; có `dist/src/main.js` và logo dùng cho phiếu thu PDF |
| Build frontend | TypeScript và Vite production build đạt, API base `/api` |
| Unit test backend | 17 suites, 166 tests đạt trong container, mã nguồn mount chỉ đọc |
| Test bootstrap local | 6 tests đạt: tạo admin, giữ tài khoản cũ, giữ admin khi đổi email hoặc đổi cả email/username, từ chối mật khẩu thiếu/yếu và email sai |
| Database | 9 migrations áp dụng thành công trên volume local mới |
| Dịch vụ | `db`, `api`, `web` healthy; `init` kết thúc mã 0 |
| Truy cập từ host | `/login` HTTP 200; `/api/health/ready` xác nhận database `ok` |
| HTTP qua Nginx | HTML/JS tải được; reload `/finance` có SPA fallback; asset không tồn tại trả 404 |
| Xác thực | Admin đăng nhập thành công; 5 endpoint đọc được bảo vệ trả 200; users/arrears chưa đăng nhập trả 401 |
| Khởi tạo lại | Không tạo lại admin, không đổi ID hoặc password hash đã có |
| Cấu hình database sai | Mật khẩu thử không đúng định dạng bị chặn trước migration, không đổi mật khẩu DB đang chạy |
| Restart dịch vụ | Đã restart riêng DB/API/web; readiness, đăng nhập và các kiểm tra HTTP tiếp tục đạt |
| Khởi động cùng Linux | `systemctl is-enabled docker` trả `enabled`; các service lâu dài có `restart: unless-stopped` |
| Bảo vệ cấu hình | `.env.local-deploy` bị Git bỏ qua, quyền `0600`; không ghi mật khẩu/token vào báo cáo |

Đây là kết quả kiểm tra bản local với database mới. Chưa thực hiện import dữ liệu cũ, kiểm thử giao diện trực quan, toàn bộ UAT hoặc triển khai public HTTPS trong lần này.
