import { fullName } from './format';
import type { DateKey, Member, MemberStatus, MemberStatusKind } from './types';

export type SortKey = 'name' | 'lastName' | 'status' | 'validUntil' | 'debt' | 'newest';
export type SortDir = 'asc' | 'desc';
export const SORT_KEYS: SortKey[] = ['name', 'lastName', 'status', 'validUntil', 'debt', 'newest'];

/** Direction a key starts in when first picked. */
export const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  lastName: 'asc',
  status: 'asc',
  validUntil: 'asc',
  debt: 'desc',
  newest: 'desc',
};

export interface Sortable {
  member: Member;
  status: MemberStatus;
}

/** Most urgent first. */
const STATUS_RANK: Record<MemberStatusKind, number> = {
  duguje: 0,
  istice_uskoro: 1,
  isteklo: 2,
  bez_clanarine: 3,
  placeno: 4,
};

/** Last day of paid coverage (or when it ended); null if there's nothing to show. */
export function validUntil(s: MemberStatus): DateKey | null {
  switch (s.kind) {
    case 'placeno':
    case 'istice_uskoro':
      return s.until;
    case 'isteklo':
      return s.lastEnd;
    default:
      return null;
  }
}

const debtOf = (s: MemberStatus): number | null => (s.kind === 'duguje' ? s.debt : null);

const collator = new Intl.Collator('sr-Latn', { sensitivity: 'base' });
const byName = (a: Sortable, b: Sortable) => collator.compare(fullName(a.member), fullName(b.member));
const byLastName = (a: Sortable, b: Sortable) =>
  collator.compare(a.member.lastName, b.member.lastName) || collator.compare(a.member.firstName, b.member.firstName);

/** Compares values that may be missing; missing ones always go last regardless of direction. */
function compareOptional<T>(a: T | null, b: T | null, dir: SortDir, cmp: (x: T, y: T) => number): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === 'asc' ? cmp(a, b) : -cmp(a, b);
}

const num = (x: number, y: number) => x - y;
const str = (x: string, y: string) => x.localeCompare(y);

/** Returns a new sorted array. Ties are always broken by name A–Z. */
export function sortMembers<T extends Sortable>(items: readonly T[], key: SortKey, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  const primary = (a: T, b: T): number => {
    switch (key) {
      case 'name':
        return sign * byName(a, b);
      case 'lastName':
        return sign * byLastName(a, b);
      case 'status':
        return sign * (STATUS_RANK[a.status.kind] - STATUS_RANK[b.status.kind]);
      case 'validUntil':
        return compareOptional(validUntil(a.status), validUntil(b.status), dir, str);
      case 'debt':
        return compareOptional(debtOf(a.status), debtOf(b.status), dir, num);
      case 'newest':
        return sign * str(a.member.createdAt, b.member.createdAt);
    }
  };
  return [...items].sort((a, b) => primary(a, b) || byName(a, b));
}
