import { shiftMonth } from './dates';
import type { Member, Membership } from './types';

export interface MonthSummary {
  /** `YYYY-MM` */
  month: string;
  /** Money received in this month (by payment date), for any period. */
  collected: number;
  paymentsCount: number;
  /** Memberships whose period starts in this month. */
  dueCount: number;
  duePaidCount: number;
  dueUnpaidCount: number;
  dueUnpaidTotal: number;
  /** Members who joined in this month (join date, else creation date). */
  newMembers: number;
}

export function monthSummary(members: Member[], memberships: Membership[], month: string): MonthSummary {
  const live = memberships.filter((m) => !m.deleted);
  const paid = live.filter((m) => m.paidAt?.startsWith(month));
  const due = live.filter((m) => m.periodStart.startsWith(month));
  const unpaid = due.filter((m) => !m.paidAt);
  return {
    month,
    collected: paid.reduce((s, m) => s + m.amount, 0),
    paymentsCount: paid.length,
    dueCount: due.length,
    duePaidCount: due.length - unpaid.length,
    dueUnpaidCount: unpaid.length,
    dueUnpaidTotal: unpaid.reduce((s, m) => s + m.amount, 0),
    newMembers: members.filter(
      (m) => !m.deleted && (m.joinedAt ?? m.createdAt.slice(0, 10)).startsWith(month),
    ).length,
  };
}

/** Money received per month for the `n` months ending with `lastMonth`, oldest first. */
export function collectedByMonth(
  memberships: Membership[],
  lastMonth: string,
  n: number,
): { month: string; collected: number }[] {
  const months = Array.from({ length: n }, (_, i) => shiftMonth(lastMonth, i - n + 1));
  return months.map((month) => ({
    month,
    collected: memberships
      .filter((m) => !m.deleted && m.paidAt?.startsWith(month))
      .reduce((s, m) => s + m.amount, 0),
  }));
}
