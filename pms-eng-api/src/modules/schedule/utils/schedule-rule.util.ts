/**
 * Sinh danh sách buổi học từ quy tắc lặp — thuần, dùng chung cho preview và commit.
 *
 * Quy tắc:
 *   - `weekdays`: ISO weekday 1 = Thứ 2 … 7 = Chủ nhật.
 *   - `startDate` / `endDate`: ngày bao phủ (theo giờ địa phương của múi giờ vận hành).
 *   - `startTime` / `endTime`: HH:mm theo giờ địa phương.
 *   - `sessionCount`: nếu có, dừng sau N buổi (bỏ qua `endDate` khi đã đủ số buổi).
 */

import { parseLocalDate, parseLocalTime, toDateOnly, zonedTimeToUtc } from './timezone.util';

export type ScheduleRule = {
  weekdays: number[];
  startDate: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  sessionCount?: number | null;
  timeZone: string;
};

export type PlannedSession = {
  startTime: Date;
  endTime: Date;
  /** Ngày cục bộ dạng YYYY-MM-DD. */
  date: string;
  /** Thứ trong tuần ISO: 1 = Thứ 2 … 7 = Chủ nhật. */
  weekday: number;
};

export class ScheduleRuleError extends Error {}

function addDays(parts: { year: number; month: number; day: number }, days: number) {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + days);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

function weekdayOf(parts: { year: number; month: number; day: number }): number {
  const dow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/**
 * Sinh các buổi học theo quy tắc. Ném `ScheduleRuleError` khi quy tắc không hợp lệ.
 */
export function buildSchedule(rule: ScheduleRule): PlannedSession[] {
  const weekdays = Array.from(new Set(rule.weekdays)).sort((a, b) => a - b);
  if (weekdays.length === 0) {
    throw new ScheduleRuleError('Cần ít nhất một ngày trong tuần để sinh lịch');
  }
  if (weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
    throw new ScheduleRuleError('Ngày trong tuần chỉ nhận giá trị từ 1 (Thứ 2) đến 7 (Chủ Nhật)');
  }

  const startDate = parseLocalDate(rule.startDate);
  if (!startDate) throw new ScheduleRuleError('Ngày bắt đầu không hợp lệ (định dạng YYYY-MM-DD)');

  let endDate: { year: number; month: number; day: number } | null = null;
  if (rule.endDate) {
    endDate = parseLocalDate(rule.endDate);
    if (!endDate) throw new ScheduleRuleError('Ngày kết thúc không hợp lệ (định dạng YYYY-MM-DD)');
    const startKey = startDate.year * 10000 + startDate.month * 100 + startDate.day;
    const endKey = endDate.year * 10000 + endDate.month * 100 + endDate.day;
    if (endKey < startKey) {
      throw new ScheduleRuleError('Ngày kết thúc phải từ ngày bắt đầu trở đi');
    }
  }

  const startTime = parseLocalTime(rule.startTime);
  const endTime = parseLocalTime(rule.endTime);
  if (!startTime) throw new ScheduleRuleError('Giờ bắt đầu không hợp lệ (định dạng HH:mm)');
  if (!endTime) throw new ScheduleRuleError('Giờ kết thúc không hợp lệ (định dạng HH:mm)');

  const startMinutes = startTime.hour * 60 + startTime.minute;
  const endMinutes = endTime.hour * 60 + endTime.minute;
  if (endMinutes <= startMinutes) {
    throw new ScheduleRuleError('Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày');
  }

  const maxSessions =
    rule.sessionCount != null && Number.isFinite(rule.sessionCount)
      ? Math.floor(rule.sessionCount)
      : null;
  if (maxSessions != null && maxSessions < 1) {
    throw new ScheduleRuleError('Số buổi phải ≥ 1');
  }

  const maxDays = 366;
  const result: PlannedSession[] = [];
  let cursor = startDate;
  const weekdaySet = new Set(weekdays);

  for (let i = 0; i < maxDays; i++) {
    if (endDate) {
      const cursorKey = cursor.year * 10000 + cursor.month * 100 + cursor.day;
      const endKey = endDate.year * 10000 + endDate.month * 100 + endDate.day;
      if (cursorKey > endKey) break;
    }
    if (weekdaySet.has(weekdayOf(cursor))) {
      const startUtc = zonedTimeToUtc(
        {
          year: cursor.year,
          month: cursor.month,
          day: cursor.day,
          hour: startTime.hour,
          minute: startTime.minute,
        },
        rule.timeZone,
      );
      const endUtc = zonedTimeToUtc(
        {
          year: cursor.year,
          month: cursor.month,
          day: cursor.day,
          hour: endTime.hour,
          minute: endTime.minute,
        },
        rule.timeZone,
      );
      result.push({
        startTime: startUtc,
        endTime: endUtc,
        date: `${String(cursor.year).padStart(4, '0')}-${String(cursor.month).padStart(2, '0')}-${String(cursor.day).padStart(2, '0')}`,
        weekday: weekdayOf(cursor),
      });
      if (maxSessions != null && result.length >= maxSessions) break;
    }
    cursor = addDays(cursor, 1);
  }

  if (result.length === 0) {
    throw new ScheduleRuleError('Khoảng ngày chọn không có buổi học nào khớp ngày trong tuần');
  }

  return result;
}

/** Ngày bắt đầu / kết thúc lớp tính từ các buổi đã sinh. */
export function scheduleDateRange(sessions: PlannedSession[]): { startDate: Date; endDate: Date } {
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const startDate = parseLocalDate(first.date)!;
  const endDate = parseLocalDate(last.date)!;
  return {
    startDate: toDateOnly(startDate.year, startDate.month, startDate.day),
    endDate: toDateOnly(endDate.year, endDate.month, endDate.day),
  };
}
