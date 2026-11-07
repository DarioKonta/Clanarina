import * as SecureStore from 'expo-secure-store';

const URL_KEY = 'sync_url';
const SECRET_KEY = 'sync_secret';

export interface SyncSettings {
  url: string;
  secret: string;
}

export async function loadSyncSettings(): Promise<SyncSettings> {
  const [url, secret] = await Promise.all([
    SecureStore.getItemAsync(URL_KEY),
    SecureStore.getItemAsync(SECRET_KEY),
  ]);
  return { url: url ?? '', secret: secret ?? '' };
}

export async function saveSyncSettings(s: SyncSettings): Promise<void> {
  await SecureStore.setItemAsync(URL_KEY, s.url.trim());
  await SecureStore.setItemAsync(SECRET_KEY, s.secret.trim());
}

export const isConfigured = (s: SyncSettings) =>
  /^https:\/\/script\.google\.com\/.+\/exec$/.test(s.url) && s.secret.length > 0;
