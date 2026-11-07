import { MD3DarkTheme, useTheme, type MD3Theme } from 'react-native-paper';
import type { MemberStatusKind } from '@/domain/types';

export const colors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceHigh: '#262626',
  onPrimary: '#FFFFFF',
  text: '#F5F5F5',
  textMuted: '#A0A0A0',
  outline: '#3A3A3A',
  paid: '#43A047',
  owes: '#E53935',
  soon: '#FFB300',
  expired: '#757575',
};

/** Accent colors the user can pick in Podešavanja. All work with white text. */
export const ACCENTS = {
  red: '#E53935',
  blue: '#1E88E5',
  indigo: '#3949AB',
  purple: '#8E24AA',
  pink: '#D81B60',
  orange: '#F4511E',
  teal: '#00897B',
} as const;
export type AccentKey = keyof typeof ACCENTS;
export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[];
export const DEFAULT_ACCENT: AccentKey = 'red';
export const isAccentKey = (k: unknown): k is AccentKey => typeof k === 'string' && k in ACCENTS;

/** Blends two `#RRGGBB` colors; `amount` 0 = a, 1 = b. */
export function mix(a: string, b: string, amount: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * amount));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function makeTheme(accent: string): MD3Theme {
  return {
    ...MD3DarkTheme,
    roundness: 4,
    colors: {
      ...MD3DarkTheme.colors,
      primary: accent,
      onPrimary: colors.onPrimary,
      primaryContainer: mix(accent, colors.background, 0.65),
      onPrimaryContainer: mix(accent, '#FFFFFF', 0.8),
      secondary: mix(accent, '#FFFFFF', 0.45),
      secondaryContainer: mix(accent, colors.background, 0.78),
      onSecondaryContainer: mix(accent, '#FFFFFF', 0.8),
      background: colors.background,
      surface: colors.surface,
      surfaceVariant: colors.surfaceHigh,
      onSurface: colors.text,
      onSurfaceVariant: colors.textMuted,
      outline: colors.outline,
      elevation: {
        ...MD3DarkTheme.colors.elevation,
        level1: colors.surface,
        level2: colors.surfaceHigh,
        level3: '#2C2C2C',
      },
    },
  };
}

/** The current accent color (follows the user's choice). */
export function useAccent(): string {
  return useTheme().colors.primary;
}

export const statusColor: Record<MemberStatusKind, string> = {
  placeno: colors.paid,
  duguje: colors.owes,
  istice_uskoro: colors.soon,
  isteklo: colors.expired,
  bez_clanarine: colors.expired,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
