import { buildMonths, coveredUntil, openSegment, paymentId, validateSegment } from './months';
import { pay, seg } from './testing';

const starts = (slots: { start: string }[]) => slots.map((s) => s.start);

describe('buildMonths', () => {
  test('spec example: start 1 Dec, pause 1 Jan, back 15 Feb', () => {
    const slots = buildMonths(
      [seg({ startDate: '2026-12-01', endDate: '2027-01-01' }), seg({ startDate: '2027-02-15' })],
      [],
      3000,
      '2027-03-01',
      1,
    );
    expect(starts(slots)).toEqual(['2026-12-01', '2027-02-15', '2027-03-15']);
    expect(slots[0]).toMatchObject({ end: '2026-12-31', state: 'duguje', amount: 3000, payment: null });
    expect(slots[1]).toMatchObject({ end: '2027-03-14', state: 'duguje' });
    expect(slots[2].state).toBe('predstojece');
  });

  test('months stay anchored to the segment start (no drift at month end)', () => {
    const slots = buildMonths([seg({ startDate: '2026-01-31' })], [], 3000, '2026-01-31', 3);
    expect(starts(slots)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(slots[0].end).toBe('2026-02-27');
    expect(slots[1].end).toBe('2026-03-30');
  });

  test('pausing on the start day gives no months', () => {
    expect(buildMonths([seg({ startDate: '2026-11-10', endDate: '2026-11-10' })], [], 3000, '2026-12-01')).toEqual(
      [],
    );
  });

  test('a month that started before the pause is owed in full', () => {
    const slots = buildMonths([seg({ startDate: '2026-12-01', endDate: '2026-12-20' })], [], 2500, '2027-01-10');
    expect(starts(slots)).toEqual(['2026-12-01']);
    expect(slots[0]).toMatchObject({ state: 'duguje', amount: 2500 });
  });

  test('a 3-month payment covers exactly three months and keeps its amount', () => {
    const p = pay({ periodStart: '2026-11-01', periodEnd: '2027-01-31', months: 3, amount: 8000 });
    const slots = buildMonths([seg({ startDate: '2026-11-01' })], [p], 3000, '2026-11-05', 4);
    expect(slots.map((s) => s.state)).toEqual(['placeno', 'placeno', 'placeno', 'predstojece', 'predstojece']);
    expect(slots[0].payment).toBe(p);
    expect(slots[0].amount).toBe(8000);
    expect(slots[3].amount).toBe(3000);
  });

  test('deleted payments and segments are ignored', () => {
    const slots = buildMonths(
      [seg({ startDate: '2026-11-01' }), seg({ startDate: '2026-01-01', deleted: true })],
      [pay({ periodStart: '2026-11-01', periodEnd: '2026-11-30', deleted: true })],
      3000,
      '2026-11-05',
      0,
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].state).toBe('duguje');
  });

  test('a moved segment start still counts a payment covering the new month start', () => {
    const p = pay({ periodStart: '2026-12-01', periodEnd: '2026-12-31' });
    const slots = buildMonths([seg({ startDate: '2026-12-05' })], [p], 3000, '2027-01-10', 0);
    expect(slots.map((s) => [s.start, s.state])).toEqual([
      ['2026-12-05', 'placeno'],
      ['2027-01-05', 'duguje'],
    ]);
  });

  test('open segment generates months up to `ahead` months after today', () => {
    const slots = buildMonths([seg({ startDate: '2026-11-01' })], [], 3000, '2026-11-07');
    expect(slots).toHaveLength(13);
    expect(slots[12].start).toBe('2027-11-01');
  });

  test('a future segment has only upcoming months', () => {
    const slots = buildMonths([seg({ startDate: '2026-12-15' })], [], 3000, '2026-11-07', 1);
    expect(slots.map((s) => s.state)).toEqual(['predstojece']);
  });
});

describe('paymentId', () => {
  test('is a stable, UUID-shaped id per member and month', () => {
    const a = paymentId('m1', '2026-11-01');
    expect(a).toBe(paymentId('m1', '2026-11-01'));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(paymentId('m1', '2026-12-01')).not.toBe(a);
    expect(paymentId('m2', '2026-11-01')).not.toBe(a);
  });
});

describe('segments', () => {
  const list = [
    seg({ id: 'a', startDate: '2026-12-01', endDate: '2027-01-01' }),
    seg({ id: 'b', startDate: '2027-02-15' }),
  ];

  test('openSegment finds the running one', () => {
    expect(openSegment(list)?.id).toBe('b');
    expect(openSegment([list[0]])).toBeUndefined();
  });

  test('validateSegment', () => {
    expect(validateSegment(list, { id: 'a', startDate: '2026-11-20', endDate: '2027-01-01' })).toBeNull();
    expect(validateSegment(list, { id: 'a', startDate: '2027-01-01', endDate: '2027-01-01' })).toBe('invalidRange');
    expect(validateSegment(list, { id: 'a', startDate: '2026-12-01', endDate: '2027-03-01' })).toBe('overlap');
    expect(validateSegment(list, { id: 'a', startDate: '2026-12-01', endDate: null })).toBe('overlap');
    expect(validateSegment(list, { startDate: '2027-01-10', endDate: '2027-02-01' })).toBeNull();
    expect(validateSegment([list[0]], { startDate: '2026-12-31', endDate: null })).toBe('overlap');
    expect(validateSegment([list[0]], { startDate: '2027-01-01', endDate: null })).toBeNull();
  });
});

describe('coveredUntil', () => {
  const segments = [seg({ startDate: '2026-12-01', endDate: '2027-01-01' }), seg({ startDate: '2027-02-15' })];
  const slots = buildMonths(segments, [], 3000, '2027-03-01', 2);

  test('follows the grid inside one segment', () => {
    expect(coveredUntil(slots, '2027-02-15', 2)).toBe('2027-04-14');
  });

  test('does not jump into the next segment after a pause', () => {
    expect(coveredUntil(slots, '2026-12-01', 2)).toBe('2027-01-31');
  });
});
