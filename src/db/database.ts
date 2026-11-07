import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('clanarina.db');

/**
 * Ordered migrations. Never edit an existing entry — append a new one.
 * `PRAGMA user_version` tracks how many have been applied.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL DEFAULT '',
    phone TEXT,
    note TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY NOT NULL,
    memberId TEXT NOT NULL,
    periodStart TEXT NOT NULL,
    months INTEGER NOT NULL DEFAULT 1,
    periodEnd TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    paidAt TEXT,
    note TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_memberships_member ON memberships(memberId);
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );
  `,
];

export async function migrate(): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

export async function getMeta(key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string | null): Promise<void> {
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
