import { MIN_SERVER_SCHEMA, type SyncResponse } from './protocol';

/** Result of the "Poveži i sačuvaj" check against the Apps Script. */
export type ConnectOutcome = 'ok' | 'outdated' | 'offline' | 'unauthorized' | 'server';

/** Classifies a ping response; `null` means the request failed before reaching the server. */
export function connectOutcome(res: SyncResponse | null): ConnectOutcome {
  if (res === null) return 'offline';
  if (!res.ok) return res.error === 'unauthorized' ? 'unauthorized' : 'server';
  return (res.schema ?? 1) < MIN_SERVER_SCHEMA ? 'outdated' : 'ok';
}

/**
 * Whether the entered URL + key should be saved. They are kept when they work (even if the script
 * still needs updating) or when there's no internet to check; a wrong key or URL is not saved.
 */
export function keepsSettings(outcome: ConnectOutcome): boolean {
  return outcome === 'ok' || outcome === 'outdated' || outcome === 'offline';
}
