import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { colors } from './theme';

export function EmptyState({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <View style={styles.wrap}>
      <Icon source={icon} size={56} color={colors.outline} />
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {text ? (
        <Text variant="bodyMedium" style={styles.text}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, marginTop: 48 },
  title: { textAlign: 'center' },
  text: { textAlign: 'center', color: colors.textMuted },
});
