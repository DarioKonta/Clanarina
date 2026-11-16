import { addDaysKey, daysBetween } from './dates';
import { buildMonths, type MonthSlot } from './months';
import type { DateKey, Member, MemberStatus, Membership, Segment } from './types';

/** A paid month ending within this many days counts as "expiring soon". */
export const EXPIRING_SOON_DAYS = 5;

/** The member's own monthly price, or the club default. */
export function priceOf(member: Pick<Member, 'price'>, defaultAmount: number): number {
  return member.price ?? defaultAmount;
}

export function oldestOwed(slots: MonthSlot[]): MonthSlot | undefined {
  return slots.find((s) => s.state === 'duguje');
}

/** What "Uplata" pays: the oldest owed month, otherwise the next upcoming one. */
export function nextToPay(slots: MonthSlot[]): MonthSlot | undefined {
  return oldestOwed(slots) ?? slots.find((s) => s.state === 'predstojece');
}

/** Status from already built month slots (see `buildMonths`). */
export function statusFromSlots(segments: Segment[], slots: MonthSlot[], today: DateKey): MemberStatus {
  const live = segments.filter((s) => !s.deleted);
  if (live.length === 0) return { kind: 'bez_clanarine' };

  const owed = slots.filter((s) => s.state === 'duguje');
  if (owed.length > 0) {
    return {
      kind: 'duguje',
      debt: owed.reduce((sum, s) => sum + s.amount, 0),
      since: owed[0].start,
      unpaidCount: owed.length,
    };
  }

  // Paid coverage: the paid month containing today, chained through directly following paid months.
  let i = slots.findIndex((s) => s.state === 'placeno' && s.start <= today && today <= s.end);
  if (i >= 0) {
    let until = slots[i].end;
    while (i + 1 < slots.length && slots[i + 1].state === 'placeno' && slots[i + 1].start === addDaysKey(until, 1)) {
      i += 1;
      until = slots[i].end;
    }
    const daysLeft = daysBetween(today, until);
    return daysLeft <= EXPIRING_SOON_DAYS ? { kind: 'istice_uskoro', until, daysLeft } : { kind: 'placeno', until };
  }

  const future = live.filter((s) => s.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  return { kind: 'pauza', resumesAt: future?.startDate ?? null };
}

export function memberStatus(
  segments: Segment[],
  payments: Membership[],
  price: number,
  today: DateKey,
): MemberStatus {
  return statusFromSlots(segments, buildMonths(segments, payments, price, today), today);
}

export interface DebtItem {
  member: Member;
  debt: number;
  since: DateKey;
  unpaidCount: number;
  daysOverdue: number;
}

export function collectDebts(
  members: Member[],
  segmentsBy: Map<string, Segment[]>,
  paymentsBy: Map<string, Membership[]>,
  defaultAmount: number,
  today: DateKey,
): { items: DebtItem[]; total: number } {
  const items: DebtItem[] = [];
  for (const member of members) {
    if (member.deleted) continue;
    const status = memberStatus(
      segmentsBy.get(member.id) ?? [],
      paymentsBy.get(member.id) ?? [],
      priceOf(member, defaultAmount),
      today,
    );
    if (status.kind !== 'duguje') continue;
    items.push({
      member,
      debt: status.debt,
      since: status.since,
      unpaidCount: status.unpaidCount,
      daysOverdue: daysBetween(status.since, today),
    });
  }
  items.sort((a, b) => a.since.localeCompare(b.since));
  return { items, total: items.reduce((s, d) => s + d.debt, 0) };
}

export function groupByMember<T extends { memberId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.memberId);
    if (list) list.push(r);
    else map.set(r.memberId, [r]);
  }
  return map;
}
