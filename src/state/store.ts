import { create } from 'zustand';
import { DEFAULT_ACCENT, type AccentKey } from '@/ui/theme';

/** Bumped on every local or synced data change so screens know to reload. */
interface DataState {
  /** Any change (local edit or sync). */
  version: number;
  /** Local edits only — used to trigger an automatic sync. */
  localVersion: number;
  bump: (local: boolean) => void;
}

export const useDataStore = create<DataState>((set) => ({
  version: 0,
  localVersion: 0,
  bump: (local) =>
    set((s) => ({ version: s.version + 1, localVersion: s.localVersion + (local ? 1 : 0) })),
}));

export type SyncPhase = 'idle' | 'syncing' | 'ok' | 'error';

interface SyncState {
  phase: SyncPhase;
  online: boolean;
  lastSyncAt: string | null;
  pending: number;
  error: string | null;
  configured: boolean;
  set: (patch: Partial<Omit<SyncState, 'set'>>) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  phase: 'idle',
  online: true,
  lastSyncAt: null,
  pending: 0,
  error: null,
  configured: false,
  set: (patch) => set(patch),
}));

/** The last undoable action, shown as a snackbar with "Poništi". */
interface UndoState {
  item: { id: number; message: string; undo: () => Promise<void> | void } | null;
  offer: (message: string, undo: () => Promise<void> | void) => void;
  clear: () => void;
}

export const useUndoStore = create<UndoState>((set) => ({
  item: null,
  offer: (message, undo) => set({ item: { id: Date.now(), message, undo } }),
  clear: () => set({ item: null }),
}));

/** Shows "message · Poništi" for a few seconds. */
export const offerUndo = (message: string, undo: () => Promise<void> | void) =>
  useUndoStore.getState().offer(message, undo);

/** Look & feel chosen on this phone. */
interface UiState {
  accent: AccentKey;
  setAccent: (accent: AccentKey) => void;
}

export const useUiStore = create<UiState>((set) => ({
  accent: DEFAULT_ACCENT,
  setAccent: (accent) => set({ accent }),
}));
