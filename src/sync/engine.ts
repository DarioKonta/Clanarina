import { periodEnd } from '@/domain/dates';
import type { Member, Membership } from '@/domain/types';
import { normalizeMember, normalizeMembership, type Transport } from './protocol';

export type TableName = 'members' | 'memberships';

/** Local storage operations the engine needs (implemented over SQLite in `src/db`). */
export interface SyncStore {
  getDirty(): Promise<{ members: Member[]; memberships: Membership[] }>;
  /** Clears the dirty flag only where `updatedAt` still matches (row not edited mid-sync). */
  markClean(table: TableName, rows: { id: string; updatedAt: string }[]): Promise<void>;
  getUpdatedAt(table: TableName, ids: string[]): Promise<Map<string, string>>;
  upsertRemote(table: TableName, rows: (Member | Membership)[]): Promise<void>;
  getLastSyncAt(): Promise<string | null>;
  setLastSyncAt(value: string): Promise<void>;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  serverTime: string;
}

export class SyncError extends Error {
  constructor(
    public code: 'not_configured' | 'unauthorized' | 'network' | 'server',
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** Last-write-wins: remote rows strictly newer than local (or unknown locally). */
export function selectNewer<T extends { id: string; updatedAt: string }>(
  remote: T[],
  local: Map<string, string>,
): T[] {
  return remote.filter((r) => {
    const l = local.get(r.id);
    return l === undefined || r.updatedAt > l;
  });
}

export async function runSync(store: SyncStore, transport: Transport, secret: string): Promise<SyncResult> {
  const call: Transport = async (body) => {
    let res;
    try {
      res = await transport(body);
    } catch (e) {
      throw new SyncError('network', e instanceof Error ? e.message : String(e));
    }
    if (!res.ok) {
      throw new SyncError(res.error === 'unauthorized' ? 'unauthorized' : 'server', res.error);
    }
    return res;
  };

  // 1. Push local changes.
  const dirty = await store.getDirty();
  const pushed = dirty.members.length + dirty.memberships.length;
  if (pushed > 0) {
    await call({ action: 'push', secret, members: dirty.members, memberships: dirty.memberships });
    await store.markClean('members', dirty.members);
    await store.markClean('memberships', dirty.memberships);
  }

  // 2. Pull everything the server received since our last sync.
  const since = await store.getLastSyncAt();
  const res = await call({ action: 'pull', secret, since });
  if (!res.ok) throw new SyncError('server');

  const members = (res.members ?? []).map(normalizeMember).filter((m): m is Member => !!m);
  const memberships = (res.memberships ?? [])
    .map(normalizeMembership)
    .filter((m): m is Membership => !!m)
    // periodEnd is derived; recompute in case someone edited the start in the sheet.
    .map((m) => ({ ...m, periodEnd: periodEnd(m.periodStart, m.months) }));

  const newMembers = selectNewer(members, await store.getUpdatedAt('members', members.map((m) => m.id)));
  const newMemberships = selectNewer(
    memberships,
    await store.getUpdatedAt('memberships', memberships.map((m) => m.id)),
  );
  if (newMembers.length) await store.upsertRemote('members', newMembers);
  if (newMemberships.length) await store.upsertRemote('memberships', newMemberships);

  await store.setLastSyncAt(res.serverTime);
  return { pushed, pulled: newMembers.length + newMemberships.length, serverTime: res.serverTime };
}
