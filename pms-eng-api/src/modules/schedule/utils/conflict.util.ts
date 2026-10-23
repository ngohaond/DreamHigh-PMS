/**
 * Tiện ích kiểm tra xung đột lịch — thuần, không phụ thuộc Nest/Prisma.
 *
 * Quy tắc overlap (chuẩn nửa mở [start, end)):
 *   aStart < bEnd && aEnd > bStart
 * Nên hai buổi nối tiếp đúng tại biên (end == start) KHÔNG bị coi là xung đột.
 */

export type TimeLike = Date | string | number;

export function toDate(value: TimeLike): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Hai khoảng thời gian có chồng lấn hay không. */
export function overlaps(aStart: TimeLike, aEnd: TimeLike, bStart: TimeLike, bEnd: TimeLike): boolean {
  const aS = toDate(aStart).getTime();
  const aE = toDate(aEnd).getTime();
  const bS = toDate(bStart).getTime();
  const bE = toDate(bEnd).getTime();
  return aS < bE && aE > bS;
}

/** Khoảng thời gian có hợp lệ không (start < end, không NaN). */
export function isValidInterval(start: TimeLike, end: TimeLike): boolean {
  const s = toDate(start).getTime();
  const e = toDate(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return false;
  return s < e;
}

export type Interval = { start: TimeLike; end: TimeLike };

/**
 * Khoảng thời gian `candidate` có chồng lấn bất kỳ khoảng nào trong `existing` không.
 * `excludeIds` dùng để bỏ qua chính các session đang được cập nhật (reschedule/swap).
 */
export function findOverlapping(
  candidate: Interval,
  existing: (Interval & { id?: number | string })[],
  excludeIds: (number | string)[] = [],
): (Interval & { id?: number | string }) | null {
  const excluded = new Set(excludeIds.map(String));
  for (const item of existing) {
    if (item.id != null && excluded.has(String(item.id))) continue;
    if (overlaps(candidate.start, candidate.end, item.start, item.end)) {
      return item;
    }
  }
  return null;
}

/** Số phút giữa hai mốc thời gian (dương nếu `end` sau `start`). */
export function durationMinutes(start: TimeLike, end: TimeLike): number {
  return (toDate(end).getTime() - toDate(start).getTime()) / 60000;
}
