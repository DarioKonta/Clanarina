/** Test fixtures shared by domain tests. Not used by the app. */
import type { Member, Membership, Segment } from './types';

export const TS = '2026-01-01T00:00:00.000Z';

export function seg(p: Partial<Segment> & Pick<Segment, 'startDate'>): Segment {
  return {
    id: 's-' + p.startDate,
    memberId: 'm1',
    endDate: null,
    createdAt: TS,
    updatedAt: TS,
    deleted: false,
    ...p,
  };
}

export function pay(p: Partial<Membership> & Pick<Membership, 'periodStart' | 'periodEnd'>): Membership {
  return {
    id: 'p-' + p.periodStart,
    memberId: 'm1',
    months: 1,
    amount: 3000,
    paidAt: p.periodStart,
    note: null,
    createdAt: TS,
    updatedAt: TS,
    deleted: false,
    ...p,
  };
}

export function member(p: Partial<Member> = {}): Member {
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
