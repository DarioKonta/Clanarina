import type { Attendance, Member, Membership } from '@/domain/types';
import { runSync, selectNewer, SyncError, type SyncStore, type TableName } from './engine';
import type { SyncRequest, SyncResponse, Transport } from './protocol';
import { normalizeAttendance, normalizeMember, normalizeMembership } from './protocol';

type Row = (Member | Membership | Attendance) & { dirty: boolean };

function memoryStore(initial: { members?: Row[]; memberships?: Row[]; attendance?: Row[]; lastSyncAt?: string | null }) {
  const tables: Record<TableName, Map<string, Row>> = {
    members: new Map((initial.members ?? []).map((r) => [r.id, r])),
    memberships: new Map((initial.memberships ?? []).map((r) => [r.id, r])),
    attendance: new Map((initial.attendance ?? []).map((r) => [r.id, r])),
  };
  let lastSyncAt = initial.lastSyncAt ?? null;
  const strip = ({ dirty, ...rest }: Row) => rest;
  const store: SyncStore = {
    async getDirty() {
      return {
        members: [...tables.members.values()].filter((r) => r.dirty).map(strip) as Member[],
        memberships: [...tables.memberships.values()].filter((r) => r.dirty).map(strip) as Membership[],
        attendance: [...tables.attendance.values()].filter((r) => r.dirty).map(strip) as Attendance[],
      };
    },
    async markClean(t, rows) {
      for (const { id, updatedAt } of rows) {
        const r = tables[t].get(id);
        if (r && r.updatedAt === updatedAt) r.dirty = false;
      }
    },
    async getUpdatedAt(t, ids) {
      const m = new Map<string, string>();
      for (const id of ids) {
        const r = tables[t].get(id);
        if (r) m.set(id, r.updatedAt);
      }
      return m;
    },
    async upsertRemote(t, rows) {
      for (const r of rows) tables[t].set(r.id, { ...r, dirty: false });
    },
    async getLastSyncAt() {
      return lastSyncAt;
    },
    async setLastSyncAt(v) {
      lastSyncAt = v;
    },
  };
  return { store, tables, getLast: () => lastSyncAt };
}

const member = (id: string, updatedAt: string, extra: Partial<Member> = {}): Member => ({
  id,
  firstName: 'Ime ' + id,
  lastName: 'Prezime',
  phone: null,
  note: null,
  groupName: null,
  price: null,
  birthDate: null,
  joinedAt: null,
  active: true,
  createdAt: updatedAt,
  updatedAt,
  deleted: false,
  ...extra,
});

function fakeServer(rows: { members?: unknown[]; memberships?: unknown[]; attendance?: unknown[] } = {}, schema: number | null = 2) {
  const version = schema === null ? {} : { schema };
  const calls: SyncRequest[] = [];
  const transport: Transport = async (body): Promise<SyncResponse> => {
    calls.push(body);
    if (body.secret !== 'tajna') return { ok: false, error: 'unauthorized' };
    if (body.action === 'pull') {
      return { ok: true, serverTime: '2026-11-07T12:00:00.000Z', ...version, ...rows };
    }
    return { ok: true, serverTime: '2026-11-07T12:00:00.000Z', ...version };
  };
  return { transport, calls };
}

