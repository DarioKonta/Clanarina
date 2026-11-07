/** Calendar date in `YYYY-MM-DD` form (no time zone). */
export type DateKey = string;
/** ISO-8601 UTC timestamp, e.g. `2026-11-07T10:15:00.000Z`. */
export type IsoTimestamp = string;

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  note: string | null;
  /** Training group, e.g. "Deca" or "Odrasli". Free text, shared across phones. */
  groupName: string | null;
  /** Monthly price for this member in RSD; null = club default. */
  price: number | null;
  birthDate: DateKey | null;
  /** Date the member joined the club. */
  joinedAt: DateKey | null;
  active: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  deleted: boolean;
}

export interface Membership {
  id: string;
  memberId: string;
  periodStart: DateKey;
  months: number;
  periodEnd: DateKey;
  /** Amount in RSD (whole dinars). */
  amount: number;
  /** Date the money was received. `null` = not paid yet (delayed payment). */
  paidAt: DateKey | null;
  note: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  deleted: boolean;
}

export type MembershipStatus = 'placeno' | 'duguje' | 'predstojece';

export type MemberStatus =
  | { kind: 'duguje'; debt: number; since: DateKey; unpaidCount: number }
  | { kind: 'istice_uskoro'; until: DateKey; daysLeft: number }
  | { kind: 'placeno'; until: DateKey }
  | { kind: 'isteklo'; lastEnd: DateKey }
  | { kind: 'bez_clanarine' };

export type MemberStatusKind = MemberStatus['kind'];

/** One member present at one training day. Unchecking sets `deleted`. */
export interface Attendance {
  id: string;
  memberId: string;
  date: DateKey;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  deleted: boolean;
}
