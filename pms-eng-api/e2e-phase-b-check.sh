#!/usr/bin/env bash
# E2E business-flow check for Phase B scope (guard order fix + RBAC + existing modules)
# Runs against the locally running API on Windows host + local PostgreSQL 16.
#
# Credentials come from the environment (or pms-eng-api/.env) — never hardcode them here.
#   ADMIN_EMAIL / ADMIN_PASSWORD  — seeded admin account
#   PGUSER / PGPASSWORD / PGDATABASE / PGHOST — local PostgreSQL for SQL assertions
set -u

cd "$(dirname "$0")" || exit 1
if [ -f .env ]; then set -a; . ./.env; set +a; fi

API="${API:-http://127.0.0.1:3000/api}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-}"
PGPASSWORD="${PGPASSWORD:-}"
PGDATABASE="${PGDATABASE:-dreamhigh_pms}"

if [ -z "$ADMIN_PASSWORD" ] || [ -z "$ADMIN_EMAIL" ]; then
  echo "ADMIN_EMAIL và ADMIN_PASSWORD chưa được set — không thể chạy phần kiểm tra RBAC admin." >&2
  exit 2
fi

PASS=0; FAIL=0
declare -a RESULTS

check() { # name expected actual
  local name="$1" exp="$2" act="$3"
  if [ "$exp" = "$act" ]; then
    PASS=$((PASS+1)); RESULTS+=("PASS | $name | expected=$exp actual=$act")
  else
    FAIL=$((FAIL+1)); RESULTS+=("FAIL | $name | expected=$exp actual=$act")
  fi
}

code() { curl -sS -o /dev/null -w "%{http_code}" "$@"; }
psql_q() { PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc "$1"; }

STAMP=$(date +%s)
EMAIL="e2e.phaseb.${STAMP}@dreamhigh.vn"
PASSWD='DreamHigh123@'

echo "### A. Guard order / auth (X-TC-01, 1.1-TC-03/04)"
check "1.1-TC-03 no token -> 401"        401 "$(code $API/users)"
check "1.1-TC-03 bad token -> 401"       401 "$(code -H 'Authorization: Bearer bad.tok.en' $API/users)"
check "1.1-TC-04 no token /categories"   401 "$(code $API/categories/programs)"
check "X-TC-01 no token /students"       401 "$(code $API/students)"
check "X-TC-01 no token /enrollment"     401 "$(code -X POST -H 'Content-Type: application/json' -d '{}' $API/enrollment/placement-test)"
check "health public -> 200"             200 "$(code $API/health)"

echo "### B. Register + login"
REG=$(curl -sS -w "\n%{http_code}" -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"fullName\":\"E2E Phase B\",\"password\":\"$PASSWD\"}")
REGC=$(echo "$REG" | tail -1)
check "1.1-TC-01 register valid -> 201"   201 "$REGC"
REG_BODY=$(echo "$REG" | head -n -1)
echo "$REG_BODY" | grep -q "passwordHash" && HASHLEAK=1 || HASHLEAK=0
check "1.1-TC-01 no passwordHash leaked" 0 "$HASHLEAK"

DUP=$(code -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"fullName\":\"Dup\",\"password\":\"$PASSWD\"}")
check "1.1-TC-02 duplicate email -> 400" 400 "$DUP"

WEAK=$(code -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d "{\"email\":\"weak.${STAMP}@dreamhigh.vn\",\"fullName\":\"W\",\"password\":\"123\"}")
check "1.1-TC-02 weak password -> 400"    400 "$WEAK"

