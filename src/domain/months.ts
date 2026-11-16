import { addDays, addMonths } from 'date-fns';
import { fromDateKey, periodEnd, toDateKey } from './dates';
import type { DateKey, Membership, Segment } from './types';

export type MonthState = 'placeno' | 'duguje' | 'predstojece';

/** One billing month of a member, derived from segments and payments (never stored). */
export interface MonthSlot {
  segmentId: string;
  start: DateKey;
  end: DateKey;
  state: MonthState;
  /** Paid amount, or the member's current price when unpaid. */
  amount: number;
  payment: Membership | null;
}

/** Months generated after today for open segments, so payments can be made in advance. */
export const MONTHS_AHEAD = 12;

const monthStart = (segmentStart: DateKey, k: number): DateKey => toDateKey(addMonths(fromDateKey(segmentStart), k));

/**
 * Month grid of one member, oldest first. Month k of a segment starts at segmentStart + k months
 * (anchored, so 31 Jan → 28 Feb → 31 Mar). A month belongs to a segment if it starts before the
 * pause date; a started month counts in full. A month is paid if a payment covers its start date.
 */
export function buildMonths(
  segments: Segment[],
  payments: Membership[],
  price: number,
  today: DateKey,
  ahead: number = MONTHS_AHEAD,
): MonthSlot[] {
  const paid = payments
    .filter((p) => !p.deleted && p.paidAt)
    .map((p) => ({ p, end: p.periodEnd || periodEnd(p.periodStart, p.months) }));
  const limit = toDateKey(addMonths(fromDateKey(today), ahead));
  const slots: MonthSlot[] = [];

  for (const s of segments) {
    if (s.deleted) continue;
    for (let k = 0; k < 1200; k++) {
      const start = monthStart(s.startDate, k);
      if (s.endDate !== null ? start >= s.endDate : k > 0 && start > limit) break;
      const end = toDateKey(addDays(fromDateKey(monthStart(s.startDate, k + 1)), -1));
      const hit = paid.find((x) => x.p.periodStart <= start && start <= x.end);
      slots.push({
        segmentId: s.id,
        start,
        end,
        state: hit ? 'placeno' : start <= today ? 'duguje' : 'predstojece',
        amount: hit ? hit.p.amount : price,
        payment: hit ? hit.p : null,
      });
    }
  }
  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

/** The running segment (no pause date), if any. */
export function openSegment(segments: Segment[]): Segment | undefined {
  return segments
    .filter((s) => !s.deleted && s.endDate === null)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

export type SegmentError = 'invalidRange' | 'overlap';

const FOREVER = '9999-12-31';

/** Checks a new (no id) or edited segment against the member's other segments. */
export function validateSegment(
  segments: Segment[],
  edited: { id?: string; startDate: DateKey; endDate: DateKey | null },
): SegmentError | null {
  if (edited.endDate !== null && edited.endDate <= edited.startDate) return 'invalidRange';
  const end = edited.endDate ?? FOREVER;
  for (const s of segments) {
    if (s.deleted || s.id === edited.id) continue;
    const sEnd = s.endDate ?? FOREVER;
    if (edited.startDate < sEnd && s.startDate < end) return 'overlap';
  }
  return null;
}

/** 32-bit FNV-1a with a seed. */
function fnv(text: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Deterministic, UUID-shaped id for the payment of one member's month. Two phones paying
 * the same month offline write the same row, so sync keeps one payment instead of two.
 */
export function paymentId(memberId: string, periodStart: DateKey): string {
  const key = `${memberId}|${periodStart}`;
  const hex = [1, 2, 3, 4].map((seed) => fnv(key, seed * 0x9e3779b9).toString(16).padStart(8, '0')).join('');
  const variant = '89ab'[parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
