import { ACCENTS, isAccentKey, makeTheme, mix } from './theme';

describe('mix', () => {
  it('returns the ends at 0 and 1', () => {
    expect(mix('#E53935', '#121212', 0)).toBe('#E53935');
    expect(mix('#E53935', '#121212', 1)).toBe('#121212');
  });
  it('blends halfway', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('accent theme', () => {
  it('uses the chosen accent as primary', () => {
    expect(makeTheme(ACCENTS.blue).colors.primary).toBe(ACCENTS.blue);
  });
  it('validates stored accent keys', () => {
    expect(isAccentKey('teal')).toBe(true);
    expect(isAccentKey('green')).toBe(false);
    expect(isAccentKey(null)).toBe(false);
  });
});