describe('selectNewer', () => {
  test('keeps unknown or strictly newer rows', () => {
    const local = new Map([
      ['a', '2026-11-01T00:00:00.000Z'],
      ['b', '2026-11-05T00:00:00.000Z'],
    ]);
    const remote = [
      { id: 'a', updatedAt: '2026-11-02T00:00:00.000Z' },
      { id: 'b', updatedAt: '2026-11-05T00:00:00.000Z' },
      { id: 'c', updatedAt: '2026-10-01T00:00:00.000Z' },
    ];
    expect(selectNewer(remote, local).map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe('runSync', () => {
  test('pushes dirty rows, clears dirty, then pulls and saves server time', async () => {
    const { store, tables, getLast } = memoryStore({
      members: [
        { ...member('a', '2026-11-06T10:00:00.000Z'), dirty: true },
        { ...member('b', '2026-11-01T10:00:00.000Z'), dirty: false },
      ],
      lastSyncAt: '2026-11-05T00:00:00.000Z',
    });
    const { transport, calls } = fakeServer({
      members: [member('z', '2026-11-07T09:00:00.000Z')],
    });

    const result = await runSync(store, transport, 'tajna');

    expect(calls.map((c) => c.action)).toEqual(['push', 'pull']);
    const push = calls[0] as Extract<SyncRequest, { action: 'push' }>;
    expect(push.members.map((m) => m.id)).toEqual(['a']);
    expect((push.members[0] as unknown as Row).dirty).toBeUndefined();
    expect(calls[1]).toMatchObject({ since: '2026-11-05T00:00:00.000Z' });
    expect(tables.members.get('a')!.dirty).toBe(false);
    expect(tables.members.get('z')).toBeDefined();
    expect(getLast()).toBe('2026-11-07T12:00:00.000Z');
    expect(result).toEqual({ pushed: 1, pulled: 1, serverTime: '2026-11-07T12:00:00.000Z' });
  });

  test('skips push when nothing is dirty', async () => {
    const { store } = memoryStore({});
    const { transport, calls } = fakeServer();
    await runSync(store, transport, 'tajna');
    expect(calls.map((c) => c.action)).toEqual(['pull']);
  });

  test('remote row older than local edit does not overwrite it', async () => {
    const { store, tables } = memoryStore({
      members: [{ ...member('a', '2026-11-07T11:00:00.000Z', { firstName: 'Lokalno' }), dirty: false }],
    });
    const { transport } = fakeServer({
      members: [member('a', '2026-11-07T08:00:00.000Z', { firstName: 'Staro' })],
    });
    await runSync(store, transport, 'tajna');
    expect((tables.members.get('a') as Member & { dirty: boolean }).firstName).toBe('Lokalno');
  });

  test('remote memberships get a computed periodEnd when missing', async () => {
    const { store, tables } = memoryStore({});
    const { transport } = fakeServer({
      memberships: [
        {
          id: 'x',
          memberId: 'a',
          periodStart: '2026-11-01',
          months: '1',
          amount: '3000',
          paidAt: '',
          updatedAt: '2026-11-07T09:00:00.000Z',
        },
      ],
    });
    await runSync(store, transport, 'tajna');
    expect(tables.memberships.get('x')).toMatchObject({
      periodEnd: '2026-11-30',
      amount: 3000,
      months: 1,
      paidAt: null,
      deleted: false,
    });
  });

  test('wrong secret raises unauthorized and keeps rows dirty', async () => {
    const { store, tables } = memoryStore({
      members: [{ ...member('a', '2026-11-06T10:00:00.000Z'), dirty: true }],
    });
    const { transport } = fakeServer();
    await expect(runSync(store, transport, 'pogresno')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(tables.members.get('a')!.dirty).toBe(true);
  });

  test('network failure is reported as network error', async () => {
    const { store } = memoryStore({});
    const transport: Transport = async () => {
      throw new TypeError('Network request failed');
    };
    const err = await runSync(store, transport, 'tajna').catch((e) => e);
    expect(err).toBeInstanceOf(SyncError);
    expect(err.code).toBe('network');
  });
});

describe('attendance and server version', () => {
  const att = (id: string, updatedAt: string, extra: Partial<Attendance> = {}): Attendance => ({
    id,
    memberId: 'a',
    date: '2026-11-07',
    createdAt: updatedAt,
    updatedAt,
    deleted: false,
    ...extra,
  });

  test('pushes dirty attendance and pulls remote attendance', async () => {
    const { store, tables } = memoryStore({
      attendance: [{ ...att('p1', '2026-11-07T10:00:00.000Z'), dirty: true }],
    });
    const { transport, calls } = fakeServer({
      attendance: [{ id: 'p2', memberId: 'b', date: '2026-11-06', deleted: '0', updatedAt: '2026-11-07T09:00:00.000Z' }],
    });
    const result = await runSync(store, transport, 'tajna');
    const push = calls[0] as Extract<SyncRequest, { action: 'push' }>;
    expect(push.attendance.map((a) => a.id)).toEqual(['p1']);
    expect(tables.attendance.get('p1')!.dirty).toBe(false);
    expect(tables.attendance.get('p2')).toMatchObject({ memberId: 'b', date: '2026-11-06', deleted: false });
    expect(result.pulled).toBe(1);
  });

  test('outdated script (no schema) stops sync and keeps rows dirty', async () => {
    const { store, tables } = memoryStore({
      members: [{ ...member('a', '2026-11-06T10:00:00.000Z', { groupName: 'Deca' }), dirty: true }],
    });
    const { transport } = fakeServer({}, null);
    await expect(runSync(store, transport, 'tajna')).rejects.toMatchObject({ code: 'outdated' });
    expect(tables.members.get('a')!.dirty).toBe(true);
  });

  test('outdated script is detected on pull too', async () => {
    const { store, getLast } = memoryStore({ lastSyncAt: '2026-11-01T00:00:00.000Z' });
    const { transport } = fakeServer({}, 1);
    await expect(runSync(store, transport, 'tajna')).rejects.toMatchObject({ code: 'outdated' });
    expect(getLast()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('normalize', () => {
  test('new member fields from the sheet', () => {
    expect(
      normalizeMember({
        id: 'a',
        firstName: 'Ana',
        groupName: ' Deca ',
        price: '2.500',
        birthDate: '2015-03-04',
        joinedAt: '',
        updatedAt: '2026-11-07T09:00:00.000Z',
      }),
    ).toMatchObject({ groupName: 'Deca', price: 2500, birthDate: '2015-03-04', joinedAt: null });
    expect(normalizeMember({ id: 'a', firstName: 'A', price: '', updatedAt: 'x' })).toMatchObject({ price: null });
  });

  test('attendance rows', () => {
    expect(normalizeAttendance({ id: 'p', memberId: 'a', date: '2026-11-07', updatedAt: 'x' })).toMatchObject({
      deleted: false,
      createdAt: 'x',
    });
    expect(normalizeAttendance({ id: 'p', memberId: 'a', date: '', updatedAt: 'x' })).toBeNull();
  });

  test('sheet text values become typed rows', () => {
    expect(
      normalizeMember({
        id: 'a',
        firstName: 'Ana',
        lastName: '',
        phone: '',
        active: 'TRUE',
        deleted: '0',
        updatedAt: '2026-11-07T09:00:00.000Z',
      }),
    ).toMatchObject({ phone: null, active: true, deleted: false, createdAt: '2026-11-07T09:00:00.000Z' });
    expect(normalizeMember({ firstName: 'bez id' })).toBeNull();
    expect(normalizeMembership({ id: 'x', memberId: '', periodStart: '2026-11-01', updatedAt: 'x' })).toBeNull();
  });
});
