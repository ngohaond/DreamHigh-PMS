/**
 * Kiểu dữ liệu phía API cho luồng LỚP HỌC & XẾP LỊCH (Phase B).
 *
 * Lưu ý: các kiểu trong `classSchedule.ts` là dạng MOCK (id chuỗi, field khác tên).
 * Ở đây mô tả đúng shape backend trả về — id là số, thời gian lưu UTC kèm
 * trường giờ địa phương (Asia/Ho_Chi_Minh) để FE hiển thị đúng.
 */

/** Trạng thái lớp học (TrainingClassStatus). */
export type ApiClassStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

/** Trạng thái buổi học (SessionStatus). */
export type ApiSessionStatus = 'NORMAL' | 'RESCHEDULED' | 'CANCELLED';

/** Trạng thái phòng học (RoomStatus). */
export type ApiRoomStatus = 'AVAILABLE' | 'MAINTENANCE' | 'INACTIVE';

/** Loại tài nguyên bị xung đột lịch. */
export type ConflictResourceType = 'TEACHER' | 'ROOM';

export interface ApiUserRef {
  id: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  roles?: string[];
  branchIds?: number[];
  status?: string;
}

export interface ApiBranch {
  id: number;
  code: string;
  name: string;
  status: string;
  address?: string | null;
  phone?: string | null;
}

export interface ApiRoom {
  id: number;
  branchId: number;
  roomCode: string;
  name: string | null;
  capacity: number;
  status: ApiRoomStatus;
  branch?: ApiBranch | null;
}

export interface ApiCourse {
  id: number;
  code: string;
  name: string;
  totalSessions: number;
  durationWeeks: number | null;
  status: string;
  level?: { id: number; code: string; name: string } | null;
}

export interface ApiClass {
  id: number;
  classCode: string;
  courseId: number;
  branchId: number;
  teacherId: number;
  maxStudents: number;
  /** Ngày bắt đầu (ISO date hoặc date-only từ DB). */
  startDate: string;
  endDate: string | null;
  status: ApiClassStatus;
  course?: { id: number; name: string; code?: string; totalSessions?: number; durationWeeks?: number | null } | null;
  teacher?: ApiUserRef | null;
  branch?: ApiBranch | null;
}

/** Buổi học trả về từ `GET /classes/:classCode` (shape DB thô, chưa chuẩn hoá). */
export interface ApiClassDetail extends ApiClass {
  sessions: ApiSessionDetail[] | null;
  exams: unknown[] | null;
  enrollments: unknown[] | null;
}

/** Shape session thô trong class detail. */
export interface ApiSessionDetail {
  id: number;
  classId: number;
  roomId: number;
  teacherId: number | null;
  startTime: string;
  endTime: string;
  status: ApiSessionStatus;
  topicNote: string | null;
  room?: ApiRoom | null;
}

/** Shape session chuẩn hoá của backend (`serializeSession`). */
export interface SessionView {
  id: number;
  classId: number;
  classCode: string | null;
  className: string | null;
  roomId: number;
  roomName: string | null;
  teacherId: number | null;
  teacherName: string | null;
  /** ISO UTC. */
  startTime: string;
  /** ISO UTC. */
  endTime: string;
  /** YYYY-MM-DD theo giờ địa phương vận hành. */
  localDate: string;
  /** HH:mm theo giờ địa phương vận hành. */
  localStartTime: string;
  /** HH:mm theo giờ địa phương vận hành. */
  localEndTime: string;
  status: ApiSessionStatus;
  topicNote: string | null;
}

/** Chi tiết xung đột trả về trong `data` của lỗi 422 SCHEDULE_CONFLICT. */
export interface ScheduleConflictDetail {
  resourceType: ConflictResourceType;
  resourceName: string;
  classCode: string;
  conflictStartTime: string;
  conflictEndTime: string;
  requestedStartTime: string;
  requestedEndTime: string;
  conflictSessionId?: number;
}

/** Response của `POST /classes/:id/sessions/preview`. */
export interface SessionPreview {
  sessions: Array<{
    startTime: string;
    endTime: string;
    localDate: string;
    localStartTime: string;
    localEndTime: string;
    weekday: number;
  }>;
  total: number;
  conflicts: ScheduleConflictDetail[];
  hasConflict: boolean;
  timeZone: string;
}

/** Một dòng báo cáo giờ dạy. */
export interface TeachingHoursRow {
  teacherId: number;
  teacherName: string;
  sessionCount: number;
  totalMinutes: number;
  totalHours: number;
}

/** Lịch sử thay đổi buổi học. */
export interface SessionChangeEntry {
  id: number;
  changeType: 'RESCHEDULE' | 'SHIFT' | 'CHANGE_TEACHER' | 'CHANGE_ROOM' | 'CANCEL';
  reason: string | null;
  createdAt: string;
  changedBy: ApiUserRef | null;
  fromStartTime: string | null;
  toStartTime: string | null;
  fromEndTime: string | null;
  toEndTime: string | null;
  fromTeacherId: number | null;
  toTeacherId: number | null;
  fromRoomId: number | null;
  toRoomId: number | null;
  fromStatus: ApiSessionStatus | null;
  toStatus: ApiSessionStatus | null;
}

/** Thân lỗi chuẩn của backend: `{ statusCode, message, error, data? }`. */
export interface ApiErrorBody {
  statusCode?: number;
  message?: string;
  error?: string;
  data?: ScheduleConflictDetail | Record<string, unknown>;
}

/** Payload tạo lớp. */
export interface CreateClassPayload {
  classCode: string;
  courseId: number;
  branchId: number;
  teacherId: number;
  maxStudents: number;
  startDate: string;
  endDate?: string;
}

/** Payload cập nhật lớp. */
export interface UpdateClassPayload {
  status?: ApiClassStatus;
  maxStudents?: number;
  courseId?: number;
  branchId?: number;
  teacherId?: number;
  startDate?: string;
  endDate?: string | null;
}

/** Quy tắc lặp dùng chung cho preview / generate. */
export interface ScheduleRulePayload {
  /** ISO weekday: 1 = Thứ 2 … 7 = Chủ Nhật. */
  weekdays: number[];
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  sessionCount?: number;
}

/** Payload tạo lớp kèm lịch (POST /classes/with-sessions). */
export interface CreateClassWithSessionsPayload extends ScheduleRulePayload {
  classCode: string;
  courseId: number;
  branchId: number;
  teacherId: number;
  roomId: number;
  maxStudents: number;
}
