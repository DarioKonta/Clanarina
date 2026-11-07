import type { Member, Membership } from '@/domain/types';

/** Shapes exchanged with the Apps Script backend (`apps-script/Code.gs`). */
export type PushRequest = {
  action: 'push';
  secret: string;
  members: Member[];
  memberships: Membership[];
};
export type PullRequest = { action: 'pull'; secret: string; since: string | null };
export type PingRequest = { action: 'ping'; secret: string };
export type SyncRequest = PushRequest | PullRequest | PingRequest;

export type SyncResponse =
  | {
      ok: true;
      serverTime: string;
      members?: unknown[];
      memberships?: unknown[];
    }
  | { ok: false; error: string };

export type Transport = (body: SyncRequest) => Promise<SyncResponse>;

// Rows coming back from Google Sheets may be strings ("1", "TRUE", "") because
// the sheet is plain text and humans can edit it. Normalize defensively.

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v)).trim();
const strOrNull = (v: unknown): string | null => str(v) || null;
const num = (v: unknown, fallback: number): number => {
  const n = Number(str(v).replace(',', '.'));
  return str(v) !== '' && Number.isFinite(n) ? n : fallback;
};
const bool = (v: unknown, fallback: boolean): boolean => {
  const s = str(v).toLowerCase();
  if (s === '') return fallback;
  return s === '1' || s === 'true' || s === 'da';
};

export function normalizeMember(raw: unknown): Member | null {
  const r = raw as Record<string, unknown>;
  if (!r || !str(r.id) || !str(r.updatedAt)) return null;
  return {
    id: str(r.id),
    firstName: str(r.firstName),
    lastName: str(r.lastName),
    phone: strOrNull(r.phone),
    note: strOrNull(r.note),
    active: bool(r.active, true),
    createdAt: str(r.createdAt) || str(r.updatedAt),
    updatedAt: str(r.updatedAt),
    deleted: bool(r.deleted, false),
  };
}

export function normalizeMembership(raw: unknown): Membership | null {
  const r = raw as Record<string, unknown>;
  if (!r || !str(r.id) || !str(r.memberId) || !str(r.periodStart) || !str(r.updatedAt)) {
    return null;
  }
  return {
    id: str(r.id),
    memberId: str(r.memberId),
    periodStart: str(r.periodStart),
    months: Math.max(1, Math.round(num(r.months, 1))),
    periodEnd: str(r.periodEnd),
    amount: Math.round(num(r.amount, 0)),
    paidAt: strOrNull(r.paidAt),
    note: strOrNull(r.note),
    createdAt: str(r.createdAt) || str(r.updatedAt),
    updatedAt: str(r.updatedAt),
    deleted: bool(r.deleted, false),
  };
}
