import { countInMonth, lastAttended, presentOn } from './attendance';
import { ageOn, isBirthday, monthOf, shiftMonth } from './dates';
import * as XLSX from 'xlsx';
import { buildExport, toXlsxBase64 } from './export';
import { buildMonths } from './months';
import { cleanPhone, smsUrl } from './reminder';
import { collectedByMonth, monthSummary } from './summary';
import { pay, seg, member } from './testing';
import type { Attendance } from './types';

const TS = '2026-01-01T00:00:00.000Z';

function att(memberId: string, date: string, deleted = false): Attendance {
  return { id: `${memberId}-${date}`, memberId, date, createdAt: TS, updatedAt: TS, deleted };
}

describe('month helpers', () => {
  test('monthOf and shiftMonth', () => {
    expect(monthOf('2026-11-07')).toBe('2026-11');
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', -13)).toBe('2025-10');
  });
});

describe('birthdays', () => {
  test('isBirthday matches month and day', () => {
    expect(isBirthday('2015-11-07', '2026-11-07')).toBe(true);
    expect(isBirthday('2015-11-08', '2026-11-07')).toBe(false);
    expect(isBirthday(null, '2026-11-07')).toBe(false);
  });
  test('29 Feb birthdays are celebrated on 28 Feb in non-leap years', () => {
    expect(isBirthday('2012-02-29', '2026-02-28')).toBe(true);
    expect(isBirthday('2012-02-29', '2028-02-28')).toBe(false);
    expect(isBirthday('2012-02-29', '2028-02-29')).toBe(true);
  });
  test('ageOn counts completed years', () => {
    expect(ageOn('2015-11-07', '2026-11-07')).toBe(11);
    expect(ageOn('2015-11-08', '2026-11-07')).toBe(10);
  });
});

describe('reminder', () => {
  test('cleanPhone keeps digits and a leading +', () => {
    expect(cleanPhone('+381 64/123-45 67')).toBe('+381641234567');
    expect(cleanPhone('(064) 123 4567')).toBe('0641234567');
  });
  test('smsUrl encodes the message', () => {
    expect(smsUrl('064 123', 'Zdravo Ana, 3.000 RSD')).toBe('sms:064123?body=Zdravo%20Ana%2C%203.000%20RSD');
  });
});

describe('attendance', () => {
  const list = [
    att('a', '2026-11-03'),
    att('a', '2026-11-05'),
    att('a', '2026-11-05'), // duplicate from a second phone
    att('a', '2026-10-30'),
    att('b', '2026-11-05'),
    att('b', '2026-11-06', true),
  ];
  test('presentOn ignores unchecked rows', () => {
    expect([...presentOn(list, '2026-11-05')].sort()).toEqual(['a', 'b']);
    expect([...presentOn(list, '2026-11-06')]).toEqual([]);
  });
  test('countInMonth counts distinct days', () => {
    expect(countInMonth(list, 'a', '2026-11')).toBe(2);
    expect(countInMonth(list, 'b', '2026-11')).toBe(1);
  });
  test('lastAttended', () => {
    expect(lastAttended(list, 'a')).toBe('2026-11-05');
    expect(lastAttended(list, 'b')).toBe('2026-11-05');
    expect(lastAttended(list, 'c')).toBeNull();
  });
});

