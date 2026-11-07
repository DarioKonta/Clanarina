import { addDaysKey, daysBetween, firstOfMonth, periodEnd } from './dates';
import type { DateKey, Member, MemberStatus, Membership, MembershipStatus } from './types';

/** A paid membership ending within this many days counts as "expiring soon". */
export const EXPIRING_SOON_DAYS = 5;

const endOf = (m: Membership) => m.periodEnd || periodEnd(m.periodStart, m.months);

export function membershipStatus(m: Membership, today: DateKey): MembershipStatus {
  if (m.paidAt) return 'placeno';
  return m.periodStart <= today ? 'duguje' : 'predstojece';
}

export function memberStatus(memberships: Membership[], today: DateKey): MemberStatus {
  const live = memberships.filter((m) => !m.deleted);
  if (live.length === 0) return { kind: 'bez_clanarine' };

  const unpaid = live
    .filter((m) => membershipStatus(m, today) === 'duguje')
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  if (unpaid.length > 0) {
    return {
      kind: 'duguje',
      debt: unpaid.reduce((sum, m) => sum + m.amount, 0),
      since: unpaid[0].periodStart,
      unpaidCount: unpaid.length,
    };
  }

  // Paid coverage: walk forward from today through consecutive paid periods.
  const paid = live.filter((m) => m.paidAt);
  let cursor = today;
  let coveredUntil: DateKey | null = null;
  for (;;) {
    const next = paid.find((m) => m.periodStart <= cursor && endOf(m) >= cursor);
    if (!next) break;
    coveredUntil = endOf(next);
    cursor = addDaysKey(coveredUntil, 1);
  }

  if (coveredUntil) {
    const daysLeft = daysBetween(today, coveredUntil);
    return daysLeft <= EXPIRING_SOON_DAYS
      ? { kind: 'istice_uskoro', until: coveredUntil, daysLeft }
      : { kind: 'placeno', until: coveredUntil };
  }

  const ended = live.map(endOf).filter((e) => e < today).sort();
  if (ended.length > 0) return { kind: 'isteklo', lastEnd: ended[ended.length - 1] };
  // Only upcoming memberships exist.
  return { kind: 'bez_clanarine' };
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
  memberships: Membership[],
  today: DateKey,
): { items: DebtItem[]; total: number } {
  const byMember = groupByMember(memberships);
  const items: DebtItem[] = [];
  for (const member of members) {
    if (member.deleted) continue;
    const status = memberStatus(byMember.get(member.id) ?? [], today);
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

/**
 * Default start for a new membership: the day after the latest period if that
 * period ended recently (keeps periods continuous), otherwise the 1st of this month.
 */
export function suggestNextPeriodStart(memberships: Membership[], today: DateKey): DateKey {
  const fallback = firstOfMonth(today);
  const ends = memberships.filter((m) => !m.deleted).map(endOf).sort();
  if (ends.length === 0) return fallback;
  const next = addDaysKey(ends[ends.length - 1], 1);
  return next >= fallback ? next : fallback;
}

/** Oldest unpaid membership that has already started — the one to pay first. */
export function oldestUnpaid(memberships: Membership[], today: DateKey): Membership | undefined {
  return memberships
    .filter((m) => !m.deleted && membershipStatus(m, today) === 'duguje')
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))[0];
}

export function groupByMember(memberships: Membership[]): Map<string, Membership[]> {
  const map = new Map<string, Membership[]>();
  for (const m of memberships) {
    const list = map.get(m.memberId);
    if (list) list.push(m);
    else map.set(m.memberId, [m]);
  }
  return map;
}
