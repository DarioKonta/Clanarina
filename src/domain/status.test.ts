import type { Member, Membership } from './types';
import {
  collectDebts,
  memberStatus,
  membershipStatus,
  suggestNextPeriodStart,
} from './status';

const TS = '2026-01-01T00:00:00.000Z';

function ms(p: Partial<Membership> & Pick<Membership, 'periodStart'>): Membership {
  return {
    id: Math.random().toString(36).slice(2),
    memberId: 'm1',
    months: 1,
    periodEnd: '',
    amount: 3000,
    paidAt: null,
    note: null,
    createdAt: TS,
    updatedAt: TS,
    deleted: false,
    ...p,
  };
}

function member(p: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    firstName: 'Marko',
    lastName: 'Petrović',
    phone: null,
    note: null,
    groupName: null,
    price: null,
    birthDate: null,
    joinedAt: null,
    active: true,
    createdAt: TS,
    updatedAt: TS,
    deleted: false,
    ...p,
  };
}

const TODAY = '2026-11-07';

describe('membershipStatus', () => {
  test('paid when paidAt is set', () => {
    expect(membershipStatus(ms({ periodStart: '2026-11-01', paidAt: '2026-11-10' }), TODAY)).toBe('placeno');
  });
  test('owes when unpaid and period has started (delayed payment)', () => {
    expect(membershipStatus(ms({ periodStart: '2026-11-01' }), TODAY)).toBe('duguje');
    expect(membershipStatus(ms({ periodStart: TODAY }), TODAY)).toBe('duguje');
  });
  test('upcoming when unpaid and not started yet', () => {
    expect(membershipStatus(ms({ periodStart: '2026-12-01' }), TODAY)).toBe('predstojece');
  });
});

describe('memberStatus', () => {
  test('no memberships', () => {
    expect(memberStatus([], TODAY)).toEqual({ kind: 'bez_clanarine' });
  });

  test('paid membership covering today', () => {
    expect(
      memberStatus([ms({ periodStart: '2026-11-01', months: 1, paidAt: '2026-11-01' })], TODAY),
    ).toEqual({ kind: 'placeno', until: '2026-11-30' });
  });

  test('delayed payment: period started on the 1st, money not brought yet', () => {
    const s = memberStatus([ms({ periodStart: '2026-11-01', amount: 3000 })], TODAY);
    expect(s).toEqual({ kind: 'duguje', debt: 3000, since: '2026-11-01', unpaidCount: 1 });
  });

  test('debt sums all started unpaid memberships and reports the oldest', () => {
    const s = memberStatus(
      [
        ms({ periodStart: '2026-10-01', amount: 3000 }),
        ms({ periodStart: '2026-11-01', amount: 2500 }),
        ms({ periodStart: '2026-12-01', amount: 3000 }), // not started -> not a debt
      ],
      TODAY,
    );
    expect(s).toEqual({ kind: 'duguje', debt: 5500, since: '2026-10-01', unpaidCount: 2 });
  });

  test('expiring soon within 5 days', () => {
    expect(
      memberStatus([ms({ periodStart: '2026-10-08', paidAt: '2026-10-08' })], TODAY),
    ).toEqual({ kind: 'istice_uskoro', until: '2026-11-07', daysLeft: 0 });
    expect(
      memberStatus([ms({ periodStart: '2026-10-12', paidAt: '2026-10-12' })], TODAY),
    ).toEqual({ kind: 'istice_uskoro', until: '2026-11-11', daysLeft: 4 });
  });

  test('a following paid period prevents "expiring soon"', () => {
    expect(
      memberStatus(
        [
          ms({ periodStart: '2026-10-10', paidAt: '2026-10-10' }),
          ms({ periodStart: '2026-11-10', paidAt: '2026-11-05' }),
        ],
        TODAY,
      ),
    ).toEqual({ kind: 'placeno', until: '2026-12-09' });
  });

  test('expired when last period ended', () => {
    expect(
      memberStatus([ms({ periodStart: '2026-09-01', paidAt: '2026-09-01' })], TODAY),
    ).toEqual({ kind: 'isteklo', lastEnd: '2026-09-30' });
  });

  test('ignores deleted memberships', () => {
    expect(memberStatus([ms({ periodStart: '2026-11-01', deleted: true })], TODAY)).toEqual({
      kind: 'bez_clanarine',
    });
  });
});

describe('collectDebts', () => {
  test('lists debtors sorted by oldest debt, skipping deleted members', () => {
    const members = [
      member({ id: 'a', firstName: 'Ana' }),
      member({ id: 'b', firstName: 'Bojan' }),
      member({ id: 'c', firstName: 'Ceca', deleted: true }),
      member({ id: 'd', firstName: 'Dule' }),
    ];
    const memberships = [
      ms({ memberId: 'a', periodStart: '2026-11-01' }),
      ms({ memberId: 'b', periodStart: '2026-10-01' }),
      ms({ memberId: 'c', periodStart: '2026-10-01' }),
      ms({ memberId: 'd', periodStart: '2026-11-01', paidAt: '2026-11-01' }),
    ];
    const result = collectDebts(members, memberships, TODAY);
    expect(result.items.map((d) => d.member.id)).toEqual(['b', 'a']);
    expect(result.items[0].daysOverdue).toBe(37);
    expect(result.total).toBe(6000);
  });
});

describe('suggestNextPeriodStart', () => {
  test('continues right after the last period when it is recent', () => {
    expect(
      suggestNextPeriodStart([ms({ periodStart: '2026-10-15', paidAt: '2026-10-15' })], TODAY),
    ).toBe('2026-11-15');
  });
  test('falls back to the 1st of the current month for new or lapsed members', () => {
    expect(suggestNextPeriodStart([], TODAY)).toBe('2026-11-01');
    expect(
      suggestNextPeriodStart([ms({ periodStart: '2026-05-01', paidAt: '2026-05-01' })], TODAY),
    ).toBe('2026-11-01');
  });
});