LOGIN=$(curl -sS -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\"}")
TOKEN=$(echo "$LOGIN" | sed -n 's/.*"accessToken"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] && TOKOK=1 || TOKOK=0
check "1.1-TC-03 login correct -> token"  1 "$TOKOK"
echo "$LOGIN" | grep -q "passwordHash" && HASHLEAK2=1 || HASHLEAK2=0
check "1.1-TC-01 login no passwordHash"  0 "$HASHLEAK2"

BADPWD=$(code -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPass123@\"}")
check "1.1-TC-04 login wrong pwd -> 401" 401 "$BADPWD"

echo "### C. Authenticated access + RBAC"
PROF=$(code -H "Authorization: Bearer $TOKEN" $API/users/profile)
check "1.1-TC-09 profile -> 200"          200 "$PROF"

LISTUSERS=$(code -H "Authorization: Bearer $TOKEN" $API/users)
check "1.1-TC-11 non-ADMIN /users -> 403" 403 "$LISTUSERS"

STATS=$(code -H "Authorization: Bearer $TOKEN" $API/students)
check "RBAC role-less user /students -> 403" 403 "$STATS"

CLASS404=$(code -H "Authorization: Bearer $TOKEN" $API/classes/NO_SUCH_CLASS)
check "4.1-TC-01 class missing -> 404"    404 "$CLASS404"

echo "### D. Phase B (2.3 Schedule/Session) endpoints"
# Role-less user (đăng ký mới) không có quyền quản lý lịch.
check "PhaseB GET /sessions/my-schedule -> 403 (thiếu role)" 403 \
  "$(code -H "Authorization: Bearer $TOKEN" $API/sessions/my-schedule?from=2026-03-01\&to=2026-03-31)"
check "PhaseB GET /reports/teaching-hours -> 403 (thiếu role)" 403 \
  "$(code -H "Authorization: Bearer $TOKEN" $API/reports/teaching-hours?from=2026-03-01\&to=2026-03-31)"
check "PhaseB GET /users/lookup/teachers -> 403 (thiếu role)" 403 \
  "$(code -H "Authorization: Bearer $TOKEN" $API/users/lookup/teachers)"
check "PhaseB GET /sessions/my-schedule -> 401 (không token)" 401 \
  "$(code $API/sessions/my-schedule?from=2026-03-01\&to=2026-03-31)"

echo "### E. Phase B schema support (prisma)"
export PATH="/c/Program Files/PostgreSQL/16/bin:$PATH"
TBL=$(psql_q "select count(*) from information_schema.tables where table_name='sessions';")
check "B1 sessions table exists"          1 "$TBL"
IDX=$(psql_q "select count(*) from pg_indexes where tablename='sessions' and indexdef like '%start_time%';")
echo "INFO sessions indexes containing start_time: $IDX"
CHTBL=$(psql_q "select count(*) from information_schema.tables where table_name='session_changes';")
check "B1 session_changes table exists"   1 "$CHTBL"
CHCOL=$(psql_q "select count(*) from information_schema.columns where table_name='sessions' and column_name='teacher_id';")
check "B1 sessions.teacher_id exists"     1 "$CHCOL"

echo "### F. Admin RBAC + credential leak (4.1-TC-04)"
ALOGIN=$(curl -sS -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ATOKEN=$(echo "$ALOGIN" | sed -n 's/.*"accessToken"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -n "$ATOKEN" ] && ATOK=1 || ATOK=0
check "admin login -> token"              1 "$ATOK"
check "admin /users -> 200"               200 "$(code -H "Authorization: Bearer $ATOKEN" $API/users)"
check "admin /students -> 200"            200 "$(code -H "Authorization: Bearer $ATOKEN" $API/students)"
check "admin /leads -> 200"               200 "$(code -H "Authorization: Bearer $ATOKEN" $API/leads)"
check "admin /audit-logs -> 200"          200 "$(code -H "Authorization: Bearer $ATOKEN" $API/audit-logs)"

CLS=$(psql_q "select class_code from classes limit 1;")
CRESP=$(curl -sS -H "Authorization: Bearer $ATOKEN" "$API/classes/$CLS")
echo "$CRESP" | grep -q "passwordHash" && LEAK1=1 || LEAK1=0
echo "$CRESP" | grep -q "googleSub"    && LEAK2=1 || LEAK2=0
check "4.1-TC-04 no passwordHash in class detail" 0 "$LEAK1"
check "4.1-TC-04 no googleSub in class detail"    0 "$LEAK2"

echo "### G. Phase B flow: preview -> generate -> reschedule -> swap (3.1/3.2)"
# Chọn course/branch/room/GV hợp lệ từ DB để tạo lớp thật.
# 2099-06-05 là Thứ 6 (ISO weekday 5) → dùng weekdays:[5].
G_COURSE=$(psql_q "select id from courses where status='ACTIVE' order by id limit 1;")
G_BRANCH=$(psql_q "select id from branches where status='ACTIVE' order by id limit 1;")
G_ROOM=$(psql_q "select id from rooms where branch_id=$G_BRANCH and status='AVAILABLE' and capacity >= 10 order by id limit 1;")
G_TEACHER=$(psql_q "select id from system_users where status='ACTIVE' and id in (select user_id from user_roles ur join roles r on r.id=ur.role_id where r.code='TEACHER') order by id limit 1;")
G_CLASSCODE="E2E-PB-${STAMP}"

if [ -z "$G_COURSE" ] || [ -z "$G_BRANCH" ] || [ -z "$G_ROOM" ] || [ -z "$G_TEACHER" ]; then
  echo "SKIP Phase B flow: thiếu course/branch/room(capacity>=10)/teacher trong DB"
else
  # Ngày lịch: 2099 để buổi chưa diễn ra (service chặn sửa buổi đã hoàn tất).
  G_BODY="{\"classCode\":\"$G_CLASSCODE\",\"courseId\":$G_COURSE,\"branchId\":$G_BRANCH,\"teacherId\":$G_TEACHER,\"roomId\":$G_ROOM,\"maxStudents\":10,\"weekdays\":[5],\"startDate\":\"2099-06-05\",\"endDate\":\"2099-06-12\",\"startTime\":\"18:00\",\"endTime\":\"19:30\"}"

  # 3.1-TC-01: tạo lớp + sinh session trong một transaction.
  GEN=$(curl -sS -w "\n%{http_code}" -X POST $API/classes/with-sessions \
    -H "Authorization: Bearer $ATOKEN" -H 'Content-Type: application/json' -d "$G_BODY")
  check "3.1-TC-01 create class + sessions -> 201" 201 "$(echo "$GEN" | tail -1)"
  G_SESSION_ID=$(psql_q "select id from sessions s join classes c on c.id=s.class_id where c.class_code='$G_CLASSCODE' order by s.start_time limit 1;")
  G_SESSION_COUNT=$(psql_q "select count(*) from sessions s join classes c on c.id=s.class_id where c.class_code='$G_CLASSCODE';")
  check "3.1-TC-01 sessions created (2 buổi)" 2 "$G_SESSION_COUNT"

  # 3.1-TC-04: hai buổi nối tiếp đúng tại biên KHÔNG phải conflict.
  G_CLASH=$(curl -sS -w "\n%{http_code}" -X POST $API/classes/with-sessions \
    -H "Authorization: Bearer $ATOKEN" -H 'Content-Type: application/json' \
    -d "{\"classCode\":\"${G_CLASSCODE}-X\",\"courseId\":$G_COURSE,\"branchId\":$G_BRANCH,\"teacherId\":$G_TEACHER,\"roomId\":$G_ROOM,\"maxStudents\":10,\"weekdays\":[5],\"startDate\":\"2099-06-05\",\"endDate\":\"2099-06-05\",\"startTime\":\"19:30\",\"endTime\":\"21:00\"}")
  check "3.1-TC-04 adjacent session (end==start) -> 201" 201 "$(echo "$G_CLASH" | tail -1)"

  # 3.1-TC-02/03: trùng phòng hoặc trùng GV -> 422.
  G_CONFLICT=$(curl -sS -w "\n%{http_code}" -X POST $API/classes/with-sessions \
    -H "Authorization: Bearer $ATOKEN" -H 'Content-Type: application/json' \
    -d "{\"classCode\":\"${G_CLASSCODE}-C\",\"courseId\":$G_COURSE,\"branchId\":$G_BRANCH,\"teacherId\":$G_TEACHER,\"roomId\":$G_ROOM,\"maxStudents\":10,\"weekdays\":[5],\"startDate\":\"2099-06-05\",\"endDate\":\"2099-06-05\",\"startTime\":\"18:30\",\"endTime\":\"20:00\"}")
  check "3.1-TC-02/03 overlapping session -> 422" 422 "$(echo "$G_CONFLICT" | tail -1)"
  echo "$G_CONFLICT" | head -n -1 | grep -q "SCHEDULE_CONFLICT" && CONFLICT_MARK=1 || CONFLICT_MARK=0
  check "3.1-TC-02/03 conflict error code SCHEDULE_CONFLICT" 1 "$CONFLICT_MARK"
  G_ROLLED=$(psql_q "select count(*) from classes where class_code='${G_CLASSCODE}-C';")
  check "3.1-TC-02/03 conflict -> không tạo lớp (rollback)" 0 "$G_ROLLED"

  # 3.2-TC-01: dời một buổi.
  G_RESCH=$(curl -sS -w "\n%{http_code}" -X PATCH $API/sessions/$G_SESSION_ID/reschedule \
    -H "Authorization: Bearer $ATOKEN" -H 'Content-Type: application/json' \
    -d '{"date":"2099-06-07","startTime":"19:00","reason":"E2E dời lịch"}')
  check "3.2-TC-01 reschedule session -> 200" 200 "$(echo "$G_RESCH" | tail -1)"

  # 3.2-TC-02: đổi GV của riêng một buổi (không đổi GV của lớp).
  # Chọn GV đang rảnh trong khung giờ 2099-06-07 19:00-20:30 để không trúng conflict ngoài ý muốn.
  G_TEACHER2=$(psql_q "select u.id from system_users u
    join user_roles ur on ur.user_id = u.id
    join roles r on r.id = ur.role_id
    where r.code = 'TEACHER' and u.status = 'ACTIVE' and u.id <> $G_TEACHER
      and not exists (
        select 1 from sessions s
        where s.status <> 'CANCELLED'
          and (s.teacher_id = u.id or (s.teacher_id is null and s.class_id in (select id from classes where teacher_id = u.id)))
          and s.start_time < '2099-06-07 20:30' and s.end_time > '2099-06-07 19:00')
    order by u.id limit 1;")
  if [ -n "$G_TEACHER2" ]; then
    G_SWAP=$(curl -sS -w "\n%{http_code}" -X PATCH $API/sessions/$G_SESSION_ID/teacher \
      -H "Authorization: Bearer $ATOKEN" -H 'Content-Type: application/json' \
      -d "{\"teacherId\":$G_TEACHER2,\"reason\":\"E2E đổi GV\"}")
    check "3.2-TC-02 change session teacher -> 200" 200 "$(echo "$G_SWAP" | tail -1)"
    G_CLASS_TEACHER=$(psql_q "select teacher_id from classes where class_code='$G_CLASSCODE';")
    check "3.2-TC-02 đổi GV không sửa GV của lớp" "$G_TEACHER" "$G_CLASS_TEACHER"
  else
    echo "SKIP 3.2-TC-02: chưa có giáo viên thứ hai rảnh lịch trong DB"
  fi

  # 3.2-TC-04: có audit/change log.
  G_HIST=$(curl -sS -w "\n%{http_code}" -H "Authorization: Bearer $ATOKEN" $API/sessions/$G_SESSION_ID/history)
  check "3.2-TC-04 session history -> 200" 200 "$(echo "$G_HIST" | tail -1)"
  echo "$G_HIST" | head -n -1 | grep -q "RESCHEDULE" && HIST_MARK=1 || HIST_MARK=0
  check "3.2-TC-04 history has RESCHEDULE entry" 1 "$HIST_MARK"

  # Hủy buổi phải có lý do; buổi hủy không tính vào giờ dạy.
  G_CANCEL_NOREASON=$(code -X PATCH $API/sessions/$G_SESSION_ID/cancel \
    -H "Authorization: Bearer $ATOKEN" -H 'Content-Type: application/json' -d '{}')
  check "cancel without reason -> 400" 400 "$G_CANCEL_NOREASON"
  G_CANCEL=$(code -X PATCH $API/sessions/$G_SESSION_ID/cancel \
    -H "Authorization: Bearer $ATOKEN" -H 'Content-Type: application/json' -d '{"reason":"E2E hủy buổi"}')
  check "cancel session with reason -> 200" 200 "$G_CANCEL"

  # 3.4-TC-01/02/03: giờ dạy chỉ tính buổi đã diễn ra, không tính buổi hủy/tương lai.
  G_TEACHING=$(curl -sS -w "\n%{http_code}" -H "Authorization: Bearer $ATOKEN" \
    "$API/reports/teaching-hours?from=2020-01-01&to=2030-01-01")
  check "3.4-TC-01 teaching-hours -> 200" 200 "$(echo "$G_TEACHING" | tail -1)"
  echo "$G_TEACHING" | head -n -1 | grep -q '"totalHours"' && TH_MARK=1 || TH_MARK=0
  check "3.4-TC-01 teaching-hours has totalHours" 1 "$TH_MARK"
  G_CANCELLED_HOURS=$(psql_q "select count(*) from sessions where status='CANCELLED' and id=$G_SESSION_ID;")
  check "3.4-TC-02 cancelled session recorded" 1 "$G_CANCELLED_HOURS"

  # 3.3-TC-01/02: lịch cá nhân lấy từ JWT, không nhận teacherId tự do.
  # So sánh 2 lần gọi với teacherId khác nhau → phải trả về giống hệt nhau.
  G_MY_A=$(curl -sS -H "Authorization: Bearer $ATOKEN" "$API/sessions/my-schedule?from=2099-06-01&to=2099-07-01&teacherId=999999")
  G_MY_B=$(curl -sS -H "Authorization: Bearer $ATOKEN" "$API/sessions/my-schedule?from=2099-06-01&to=2099-07-01&teacherId=$G_TEACHER")
  check "3.3-TC-02 my-schedule bỏ qua teacherId từ query" "$G_MY_A" "$G_MY_B"
  G_MY_CODE=$(code -H "Authorization: Bearer $ATOKEN" "$API/sessions/my-schedule?from=2099-06-01&to=2099-07-01")
  check "3.3-TC-01 my-schedule -> 200" 200 "$G_MY_CODE"

  # 4.1-TC-01/02: chi tiết lớp.
  G_DETAIL=$(code -H "Authorization: Bearer $ATOKEN" $API/classes/$G_CLASSCODE)
  check "4.1-TC-01 class detail -> 200" 200 "$G_DETAIL"
  check "4.1-TC-02 missing class -> 404" 404 "$(code -H "Authorization: Bearer $ATOKEN" $API/classes/NO_SUCH_CLASS_XYZ)"
fi

echo
echo "===== RESULTS ====="
for r in "${RESULTS[@]}"; do echo "$r"; done
echo "---------------------"
echo "PASS: $PASS   FAIL: $FAIL"
echo "TEST_EMAIL=$EMAIL"
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
