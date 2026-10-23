/**
 * Xử lý múi giờ cho lịch học.
 *
 * Quyết định nghiệp vụ (đã chốt): múi giờ vận hành cố định là Asia/Ho_Chi_Minh,
 * cấu hình qua biến môi trường APP_TIMEZONE. Mọi giờ nhập từ client được hiểu
 * là giờ địa phương theo múi giờ này, rồi mới quy đổi sang UTC để lưu.
 * Không phụ thuộc timezone của máy chạy API.
 */

export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function appTimezone(): string {
  const raw = process.env.APP_TIMEZONE?.trim();
  return raw || DEFAULT_TIMEZONE;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** Lệch giờ của `timeZone` so với UTC tại thời điểm `instant` (ms). */
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = formatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - instant.getTime();
}

export type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/** Quy đổi giờ địa phương (theo `timeZone`) sang thời điểm UTC tương ứng. */
export function zonedTimeToUtc(
  parts: LocalDateTimeParts,
  timeZone: string,
): Date {
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  let result = new Date(guess - offset);
  // Vòng lặp thứ hai xử lý ranh giới chuyển múi giờ (giờ bị lặp / bị bỏ qua).
  const offset2 = tzOffsetMs(result, timeZone);
  if (offset2 !== offset) {
    result = new Date(guess - offset2);
  }
  return result;
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** ISO weekday: 1 = Thứ 2 … 7 = Chủ nhật. */
  weekday: number;
};

/** Tách một thời điểm UTC thành các thành phần giờ địa phương theo `timeZone`. */
export function toZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const jsWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: jsWeekday === 0 ? 7 : jsWeekday,
  };
}

export function formatLocalDate(instant: Date, timeZone: string): string {
  const p = toZonedParts(instant, timeZone);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function formatLocalTime(instant: Date, timeZone: string): string {
  const p = toZonedParts(instant, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

/** Parse "YYYY-MM-DD" thành y/m/d. Trả về null nếu sai định dạng hoặc ngày không hợp lệ. */
export function parseLocalDate(value: string): { year: number; month: number; day: number } | null {
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** Parse "HH:mm" thành giờ/phút. Trả về null nếu sai định dạng hoặc giá trị vô lý. */
export function parseLocalTime(value: string): { hour: number; minute: number } | null {
  const m = TIME_RE.exec(value);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** Ngày ở dạng Date cho cột kiểu `date` của Prisma (giữ nguyên y/m/d, không lệch múi giờ). */
export function toDateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}
