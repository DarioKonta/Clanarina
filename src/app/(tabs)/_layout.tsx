import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n/sr';
import { SyncPill } from '@/ui/SyncPill';
import { colors, useAccent } from '@/ui/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const icon = (name: IconName) => {
  function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <MaterialCommunityIcons name={name} color={color as string} size={size} />;
  }
  return TabIcon;
};

export default function TabLayout() {
  // Edge-to-edge: leave room for Android's navigation buttons / gesture bar.
  const { bottom } = useSafeAreaInsets();
  const accent = useAccent();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontWeight: '700', fontSize: 22 },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerRight: () => <SyncPill />,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.outline,
          height: 64 + bottom,
          paddingBottom: bottom,
        },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: colors.textMuted,
        // Five tabs: slightly smaller labels so "Podešavanja" fits on narrow phones.
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.members, tabBarIcon: icon('account-group') }} />
      <Tabs.Screen name="dugovanja" options={{ title: t.tabs.debts, tabBarIcon: icon('cash-clock') }} />
      <Tabs.Screen name="prisustvo" options={{ title: t.tabs.attendance, tabBarIcon: icon('clipboard-check-outline') }} />
      <Tabs.Screen name="pregled" options={{ title: t.tabs.overview, tabBarIcon: icon('chart-bar') }} />
      <Tabs.Screen name="podesavanja" options={{ title: t.tabs.settings, tabBarIcon: icon('cog') }} />
    </Tabs>
  );
}
