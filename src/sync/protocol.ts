import type { Attendance, Member, Membership } from '@/domain/types';

/** Lowest Code.gs schema this app can sync with (Code.gs returns `schema` in every response). */
export const MIN_SERVER_SCHEMA = 2;

/** Shapes exchanged with the Apps Script backend (`apps-script/Code.gs`). */
export type PushRequest = {
  action: 'push';
  secret: string;
  members: Member[];
  memberships: Membership[];
  attendance: Attendance[];
};
export type PullRequest = { action: 'pull'; secret: string; since: string | null };
export type PingRequest = { action: 'ping'; secret: string };
export type SyncRequest = PushRequest | PullRequest | PingRequest;

export type SyncResponse =
  | {
      ok: true;
      serverTime: string;
      /** Code.gs version; missing on scripts older than schema 2. */
      schema?: number;
      members?: unknown[];
      memberships?: unknown[];
      attendance?: unknown[];
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
/** Whole RSD amount typed by a human ("2.500", "2 500"); null when empty. */
const moneyOrNull = (v: unknown): number | null => {
  const n = Number(str(v).replace(/[.\s]/g, '').replace(',', '.'));
  return str(v) !== '' && Number.isFinite(n) ? Math.round(n) : null;
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
    groupName: strOrNull(r.groupName),
    price: moneyOrNull(r.price),
    birthDate: strOrNull(r.birthDate),
    joinedAt: strOrNull(r.joinedAt),
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

export function normalizeAttendance(raw: unknown): Attendance | null {
  const r = raw as Record<string, unknown>;
  if (!r || !str(r.id) || !str(r.memberId) || !str(r.date) || !str(r.updatedAt)) return null;
  return {
    id: str(r.id),
    memberId: str(r.memberId),
    date: str(r.date),
    createdAt: str(r.createdAt) || str(r.updatedAt),
    updatedAt: str(r.updatedAt),
    deleted: bool(r.deleted, false),
  };
}
