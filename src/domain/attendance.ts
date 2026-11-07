import type { Attendance, DateKey } from './types';

const live = (list: Attendance[]) => list.filter((a) => !a.deleted);

/** Member ids marked present on `date`. */
export function presentOn(list: Attendance[], date: DateKey): Set<string> {
  return new Set(live(list).filter((a) => a.date === date).map((a) => a.memberId));
}

/** Distinct training days a member attended in a `YYYY-MM` month. */
export function countInMonth(list: Attendance[], memberId: string, month: string): number {
  return new Set(
    live(list)
      .filter((a) => a.memberId === memberId && a.date.startsWith(month))
      .map((a) => a.date),
  ).size;
}

export function lastAttended(list: Attendance[], memberId: string): DateKey | null {
  let last: DateKey | null = null;
  for (const a of live(list)) if (a.memberId === memberId && (!last || a.date > last)) last = a.date;
  return last;
}
