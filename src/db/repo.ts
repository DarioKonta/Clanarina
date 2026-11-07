import { randomUUID } from 'expo-crypto';
import { periodEnd } from '@/domain/dates';
import { SORT_KEYS, type SortDir, type SortKey } from '@/domain/sort';
import type { DateKey, Member, Membership } from '@/domain/types';
import { useDataStore } from '@/state/store';
import { DEFAULT_ACCENT, isAccentKey, type AccentKey } from '@/ui/theme';
import type { SyncStore, TableName } from '@/sync/engine';
import { db, getMeta, setMeta } from './database';

type MemberRow = Omit<Member, 'active' | 'deleted'> & { active: number; deleted: number; dirty: number };
type MembershipRow = Omit<Membership, 'deleted'> & { deleted: number; dirty: number };

const toMember = (r: MemberRow): Member => ({
  id: r.id,
  firstName: r.firstName,
  lastName: r.lastName,
  phone: r.phone,
  note: r.note,
  active: r.active === 1,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  deleted: r.deleted === 1,
});

const toMembership = (r: MembershipRow): Membership => ({
  id: r.id,
  memberId: r.memberId,
  periodStart: r.periodStart,
  months: r.months,
  periodEnd: r.periodEnd,
  amount: r.amount,
  paidAt: r.paidAt,
  note: r.note,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  deleted: r.deleted === 1,
});

const nowIso = () => new Date().toISOString();
/** Tell screens to reload and schedule an automatic sync. */
const changed = (local = true) => useDataStore.getState().bump(local);

// ---------- Members ----------

export async function listMembers(): Promise<Member[]> {
  const rows = await db.getAllAsync<MemberRow>(
    'SELECT * FROM members WHERE deleted = 0 ORDER BY firstName COLLATE NOCASE, lastName COLLATE NOCASE',
  );
  return rows.map(toMember);
}

export async function getMember(id: string): Promise<Member | null> {
  const row = await db.getFirstAsync<MemberRow>('SELECT * FROM members WHERE id = ?', id);
  return row ? toMember(row) : null;
}

export type MemberFields = Pick<Member, 'firstName' | 'lastName' | 'phone' | 'note'>;

export async function createMember(fields: MemberFields): Promise<string> {
  const id = randomUUID();
  const ts = nowIso();
  await db.runAsync(
    `INSERT INTO members (id, firstName, lastName, phone, note, active, createdAt, updatedAt, deleted, dirty)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, 1)`,
    id,
    fields.firstName,
    fields.lastName,
    fields.phone,
    fields.note,
    ts,
    ts,
  );
  changed();
  return id;
}

export async function updateMember(id: string, fields: Partial<MemberFields & { active: boolean; deleted: boolean }>) {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
  }
  if (sets.length === 0) return;
  await db.runAsync(
    `UPDATE members SET ${sets.join(', ')}, updatedAt = ?, dirty = 1 WHERE id = ?`,
    ...values,
    nowIso(),
    id,
  );
  changed();
}

// ---------- Memberships ----------

export async function listMemberships(memberId?: string): Promise<Membership[]> {
  const rows = memberId
    ? await db.getAllAsync<MembershipRow>(
        'SELECT * FROM memberships WHERE deleted = 0 AND memberId = ? ORDER BY periodStart DESC',
        memberId,
      )
    : await db.getAllAsync<MembershipRow>('SELECT * FROM memberships WHERE deleted = 0');
  return rows.map(toMembership);
}

export async function getMembership(id: string): Promise<Membership | null> {
  const row = await db.getFirstAsync<MembershipRow>('SELECT * FROM memberships WHERE id = ?', id);
  return row ? toMembership(row) : null;
}

export interface NewMembership {
  memberId: string;
  periodStart: DateKey;
  months: number;
  amount: number;
  paidAt: DateKey | null;
  note: string | null;
}

