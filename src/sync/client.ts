import type { SyncResponse, Transport } from './protocol';

const TIMEOUT_MS = 30_000;

/** HTTP transport to the Apps Script web app. Apps Script answers POST with a redirect that fetch follows. */
export function appsScriptTransport(url: string): Transport {
  return async (body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        // text/plain keeps Apps Script happy (it reads e.postData.contents).
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      try {
        return JSON.parse(text) as SyncResponse;
      } catch {
        // Usually an HTML error/login page: wrong URL or deployment not public.
        return { ok: false, error: `bad_response_${res.status}` };
      }
    } finally {
      clearTimeout(timer);
    }
  };
}
