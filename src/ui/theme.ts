import { MD3DarkTheme, type MD3Theme } from 'react-native-paper';
import type { MemberStatusKind } from '@/domain/types';

export const colors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceHigh: '#262626',
  primary: '#E53935',
  onPrimary: '#FFFFFF',
  text: '#F5F5F5',
  textMuted: '#A0A0A0',
  outline: '#3A3A3A',
  paid: '#43A047',
  owes: '#E53935',
  soon: '#FFB300',
  expired: '#757575',
};

export const theme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    primaryContainer: '#5C1614',
    onPrimaryContainer: '#FFDAD6',
    secondary: '#FF8A80',
    secondaryContainer: '#3B2422',
    onSecondaryContainer: '#FFDAD6',
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

export const statusColor: Record<MemberStatusKind, string> = {
  placeno: colors.paid,
  duguje: colors.owes,
  istice_uskoro: colors.soon,
  isteklo: colors.expired,
  bez_clanarine: colors.expired,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
