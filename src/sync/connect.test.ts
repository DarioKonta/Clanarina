import { connectOutcome, keepsSettings } from './connect';

const ok = (schema?: number) => ({ ok: true as const, serverTime: '2026-11-08T10:00:00.000Z', schema });

describe('connectOutcome', () => {
  it('is ok for a current script', () => {
    expect(connectOutcome(ok(2))).toBe('ok');
    expect(connectOutcome(ok(3))).toBe('ok');
  });

  it('is outdated for a script without or with an old schema', () => {
    expect(connectOutcome(ok())).toBe('outdated');
    expect(connectOutcome(ok(1))).toBe('outdated');
  });

  it('is offline when the request never reached the server', () => {
    expect(connectOutcome(null)).toBe('offline');
  });

  it('separates a wrong key from other server errors', () => {
    expect(connectOutcome({ ok: false, error: 'unauthorized' })).toBe('unauthorized');
    expect(connectOutcome({ ok: false, error: 'bad_response_404' })).toBe('server');
  });
});

describe('keepsSettings', () => {
  it('saves when URL and key are right, or when it could not be checked', () => {
    expect(keepsSettings('ok')).toBe(true);
    expect(keepsSettings('outdated')).toBe(true);
    expect(keepsSettings('offline')).toBe(true);
  });

  it('does not save a wrong key or URL', () => {
    expect(keepsSettings('unauthorized')).toBe(false);
    expect(keepsSettings('server')).toBe(false);
  });
});
