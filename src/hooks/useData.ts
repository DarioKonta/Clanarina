import { useEffect, useState } from 'react';
import { todayKey } from '@/domain/dates';
import { buildMonths, type MonthSlot } from '@/domain/months';
import { groupByMember, priceOf, statusFromSlots } from '@/domain/status';
import type { Attendance, Member, MemberStatus, Membership, Segment } from '@/domain/types';
import { getDefaultAmount, getMember, listAttendance, listMembers, listPayments, listSegments } from '@/db/repo';
import { useDataStore } from '@/state/store';

/** Re-runs `load` whenever data changes (local edit or sync) or `key` changes. */
function useReload<T>(load: () => Promise<T>, key: string): { data: T | undefined; loading: boolean } {
  const version = useDataStore((s) => s.version);
  const [state, setState] = useState<{ data: T | undefined; key: string | null }>({ data: undefined, key: null });

  useEffect(() => {
    let alive = true;
    load().then((data) => {
      if (alive) setState({ data, key });
    });
    return () => {
      alive = false;
    };
    // `load` is recreated each render; reload only on key/version change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  return { data: state.key === key ? state.data : undefined, loading: state.key !== key };
}

export interface MemberWithStatus {
  member: Member;
  segments: Segment[];
  payments: Membership[];
  /** Month grid (oldest first), see `buildMonths`. */
  slots: MonthSlot[];
  /** Monthly price for this member (own or club default). */
  price: number;
  status: MemberStatus;
}

function withStatus(
  member: Member,
  segments: Segment[],
  payments: Membership[],
  defaultAmount: number,
  today: string,
): MemberWithStatus {
  const price = priceOf(member, defaultAmount);
  const slots = buildMonths(segments, payments, price, today);
  return { member, segments, payments, slots, price, status: statusFromSlots(segments, slots, today) };
}

/** Distinct, non-empty group names A–Z. */
export function groupsOf(members: Member[]): string[] {
  const set = new Set(members.map((m) => m.groupName?.trim()).filter((g): g is string => !!g));
  return [...set].sort((a, b) => a.localeCompare(b, 'sr-Latn'));
}

export function useMembersWithStatus() {
  return useReload(async () => {
    const [members, segments, payments, attendance, defaultAmount] = await Promise.all([
      listMembers(),
      listSegments(),
      listPayments(),
      listAttendance(),
      getDefaultAmount(),
    ]);
    const segmentsBy = groupByMember(segments);
    const paymentsBy = groupByMember(payments);
    const today = todayKey();
    const items = members.map((m) =>
      withStatus(m, segmentsBy.get(m.id) ?? [], paymentsBy.get(m.id) ?? [], defaultAmount, today),
    );
    return { items, members, segments, payments, attendance, defaultAmount, groups: groupsOf(members) };
  }, 'all');
}

export function useMemberDetail(id: string) {
  return useReload(async () => {
    const [member, segments, payments, attendance, defaultAmount] = await Promise.all([
      getMember(id),
      listSegments(id),
      listPayments(id),
      listAttendance(),
      getDefaultAmount(),
    ]);
    return {
      member,
      detail: member ? withStatus(member, segments, payments, defaultAmount, todayKey()) : null,
      attendance: attendance.filter((a: Attendance) => a.memberId === id),
    };
  }, id);
}
