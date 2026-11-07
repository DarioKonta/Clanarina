import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { formatDayMonth, formatMoney } from '@/domain/format';
import type { MemberStatus } from '@/domain/types';
import { t } from '@/i18n/sr';
import { statusColor } from './theme';

export function statusLabel(s: MemberStatus): string {
  switch (s.kind) {
    case 'placeno':
      return t.status.paidUntil(formatDayMonth(s.until));
    case 'duguje':
      return t.status.owes(formatMoney(s.debt));
    case 'istice_uskoro':
      return t.status.expiresIn(s.daysLeft);
    case 'isteklo':
      return t.status.expired(formatDayMonth(s.lastEnd));
    case 'bez_clanarine':
      return t.status.none;
  }
}

export function StatusChip({ status }: { status: MemberStatus }) {
  return <Pill color={statusColor[status.kind]} label={statusLabel(status)} />;
}

export function Pill({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '26', borderColor: color + '80' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="labelMedium" style={{ color }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
