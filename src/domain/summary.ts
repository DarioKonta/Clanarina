import { shiftMonth } from './dates';
import type { MonthSlot } from './months';
import type { Member, Membership } from './types';

export interface MonthSummary {
  /** `YYYY-MM` */
  month: string;
  /** Money received in this month (by payment date), for any period. */
  collected: number;
  paymentsCount: number;
  /** Billing months that start in this month. */
  dueCount: number;
  duePaidCount: number;
  dueUnpaidCount: number;
  dueUnpaidTotal: number;
  /** Members who joined in this month (join date, else creation date). */
  newMembers: number;
}

export function monthSummary(
  members: Member[],
  slotsByMember: Map<string, MonthSlot[]>,
  payments: Membership[],
  month: string,
): MonthSummary {
  const paid = payments.filter((m) => !m.deleted && m.paidAt?.startsWith(month));
  const due = members
    .filter((m) => !m.deleted)
    .flatMap((m) => slotsByMember.get(m.id) ?? [])
    .filter((s) => s.start.startsWith(month));
  const unpaid = due.filter((s) => s.state !== 'placeno');
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
