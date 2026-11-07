import { formatDate, formatMoney, formatMonth, formatMonthShort, formatPeriod, fullName, initials } from './format';

describe('format', () => {
  test('formatMoney uses dot thousands separator and RSD', () => {
    expect(formatMoney(3000)).toBe('3.000 RSD');
    expect(formatMoney(500)).toBe('500 RSD');
    expect(formatMoney(1234567)).toBe('1.234.567 RSD');
  });

  test('formatDate in Serbian Latin', () => {
    expect(formatDate('2026-11-01')).toBe('1. nov 2026.');
  });

  test('formatPeriod', () => {
    expect(formatPeriod('2026-11-01', '2026-11-30')).toBe('1. nov – 30. nov 2026.');
    expect(formatPeriod('2026-12-01', '2027-01-31')).toBe('1. dec 2026. – 31. jan 2027.');
  });

  test('names', () => {
    expect(fullName({ firstName: 'Marko', lastName: 'Petrović' })).toBe('Marko Petrović');
    expect(initials({ firstName: 'Marko', lastName: 'Petrović' })).toBe('MP');
    expect(initials({ firstName: 'ana', lastName: '' })).toBe('A');
  });
});

describe('month names', () => {
  test('formatMonth and formatMonthShort', () => {
    expect(formatMonth('2026-11')).toBe('novembar 2026');
    expect(formatMonth('2027-01')).toBe('januar 2027');
    expect(formatMonthShort('2026-08')).toBe('avg');
  });
});
