import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { t } from '@/i18n/sr';
import { useSyncStore } from '@/state/store';
import { colors } from './theme';

export function OfflineBanner() {
  const online = useSyncStore((s) => s.online);
  if (online) return null;
  return (
    <View style={styles.banner}>
      <Icon source="wifi-off" size={16} color={colors.soon} />
      <Text variant="labelMedium" style={{ color: colors.soon, flex: 1 }}>
        {t.sync.offlineBanner}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3A2E10',
  },
});
