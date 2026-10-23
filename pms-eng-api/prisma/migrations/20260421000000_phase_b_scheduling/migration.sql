-- Phase B — Scheduling & Sessions (Epic 3: FR8–FR11)
--
-- Nội dung Phase B:
--   1. Enum SessionChangeType (lịch sử thay đổi buổi học).
--   2. Bảng session_changes — lưu lịch sử reschedule / đổi GV / đổi phòng / hủy.
--   3. sessions.teacher_id — giáo viên thực dạy riêng cho từng buổi (nullable).
--      NULL = mượn giáo viên của lớp (TrainingClass.teacherId).
--   4. Index tổng hợp (room_id, start_time), (class_id, start_time), (teacher_id, start_time).
--
-- Lưu ý về reconcile (drift có sẵn từ trước Phase B):
--   Lịch sử migration trong repo không khớp với schema.prisma — bảng `audit_logs`
--   và cột `levels.status` tồn tại trong DB dev nhưng không được tạo bởi migration nào;
--   các cột timestamp trong init migration là TIMESTAMPTZ trong khi schema khai báo
--   DateTime (timestamp(3) without time zone). Các câu lệnh dưới đây dùng IF NOT EXISTS /
--   kiểm tra data_type để hòa giải drift đó, nhờ vậy migration chạy được cả trên DB dev
--   (đã có sẵn các đối tượng này) lẫn trên DB test dựng lại từ đầu chuỗi migration.

-- ---------------------------------------------------------------------------
-- 1. Enum SessionChangeType
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE "SessionChangeType" AS ENUM ('RESCHEDULE', 'SHIFT', 'CHANGE_TEACHER', 'CHANGE_ROOM', 'CANCEL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Bảng session_changes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "session_changes" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "changed_by" INTEGER,
    "change_type" "SessionChangeType" NOT NULL,
    "reason" VARCHAR(2000),
    "from_start_time" TIMESTAMP(3),
    "to_start_time" TIMESTAMP(3),
    "from_end_time" TIMESTAMP(3),
    "to_end_time" TIMESTAMP(3),
    "from_teacher_id" INTEGER,
    "to_teacher_id" INTEGER,
    "from_room_id" INTEGER,
    "to_room_id" INTEGER,
    "from_status" "SessionStatus",
    "to_status" "SessionStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "session_changes_session_id_created_at_idx" ON "session_changes"("session_id", "created_at");
CREATE INDEX IF NOT EXISTS "session_changes_changed_by_idx" ON "session_changes"("changed_by");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_changes_session_id_fkey'
  ) THEN
    ALTER TABLE "session_changes" ADD CONSTRAINT "session_changes_session_id_fkey"
      FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_changes_changed_by_fkey'
  ) THEN
    ALTER TABLE "session_changes" ADD CONSTRAINT "session_changes_changed_by_fkey"
      FOREIGN KEY ("changed_by") REFERENCES "system_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. sessions.teacher_id — giáo viên thực dạy riêng cho buổi học
-- ---------------------------------------------------------------------------
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "teacher_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_teacher_id_fkey'
  ) THEN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_teacher_id_fkey"
      FOREIGN KEY ("teacher_id") REFERENCES "system_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Index tổng hợp cho truy vấn lịch / conflict
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "sessions_room_id_start_time_idx" ON "sessions"("room_id", "start_time");
CREATE INDEX IF NOT EXISTS "sessions_class_id_start_time_idx" ON "sessions"("class_id", "start_time");
CREATE INDEX IF NOT EXISTS "sessions_teacher_id_start_time_idx" ON "sessions"("teacher_id", "start_time");

-- ---------------------------------------------------------------------------
-- 5. Reconcile drift có sẵn (audit_logs, levels.status, kiểu timestamp)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "record_id" VARCHAR(100),
    "details" JSONB,
    "ip_address" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs"("resource");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_user_id_fkey'
  ) THEN
    ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "system_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'levels' AND column_name = 'status'
  ) THEN
    ALTER TABLE "levels" ADD COLUMN "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE';
  END IF;
END $$;

-- Đồng bộ kiểu timestamp với schema.prisma (DateTime -> timestamp(3) without time zone).
-- Chỉ chuyển khi cột đang là TIMESTAMPTZ; giá trị cũ được hiểu là UTC.
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'timestamp with time zone'
          AND (table_name, column_name) IN (
            ('branches', 'created_at'), ('class_students', 'enrolled_at'),
            ('exams', 'scheduled_at'), ('leads', 'created_at'),
            ('payments', 'paid_at'), ('sessions', 'start_time'), ('sessions', 'end_time'),
            ('students', 'created_at'), ('system_users', 'created_at'),
            ('system_users', 'updated_at'), ('invoices', 'issue_date'), ('invoices', 'due_date')
          )
    LOOP
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMP(3) USING %I AT TIME ZONE ''UTC''',
            t.table_name, t.column_name, t.column_name
        );
    END LOOP;
END $$;
