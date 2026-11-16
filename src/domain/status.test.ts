import { collectDebts, groupByMember, memberStatus, nextToPay, oldestOwed, priceOf } from './status';
import { buildMonths } from './months';
import { member, pay, seg } from './testing';

const TODAY = '2026-11-07';

describe('memberStatus', () => {
  test('no segments', () => {
    expect(memberStatus([], [], 3000, TODAY)).toEqual({ kind: 'bez_clanarine' });
  });

  test('paid month covering today', () => {
    expect(
      memberStatus(
        [seg({ startDate: '2026-11-01' })],
        [pay({ periodStart: '2026-11-01', periodEnd: '2026-11-30' })],
        3000,
        TODAY,
      ),
    ).toEqual({ kind: 'placeno', until: '2026-11-30' });
  });

  test('delayed payment: the month started on the 1st and money is not in yet', () => {
    expect(memberStatus([seg({ startDate: '2026-11-01' })], [], 3000, TODAY)).toEqual({
      kind: 'duguje',
      debt: 3000,
      since: '2026-11-01',
      unpaidCount: 1,
    });
  });

  test('debt sums every started unpaid month at the given price', () => {
    expect(memberStatus([seg({ startDate: '2026-09-15' })], [], 2500, TODAY)).toEqual({
      kind: 'duguje',
      debt: 5000,
      since: '2026-09-15',
      unpaidCount: 2,
    });
  });

  test('debt stays while paused', () => {
    expect(memberStatus([seg({ startDate: '2026-10-01', endDate: '2026-10-20' })], [], 3000, TODAY)).toEqual({
      kind: 'duguje',
      debt: 3000,
      since: '2026-10-01',
      unpaidCount: 1,
    });
  });

  test('expiring soon within 5 days', () => {
    expect(
      memberStatus(
        [seg({ startDate: '2026-10-12', endDate: '2026-11-12' })],
        [pay({ periodStart: '2026-10-12', periodEnd: '2026-11-11' })],
        3000,
        TODAY,
      ),
    ).toEqual({ kind: 'istice_uskoro', until: '2026-11-11', daysLeft: 4 });
  });

  test('consecutive paid months chain into one "paid until"', () => {
    expect(
      memberStatus(
        [seg({ startDate: '2026-10-10' })],
        [
          pay({ periodStart: '2026-10-10', periodEnd: '2026-11-09' }),
          pay({ periodStart: '2026-11-10', periodEnd: '2026-12-09' }),
        ],
        3000,
        TODAY,
      ),
    ).toEqual({ kind: 'placeno', until: '2026-12-09' });
  });

  test('a running member whose paid month ends soon but who already owes nothing next is expiring', () => {
    // Paid 8 Oct–7 Nov, next month starts 8 Nov (not started yet): expiring today.
    expect(
      memberStatus(
        [seg({ startDate: '2026-10-08' })],
        [pay({ periodStart: '2026-10-08', periodEnd: '2026-11-07' })],
        3000,
        TODAY,
      ),
    ).toEqual({ kind: 'istice_uskoro', until: '2026-11-07', daysLeft: 0 });
  });

  test('paused with nothing owed', () => {
    expect(
      memberStatus(
        [seg({ startDate: '2026-09-01', endDate: '2026-10-01' })],
        [pay({ periodStart: '2026-09-01', periodEnd: '2026-09-30' })],
        3000,
        TODAY,
      ),
    ).toEqual({ kind: 'pauza', resumesAt: null });
  });

  test('a paid month still running after the pause counts as paid', () => {
    expect(
      memberStatus(
        [seg({ startDate: '2026-11-01', endDate: '2026-11-05' })],
        [pay({ periodStart: '2026-11-01', periodEnd: '2026-11-30' })],
        3000,
        TODAY,
      ),
    ).toEqual({ kind: 'placeno', until: '2026-11-30' });
  });

  test('a future restart is reported', () => {
    expect(
      memberStatus(
        [seg({ startDate: '2026-09-01', endDate: '2026-09-01' }), seg({ startDate: '2026-12-01' })],
        [],
        3000,
        TODAY,
      ),
    ).toEqual({ kind: 'pauza', resumesAt: '2026-12-01' });
  });
});

describe('oldestOwed / nextToPay', () => {
  test('pick the oldest owed month, else the next upcoming one', () => {
    const owing = buildMonths([seg({ startDate: '2026-09-15' })], [], 3000, TODAY, 1);
    expect(oldestOwed(owing)?.start).toBe('2026-09-15');
    expect(nextToPay(owing)?.start).toBe('2026-09-15');

    const paid = buildMonths(
      [seg({ startDate: '2026-11-01' })],
      [pay({ periodStart: '2026-11-01', periodEnd: '2026-11-30' })],
      3000,
      TODAY,
      1,
    );
    expect(oldestOwed(paid)).toBeUndefined();
    expect(nextToPay(paid)?.start).toBe('2026-12-01');
  });
});

describe('priceOf', () => {
  test('own price wins over the default', () => {
    expect(priceOf(member({ price: 2000 }), 3000)).toBe(2000);
    expect(priceOf(member(), 3000)).toBe(3000);
  });
});

describe('collectDebts', () => {
  test('lists debtors oldest first, skipping deleted members, using each price', () => {
    const members = [
      member({ id: 'a', firstName: 'Ana' }),
      member({ id: 'b', firstName: 'Bojan', price: 2000 }),
      member({ id: 'c', firstName: 'Ceca', deleted: true }),
      member({ id: 'd', firstName: 'Dule' }),
    ];
    const segments = [
      seg({ memberId: 'a', startDate: '2026-11-01' }),
      seg({ memberId: 'b', startDate: '2026-10-01' }),
      seg({ memberId: 'c', startDate: '2026-10-01' }),
      seg({ memberId: 'd', startDate: '2026-11-01' }),
    ];
    const payments = [pay({ memberId: 'd', periodStart: '2026-11-01', periodEnd: '2026-11-30' })];
    const result = collectDebts(members, groupByMember(segments), groupByMember(payments), 3000, TODAY);
    expect(result.items.map((d) => d.member.id)).toEqual(['b', 'a']);
    expect(result.items[0]).toMatchObject({ debt: 4000, unpaidCount: 2, daysOverdue: 37 });
    expect(result.total).toBe(7000);
  });
});
