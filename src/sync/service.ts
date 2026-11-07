import { countPending, sqliteSyncStore } from '@/db/repo';
import { getMeta } from '@/db/database';
import { t } from '@/i18n/sr';
import { useSyncStore } from '@/state/store';
import { appsScriptTransport } from './client';
import { runSync, SyncError } from './engine';
import { isConfigured, loadSyncSettings } from './settings';

let running: Promise<void> | null = null;
let again = false;

/** Refresh pending count / last sync time in the UI store. */
export async function refreshSyncInfo() {
  const [pending, lastSyncAt, settings] = await Promise.all([
    countPending(),
    getMeta('lastSyncAt'),
    loadSyncSettings(),
  ]);
  useSyncStore.getState().set({ pending, lastSyncAt, configured: isConfigured(settings) });
}

function errorMessage(e: unknown): string {
  if (e instanceof SyncError) {
    if (e.code === 'unauthorized') return t.sync.errUnauthorized;
    if (e.code === 'network') return t.sync.errNetwork;
    if (e.code === 'not_configured') return t.sync.errNotConfigured;
    if (e.code === 'outdated') return t.sync.errOutdated;
    return `${t.sync.errServer} (${e.message})`;
  }
  return t.sync.errServer;
}

/**
 * Run a sync unless one is already running (then queue one more).
 * `silent` = automatic trigger: skip when offline or not configured.
 */
export function syncNow(opts: { silent?: boolean } = {}): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const store = useSyncStore.getState();
    const settings = await loadSyncSettings();
    if (!isConfigured(settings)) {
      store.set({ configured: false, ...(opts.silent ? {} : { phase: 'error', error: t.sync.errNotConfigured }) });
      return;
    }
    if (opts.silent && !store.online) return;

    store.set({ phase: 'syncing', error: null, configured: true });
    try {
      await runSync(sqliteSyncStore, appsScriptTransport(settings.url), settings.secret);
      useSyncStore.getState().set({ phase: 'ok' });
    } catch (e) {
      useSyncStore.getState().set({ phase: 'error', error: errorMessage(e) });
    } finally {
      await refreshSyncInfo();
    }
  })().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow({ silent: true });
    }
  });
  return running;
}

let debounce: ReturnType<typeof setTimeout> | null = null;
/** Called after local edits: sync a few seconds later if online. */
export function scheduleSync(delayMs = 3000) {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    void syncNow({ silent: true });
  }, delayMs);
}
