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

/** `YYYY-MM` month of a date key. */
export function monthOf(key: DateKey): string {
  return key.slice(0, 7);
}

/** Moves a `YYYY-MM` month by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** True on the birthday; 29 Feb birthdays count on 28 Feb in non-leap years. */
export function isBirthday(birth: DateKey | null, today: DateKey): boolean {
  if (!birth) return false;
  const md = birth.slice(5);
  if (md === today.slice(5)) return true;
  return md === '02-29' && today.slice(5) === '02-28' && !isLeap(Number(today.slice(0, 4)));
}

/** Completed years between `birth` and `today`. */
export function ageOn(birth: DateKey, today: DateKey): number {
  const years = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  return today.slice(5) >= birth.slice(5) ? years : years - 1;
}
