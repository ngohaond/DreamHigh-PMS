import type { ApiErrorBody, ScheduleConflictDetail } from '../types/scheduling';

/**
 * Múi giờ vận hành của hệ thống (khớp `APP_TIMEZONE` mặc định của backend).
 * Mọi giờ lưu trong DB là UTC; FE hiển thị theo múi giờ này.
 */
export const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';

const zonedFormatterCache = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = zonedFormatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    zonedFormatterCache.set(timeZone, f);
  }
  return f;
}

/**
 * Tách một mốc thời gian UTC thành ngày + giờ địa phương theo múi giờ vận hành.
 * Trả về `{ ymd: 'YYYY-MM-DD', hhmm: 'HH:mm' }`.
 */
export function toZonedDateTime(
  iso: string | Date,
  timeZone: string = APP_TIMEZONE,
): { ymd: string; hhmm: string } {
  const instant = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(instant.getTime())) return { ymd: '', hhmm: '' };
  const parts = zonedFormatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const ymd = `${String(get('year')).padStart(4, '0')}-${String(get('month')).padStart(2, '0')}-${String(
    get('day'),
  ).padStart(2, '0')}`;
  const hhmm = `${String(get('hour')).padStart(2, '0')}:${String(get('minute')).padStart(2, '0')}`;
  return { ymd, hhmm };
}

/** Nhãn tiếng Việt cho trạng thái lớp học. */
export const CLASS_STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Dự kiến',
  ACTIVE: 'Đang học',
  COMPLETED: 'Kết thúc',
  CANCELLED: 'Đã huỷ',
};

/** Nhãn tiếng Việt cho trạng thái buổi học. */
export const SESSION_STATUS_LABEL: Record<string, string> = {
  NORMAL: 'Bình thường',
  RESCHEDULED: 'Đã dời lịch',
  CANCELLED: 'Đã huỷ',
};

/** Nhãn tiếng Việt cho trạng thái phòng học. */
export const ROOM_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Hoạt động',
  MAINTENANCE: 'Bảo trì',
  INACTIVE: 'Ngừng',
};

/** Nhãn tiếng Việt cho loại xung đột. */
export const CONFLICT_RESOURCE_LABEL: Record<string, string> = {
  TEACHER: 'Giáo viên',
  ROOM: 'Phòng học',
};

/** Tên thứ trong tuần (ISO weekday: 1 = Thứ 2 … 7 = Chủ Nhật). */
export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
  7: 'Chủ Nhật',
};

/** Ngày trong tuần dạng ngắn cho lịch. */
export const WEEKDAY_SHORT: Record<number, string> = {
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
  7: 'CN',
};

/** Chuyển Date sang chuỗi YYYY-MM-DD theo giờ địa phương của máy người dùng. */
export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Ngày hôm nay dạng YYYY-MM-DD. */
export function todayYmd(): string {
  return toYmd(new Date());
}

/** Cộng số ngày vào chuỗi YYYY-MM-DD. */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

/** Thứ trong tuần ISO (1 = Thứ 2 … 7 = Chủ Nhật) của chuỗi YYYY-MM-DD. */
export function isoWeekday(ymd: string): number {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 ? 7 : dow;
}

/** Khoảng ngày mặc định: tuần hiện tại (Thứ 2 → Chủ Nhật). */
export function currentWeekRange(): { from: string; to: string } {
  const today = todayYmd();
  const iso = isoWeekday(today);
  const monday = addDaysYmd(today, -(iso - 1));
  return { from: monday, to: addDaysYmd(monday, 6) };
}

/** Khoảng ngày mặc định: 30 ngày gần nhất (từ hôm nay trở lên). */
export function defaultReportRange(): { from: string; to: string } {
  const from = addDaysYmd(todayYmd(), -30);
  return { from, to: addDaysYmd(todayYmd(), 30) };
}

/** Định dạng ngày kiểu Việt Nam từ chuỗi YYYY-MM-DD. */
export function formatYmdVi(ymd: string): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return ymd;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** Định dạng ngày kiểu Việt Nam từ chuỗi ISO UTC. */
export function formatIsoVi(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Lấy message lỗi chuẩn của backend từ axios error. */
export function apiErrorMessage(error: unknown, fallback = 'Có lỗi xảy ra'): string {
  const err = error as { response?: { data?: ApiErrorBody } };
  const body = err?.response?.data;
  if (body?.message) return body.message;
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
    return body.error;
  }
  return fallback;
}

/** Lấy chi tiết xung đột (nếu lỗi là 422 SCHEDULE_CONFLICT). */
export function apiConflictDetail(error: unknown): ScheduleConflictDetail | null {
  const err = error as { response?: { status?: number; data?: ApiErrorBody } };
  if (err?.response?.status !== 422) return null;
  const body = err.response?.data;
  if (!body || body.error !== 'SCHEDULE_CONFLICT') return null;
  const detail = body.data as ScheduleConflictDetail | undefined;
  if (!detail || typeof detail !== 'object' || !detail.resourceType) return null;
  return detail;
}

/** Tải file CSV từ nội dung text (không dùng thư viện ngoài). */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([`﻿${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Escape giá trị ô CSV (dấu phẩy, nháy kép, xuống dòng). */
export function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
