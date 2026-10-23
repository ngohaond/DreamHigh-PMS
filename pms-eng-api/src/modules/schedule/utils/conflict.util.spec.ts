import {
  durationMinutes,
  findOverlapping,
  isValidInterval,
  overlaps,
  toDate,
} from './conflict.util';

const T = (hhmm: string) => new Date(`2026-03-02T${hhmm}:00.000Z`);

describe('overlaps', () => {
  it('returns false for two disjoint intervals', () => {
    expect(overlaps(T('08:00'), T('09:00'), T('10:00'), T('11:00'))).toBe(false);
  });

  it('returns false when the second interval is entirely before the first', () => {
    expect(overlaps(T('10:00'), T('11:00'), T('08:00'), T('09:00'))).toBe(false);
  });

  it('returns true for partial overlap at the start', () => {
    expect(overlaps(T('08:00'), T('10:00'), T('09:00'), T('11:00'))).toBe(true);
  });

  it('returns true for partial overlap at the end', () => {
    expect(overlaps(T('09:00'), T('11:00'), T('08:00'), T('10:00'))).toBe(true);
  });

  it('returns true when one interval fully covers the other', () => {
    expect(overlaps(T('08:00'), T('12:00'), T('09:00'), T('10:00'))).toBe(true);
  });

  it('returns true for identical intervals', () => {
    expect(overlaps(T('08:00'), T('10:00'), T('08:00'), T('10:00'))).toBe(true);
  });

  it('does not conflict when end == start (touching boundary)', () => {
    expect(overlaps(T('08:00'), T('10:00'), T('10:00'), T('12:00'))).toBe(false);
    expect(overlaps(T('10:00'), T('12:00'), T('08:00'), T('10:00'))).toBe(false);
  });

  it('conflicts when overlapping by a single minute', () => {
    expect(overlaps(T('08:00'), T('10:01'), T('10:00'), T('12:00'))).toBe(true);
    expect(overlaps(T('09:59'), T('10:01'), T('08:00'), T('10:00'))).toBe(true);
  });

  it('accepts ISO strings and epoch numbers as well as Date', () => {
    const start = '2026-03-02T08:00:00.000Z';
    const end = '2026-03-02T10:00:00.000Z';
    expect(overlaps(start, end, T('09:00'), T('11:00'))).toBe(true);
    expect(overlaps(new Date(start).getTime(), new Date(end).getTime(), T('10:00'), T('12:00'))).toBe(false);
  });
});

describe('isValidInterval', () => {
  it('accepts a positive duration', () => {
    expect(isValidInterval(T('08:00'), T('09:00'))).toBe(true);
  });

  it('rejects a zero-length interval', () => {
    expect(isValidInterval(T('08:00'), T('08:00'))).toBe(false);
  });

  it('rejects a negative duration', () => {
    expect(isValidInterval(T('09:00'), T('08:00'))).toBe(false);
  });

  it('rejects invalid dates', () => {
    expect(isValidInterval('not-a-date', T('09:00'))).toBe(false);
  });
});

describe('findOverlapping', () => {
  const existing = [
    { id: 1, start: T('08:00'), end: T('10:00') },
    { id: 2, start: T('14:00'), end: T('16:00') },
  ];

  it('finds the conflicting interval', () => {
    const found = findOverlapping({ start: T('09:00'), end: T('11:00') }, existing);
    expect(found?.id).toBe(1);
  });

  it('returns null when nothing overlaps', () => {
    expect(findOverlapping({ start: T('11:00'), end: T('13:00') }, existing)).toBeNull();
  });

  it('ignores intervals listed in excludeIds', () => {
    const found = findOverlapping({ start: T('09:00'), end: T('11:00') }, existing, [1]);
    expect(found).toBeNull();
  });

  it('still reports a non-excluded conflict', () => {
    const found = findOverlapping({ start: T('15:00'), end: T('17:00') }, existing, [1]);
    expect(found?.id).toBe(2);
  });
});

describe('toDate / durationMinutes', () => {
  it('converts ISO strings to Date', () => {
    expect(toDate('2026-03-02T08:00:00.000Z')).toBeInstanceOf(Date);
    expect(toDate('2026-03-02T08:00:00.000Z').toISOString()).toBe('2026-03-02T08:00:00.000Z');
  });

  it('returns the same Date instance when given a Date', () => {
    const d = T('08:00');
    expect(toDate(d)).toBe(d);
  });

  it('computes duration in minutes', () => {
    expect(durationMinutes(T('08:00'), T('09:30'))).toBe(90);
    expect(durationMinutes(T('08:00'), T('08:00'))).toBe(0);
  });
});
