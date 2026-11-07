import {
  addDaysKey,
  daysBetween,
  firstOfMonth,
  fromDateKey,
  periodEnd,
  toDateKey,
} from './dates';

describe('dates', () => {
  test('toDateKey / fromDateKey round trip in local time', () => {
    const d = new Date(2026, 10, 1); // 1 Nov 2026 local
    expect(toDateKey(d)).toBe('2026-11-01');
    expect(toDateKey(fromDateKey('2026-02-28'))).toBe('2026-02-28');
  });

  test('periodEnd for one month ends the day before the same date next month', () => {
    expect(periodEnd('2026-11-01', 1)).toBe('2026-11-30');
    expect(periodEnd('2026-12-01', 1)).toBe('2026-12-31');
    expect(periodEnd('2026-11-15', 1)).toBe('2026-12-14');
  });

  test('periodEnd handles multiple months and year rollover', () => {
    expect(periodEnd('2026-11-01', 3)).toBe('2027-01-31');
    expect(periodEnd('2026-01-01', 12)).toBe('2026-12-31');
  });

  test('periodEnd handles short months', () => {
    expect(periodEnd('2027-01-31', 1)).toBe('2027-02-27');
    expect(periodEnd('2028-02-01', 1)).toBe('2028-02-29'); // leap year
  });

  test('addDaysKey and daysBetween', () => {
    expect(addDaysKey('2026-11-30', 1)).toBe('2026-12-01');
    expect(daysBetween('2026-11-01', '2026-11-07')).toBe(6);
    expect(daysBetween('2026-11-07', '2026-11-01')).toBe(-6);
    // across DST change (last Sunday of October in Europe)
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(3);
  });

  test('firstOfMonth', () => {
    expect(firstOfMonth('2026-11-07')).toBe('2026-11-01');
  });
});
