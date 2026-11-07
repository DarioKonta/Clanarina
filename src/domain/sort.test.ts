import { DEFAULT_SORT_DIR, sortMembers, validUntil, type Sortable } from './sort';
import type { Member, MemberStatus } from './types';

function item(firstName: string, lastName: string, status: MemberStatus, createdAt = '2026-01-01T00:00:00.000Z'): Sortable {
  const member: Member = {
    id: `${firstName}-${lastName}`,
    firstName,
    lastName,
    phone: null,
    note: null,
    active: true,
    createdAt,
    updatedAt: createdAt,
    deleted: false,
  };
  return { member, status };
}

const names = (xs: Sortable[]) => xs.map((x) => x.member.firstName);

const ana = item('Ana', 'Zekić', { kind: 'placeno', until: '2026-12-31' }, '2026-03-01T00:00:00.000Z');
const boris = item('Boris', 'Antić', { kind: 'duguje', debt: 3000, since: '2026-11-01', unpaidCount: 1 }, '2026-01-01T00:00:00.000Z');
const ceca = item('Ceca', 'Marić', { kind: 'istice_uskoro', until: '2026-11-09', daysLeft: 2 }, '2026-05-01T00:00:00.000Z');
const dejan = item('Dejan', 'Lazić', { kind: 'isteklo', lastEnd: '2026-10-31' }, '2026-02-01T00:00:00.000Z');
const ema = item('Ema', 'Babić', { kind: 'bez_clanarine' }, '2026-04-01T00:00:00.000Z');
const goran = item('Goran', 'Ilić', { kind: 'duguje', debt: 6000, since: '2026-10-01', unpaidCount: 2 }, '2026-06-01T00:00:00.000Z');

const all = [ana, boris, ceca, dejan, ema, goran];

describe('validUntil', () => {
  it('returns the coverage end for paid and expiring members', () => {
    expect(validUntil(ana.status)).toBe('2026-12-31');
    expect(validUntil(ceca.status)).toBe('2026-11-09');
  });
  it('returns the last end for expired members', () => {
    expect(validUntil(dejan.status)).toBe('2026-10-31');
  });
  it('returns null when there is no paid coverage to show', () => {
    expect(validUntil(boris.status)).toBeNull();
    expect(validUntil(ema.status)).toBeNull();
  });
});

describe('sortMembers', () => {
  it('does not mutate the input', () => {
    const input = [...all];
    sortMembers(input, 'name', 'desc');
    expect(input).toEqual(all);
  });

  it('sorts by first name', () => {
    expect(names(sortMembers(all, 'name', 'asc'))).toEqual(['Ana', 'Boris', 'Ceca', 'Dejan', 'Ema', 'Goran']);
    expect(names(sortMembers(all, 'name', 'desc'))).toEqual(['Goran', 'Ema', 'Dejan', 'Ceca', 'Boris', 'Ana']);
  });

  it('sorts by last name', () => {
    // Antić, Babić, Ilić, Lazić, Marić, Zekić
    expect(names(sortMembers(all, 'lastName', 'asc'))).toEqual(['Boris', 'Ema', 'Goran', 'Dejan', 'Ceca', 'Ana']);
  });

  it('sorts by status urgency, ties by name', () => {
    // duguje → ističe uskoro → isteklo → bez članarine → plaćeno
    expect(names(sortMembers(all, 'status', 'asc'))).toEqual(['Boris', 'Goran', 'Ceca', 'Dejan', 'Ema', 'Ana']);
  });

  it('sorts by valid-until date, members without a date last in both directions', () => {
    expect(names(sortMembers(all, 'validUntil', 'asc'))).toEqual(['Dejan', 'Ceca', 'Ana', 'Boris', 'Ema', 'Goran']);
    expect(names(sortMembers(all, 'validUntil', 'desc'))).toEqual(['Ana', 'Ceca', 'Dejan', 'Boris', 'Ema', 'Goran']);
  });

  it('sorts by debt, members without debt last in both directions', () => {
    expect(names(sortMembers(all, 'debt', 'desc'))).toEqual(['Goran', 'Boris', 'Ana', 'Ceca', 'Dejan', 'Ema']);
    expect(names(sortMembers(all, 'debt', 'asc'))).toEqual(['Boris', 'Goran', 'Ana', 'Ceca', 'Dejan', 'Ema']);
  });

  it('sorts by date added', () => {
    expect(names(sortMembers(all, 'newest', 'desc'))).toEqual(['Goran', 'Ceca', 'Ema', 'Ana', 'Dejan', 'Boris']);
  });

  it('has a sensible default direction per key', () => {
    expect(DEFAULT_SORT_DIR).toEqual({
      name: 'asc',
      lastName: 'asc',
      status: 'asc',
      validUntil: 'asc',
      debt: 'desc',
      newest: 'desc',
    });
  });
});
