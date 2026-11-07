import NetInfo from '@react-native-community/netinfo';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { AppState, View } from 'react-native';
import { ActivityIndicator, PaperProvider, Text } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrate } from '@/db/database';
import { getAccent } from '@/db/repo';
import { t } from '@/i18n/sr';
import { useDataStore, useSyncStore, useUiStore } from '@/state/store';
import { refreshSyncInfo, scheduleSync, syncNow } from '@/sync/service';
import { ACCENTS, colors, makeTheme } from '@/ui/theme';
import { UndoSnackbar } from '@/ui/UndoSnackbar';

function useSyncTriggers(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    void refreshSyncInfo().then(() => syncNow({ silent: true }));

    // Back online → sync.
    let wasOnline = true;
    const unsubNet = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      useSyncStore.getState().set({ online });
      if (online && !wasOnline) void syncNow({ silent: true });
      wasOnline = online;
    });

    // App returns to foreground → sync.
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow({ silent: true });
    });

    // Local edit → update pending count, sync shortly after.
    const unsubData = useDataStore.subscribe((s, prev) => {
      if (s.localVersion !== prev.localVersion) {
        void refreshSyncInfo();
        scheduleSync();
      }
    });

    return () => {
      unsubNet();
      appSub.remove();
      unsubData();
    };
  }, [ready]);
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    migrate()
      .then(getAccent)
      .then((accent) => {
        useUiStore.getState().setAccent(accent);
        setReady(true);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useSyncTriggers(ready);
  const accent = useUiStore((s) => s.accent);
  const theme = useMemo(() => makeTheme(ACCENTS[accent]), [accent]);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="light" />
        {!ready ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
            {error ? <Text>{`${t.common.error}: ${error}`}</Text> : <ActivityIndicator />}
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="clan/[id]" options={{ title: '' }} />
            <Stack.Screen name="clan/uredi" options={{ title: t.members.newMember, presentation: 'modal' }} />
            <Stack.Screen name="clanarina/nova" options={{ title: t.membership.title, presentation: 'modal' }} />
            <Stack.Screen name="uputstvo" options={{ title: t.guide.title }} />
          </Stack>
        )}
        <UndoSnackbar />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
