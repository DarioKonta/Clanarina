import { useEffect, useState } from 'react';
import { todayKey } from '@/domain/dates';
import { groupByMember, memberStatus } from '@/domain/status';
import type { Attendance, Member, MemberStatus, Membership } from '@/domain/types';
import { getMember, listAttendance, listMembers, listMemberships } from '@/db/repo';
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
  memberships: Membership[];
  status: MemberStatus;
}

/** Distinct, non-empty group names A–Z. */
export function groupsOf(members: Member[]): string[] {
  const set = new Set(members.map((m) => m.groupName?.trim()).filter((g): g is string => !!g));
  return [...set].sort((a, b) => a.localeCompare(b, 'sr-Latn'));
}

export function useMembersWithStatus() {
  return useReload(async () => {
    const [members, memberships, attendance] = await Promise.all([listMembers(), listMemberships(), listAttendance()]);
    const byMember = groupByMember(memberships);
    const today = todayKey();
    const items: MemberWithStatus[] = members.map((member) => {
      const own = byMember.get(member.id) ?? [];
      return { member, memberships: own, status: memberStatus(own, today) };
    });
    return { items, members, memberships, attendance, groups: groupsOf(members) };
  }, 'all');
}

export function useMemberDetail(id: string) {
  return useReload(async () => {
    const [member, memberships, attendance] = await Promise.all([
      getMember(id),
      listMemberships(id),
      listAttendance(),
    ]);
    return {
      member,
      memberships,
      attendance: attendance.filter((a: Attendance) => a.memberId === id),
      status: memberStatus(memberships, todayKey()),
    };
  }, id);
}
