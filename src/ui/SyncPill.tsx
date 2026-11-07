import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { formatTimestamp } from '@/domain/format';
import { t } from '@/i18n/sr';
import { useSyncStore } from '@/state/store';
import { syncNow } from '@/sync/service';
import { colors } from './theme';

/** Small status pill in the header. Tap = sync now (or open settings if not set up). */
export function SyncPill() {
  const { phase, online, pending, lastSyncAt, configured } = useSyncStore();

  let label: string;
  let color = colors.textMuted;
  if (!configured) {
    label = t.sync.notConfigured;
  } else if (phase === 'syncing') {
    label = t.sync.syncing;
  } else if (!online) {
    label = pending > 0 ? `${t.sync.offline} · ${t.sync.pending(pending)}` : t.sync.offline;
    color = colors.soon;
  } else if (phase === 'error') {
    label = t.sync.error;
    color = colors.owes;
  } else if (pending > 0) {
    label = t.sync.pending(pending);
    color = colors.soon;
  } else if (lastSyncAt) {
    label = t.sync.synced(formatTimestamp(lastSyncAt));
    color = colors.paid;
  } else {
    label = t.sync.pending(0);
  }

  const onPress = () => {
    if (!configured) router.navigate('/podesavanja');
    else void syncNow();
  };

  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.pill} accessibilityRole="button">
      {phase === 'syncing' ? (
        <ActivityIndicator size={10} color={colors.textMuted} />
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text variant="labelSmall" style={{ color }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 12,
    borderRadius: 999,
    backgroundColor: colors.surfaceHigh,
    maxWidth: 220,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