export async function createMembership(input: NewMembership): Promise<string> {
  const id = randomUUID();
  const ts = nowIso();
  await db.runAsync(
    `INSERT INTO memberships (id, memberId, periodStart, months, periodEnd, amount, paidAt, note, createdAt, updatedAt, deleted, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
    id,
    input.memberId,
    input.periodStart,
    input.months,
    periodEnd(input.periodStart, input.months),
    input.amount,
    input.paidAt,
    input.note,
    ts,
    ts,
  );
  changed();
  return id;
}

/** Record a (possibly late) payment. The period itself never moves. */
export async function markPaid(id: string, paidAt: DateKey, amount: number) {
  await db.runAsync(
    'UPDATE memberships SET paidAt = ?, amount = ?, updatedAt = ?, dirty = 1 WHERE id = ?',
    paidAt,
    amount,
    nowIso(),
    id,
  );
  changed();
}

export async function markUnpaid(id: string) {
  await db.runAsync('UPDATE memberships SET paidAt = NULL, updatedAt = ?, dirty = 1 WHERE id = ?', nowIso(), id);
  changed();
}

export async function deleteMembership(id: string) {
  await db.runAsync('UPDATE memberships SET deleted = 1, updatedAt = ?, dirty = 1 WHERE id = ?', nowIso(), id);
  changed();
}

// ---------- Settings & sync bookkeeping ----------

export const DEFAULT_AMOUNT = 3000;

export async function getDefaultAmount(): Promise<number> {
  const v = await getMeta('defaultAmount');
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : DEFAULT_AMOUNT;
}

export async function setDefaultAmount(amount: number) {
  await setMeta('defaultAmount', String(amount));
}

/** Accent color (local to this phone, not synced). */
export async function getAccent(): Promise<AccentKey> {
  const v = await getMeta('accent');
  return isAccentKey(v) ? v : DEFAULT_ACCENT;
}

export async function setAccent(accent: AccentKey) {
  await setMeta('accent', accent);
}

/** Members list view preferences (local to this phone, not synced). */
export interface ListPrefs {
  view: 'cards' | 'table';
  sortKey: SortKey;
  sortDir: SortDir;
}

export const DEFAULT_LIST_PREFS: ListPrefs = { view: 'cards', sortKey: 'name', sortDir: 'asc' };

export async function getListPrefs(): Promise<ListPrefs> {
  const v = await getMeta('listPrefs');
  if (!v) return DEFAULT_LIST_PREFS;
  try {
    const p = JSON.parse(v) as Partial<ListPrefs>;
    return {
      view: p.view === 'table' ? 'table' : 'cards',
      sortKey: p.sortKey && SORT_KEYS.includes(p.sortKey) ? p.sortKey : DEFAULT_LIST_PREFS.sortKey,
      sortDir: p.sortDir === 'desc' ? 'desc' : 'asc',
    };
  } catch {
    return DEFAULT_LIST_PREFS;
  }
}

export async function setListPrefs(prefs: ListPrefs) {
  await setMeta('listPrefs', JSON.stringify(prefs));
}

export async function countPending(): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT (SELECT COUNT(*) FROM members WHERE dirty = 1) + (SELECT COUNT(*) FROM memberships WHERE dirty = 1) AS n',
  );
  return row?.n ?? 0;
}

const MEMBER_COLS = ['id', 'firstName', 'lastName', 'phone', 'note', 'active', 'createdAt', 'updatedAt', 'deleted'];
const MEMBERSHIP_COLS = [
  'id', 'memberId', 'periodStart', 'months', 'periodEnd', 'amount', 'paidAt', 'note', 'createdAt', 'updatedAt', 'deleted',
];

export const sqliteSyncStore: SyncStore = {
  async getDirty() {
    const members = await db.getAllAsync<MemberRow>('SELECT * FROM members WHERE dirty = 1');
    const memberships = await db.getAllAsync<MembershipRow>('SELECT * FROM memberships WHERE dirty = 1');
    return { members: members.map(toMember), memberships: memberships.map(toMembership) };
  },

  async markClean(table: TableName, rows) {
    if (rows.length === 0) return;
    await db.withTransactionAsync(async () => {
      for (const r of rows) {
        await db.runAsync(`UPDATE ${table} SET dirty = 0 WHERE id = ? AND updatedAt = ?`, r.id, r.updatedAt);
      }
    });
  },

  async getUpdatedAt(table: TableName, ids) {
    const map = new Map<string, string>();
    // Small data set: chunk to stay under SQLite's variable limit.
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const rows = await db.getAllAsync<{ id: string; updatedAt: string }>(
        `SELECT id, updatedAt FROM ${table} WHERE id IN (${chunk.map(() => '?').join(',')})`,
        ...chunk,
      );
      for (const r of rows) map.set(r.id, r.updatedAt);
    }
    return map;
  },

  async upsertRemote(table: TableName, rows) {
    const cols = table === 'members' ? MEMBER_COLS : MEMBERSHIP_COLS;
    const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}, dirty) VALUES (${cols.map(() => '?').join(', ')}, 0)`;
    await db.withTransactionAsync(async () => {
      for (const row of rows) {
        const rec = row as unknown as Record<string, unknown>;
        const values = cols.map((c) => {
          const v = rec[c];
          return typeof v === 'boolean' ? (v ? 1 : 0) : ((v ?? null) as string | number | null);
        });
        await db.runAsync(sql, ...values);
      }
    });
    changed(false);
  },

  getLastSyncAt: () => getMeta('lastSyncAt'),
  setLastSyncAt: (v) => setMeta('lastSyncAt', v),
};