describe('monthSummary', () => {
  const members = [
    member({ id: 'a', joinedAt: '2026-11-02' }),
    member({ id: 'b', createdAt: '2026-11-04T10:00:00.000Z', price: 2500 }),
    member({ id: 'c', joinedAt: '2026-10-01' }),
    member({ id: 'd', joinedAt: '2026-11-03', deleted: true }),
  ];
  const segments = [
    seg({ memberId: 'a', startDate: '2026-11-01' }),
    seg({ memberId: 'b', startDate: '2026-11-01' }),
    // Paused on 1 Nov: no November month.
    seg({ memberId: 'c', startDate: '2026-10-01', endDate: '2026-11-01' }),
    seg({ memberId: 'd', startDate: '2026-11-01' }),
  ];
  const payments = [
    pay({ memberId: 'a', periodStart: '2026-11-01', periodEnd: '2026-11-30', paidAt: '2026-11-01' }),
    // October month paid late in November: counts as cash in November.
    pay({ memberId: 'c', periodStart: '2026-10-01', periodEnd: '2026-10-31', paidAt: '2026-11-10' }),
    pay({ memberId: 'b', periodStart: '2026-11-01', periodEnd: '2026-11-30', paidAt: '2026-11-02', deleted: true }),
  ];
  const slotsBy = new Map(
    members.map((m) => [
      m.id,
      buildMonths(
        segments.filter((s) => s.memberId === m.id),
        payments.filter((p) => p.memberId === m.id),
        m.price ?? 3000,
        '2026-11-15',
      ),
    ]),
  );

  test('cash in, due months and new members for a month', () => {
    expect(monthSummary(members, slotsBy, payments, '2026-11')).toEqual({
      month: '2026-11',
      collected: 6000,
      paymentsCount: 2,
      dueCount: 2,
      duePaidCount: 1,
      dueUnpaidCount: 1,
      dueUnpaidTotal: 2500,
      newMembers: 2,
    });
  });

  test('collectedByMonth returns the last n months, oldest first', () => {
    expect(collectedByMonth(payments, '2026-11', 3)).toEqual([
      { month: '2026-09', collected: 0 },
      { month: '2026-10', collected: 0 },
      { month: '2026-11', collected: 6000 },
    ]);
  });
});

describe('buildExport', () => {
  test('four sheets with headers and readable rows; deleted rows left out', () => {
    const sheets = buildExport(
      [
        member({ id: 'a', firstName: 'Ana', lastName: 'Anić', groupName: 'Deca', price: 2500, phone: '064' }),
        member({ id: 'z', firstName: 'Obrisan', deleted: true }),
      ],
      [
        seg({ memberId: 'a', startDate: '2026-12-01', endDate: '2027-01-01' }),
        seg({ memberId: 'a', startDate: '2027-02-15' }),
        seg({ memberId: 'a', startDate: '2020-01-01', deleted: true }),
      ],
      [pay({ memberId: 'a', periodStart: '2026-12-01', periodEnd: '2026-12-31', paidAt: '2026-12-02' })],
      [att('a', '2026-11-05'), att('a', '2026-11-06', true)],
    );
    expect(sheets.map((s) => s.name)).toEqual(['Članovi', 'Periodi', 'Uplate', 'Prisustvo']);
    const [membersSheet, segmentsSheet, paymentsSheet, attendanceSheet] = sheets;
    expect(membersSheet.rows).toHaveLength(2);
    expect(membersSheet.rows[1]).toEqual(expect.arrayContaining(['Ana', 'Anić', '064', 'Deca', 2500]));
    expect(segmentsSheet.rows.slice(1)).toEqual([
      ['Ana Anić', '2027-02-15', ''],
      ['Ana Anić', '2026-12-01', '2027-01-01'],
    ]);
    expect(paymentsSheet.rows[1]).toEqual(['Ana Anić', '2026-12-01', '2026-12-31', 1, 3000, '2026-12-02', '']);
    expect(attendanceSheet.rows).toEqual([attendanceSheet.rows[0], ['2026-11-05', 'Ana Anić']]);
  });
});

describe('toXlsxBase64', () => {
  test('produces a real workbook that reads back with the same data', () => {
    const sheets = buildExport([member({ id: 'a', firstName: 'Đorđe', lastName: 'Čolić', price: 2500 })], [], [], []);
    const wb = XLSX.read(toXlsxBase64(sheets), { type: 'base64' });
    expect(wb.SheetNames).toEqual(['Članovi', 'Periodi', 'Uplate', 'Prisustvo']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Članovi'], { header: 1 });
    expect(rows[1]).toEqual(expect.arrayContaining(['Đorđe', 'Čolić', 2500]));
  });
});
