import { addDays, addMonths, differenceInCalendarDays } from 'date-fns';
import type { DateKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses `YYYY-MM-DD` as a local calendar date (midnight local time). */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

/** Last day covered by a membership: start + months − 1 day. */
export function periodEnd(start: DateKey, months: number): DateKey {
  return toDateKey(addDays(addMonths(fromDateKey(start), months), -1));
}

export function addDaysKey(key: DateKey, days: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function daysBetween(a: DateKey, b: DateKey): number {
  return differenceInCalendarDays(fromDateKey(b), fromDateKey(a));
}

export function firstOfMonth(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return toDateKey(fromDateKey(key)) === key;
}
