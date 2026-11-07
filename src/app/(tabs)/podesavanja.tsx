import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Snackbar, Text, TextInput } from 'react-native-paper';
import { formatTimestamp } from '@/domain/format';
import { parseAmount } from '@/domain/validation';
import { getDefaultAmount, setDefaultAmount } from '@/db/repo';
import { t } from '@/i18n/sr';
import { useSyncStore } from '@/state/store';
import { appsScriptTransport } from '@/sync/client';
import { refreshSyncInfo, syncNow } from '@/sync/service';
import { isConfigured, loadSyncSettings, saveSyncSettings } from '@/sync/settings';
import { colors } from '@/ui/theme';

export default function SettingsScreen() {
  const { phase, lastSyncAt, pending, error } = useSyncStore();
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [amount, setAmount] = useState('');
  const [urlError, setUrlError] = useState<string>();
  const [toast, setToast] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSyncSettings().then((s) => {
      setUrl(s.url);
      setSecret(s.secret);
    });
    getDefaultAmount().then((a) => setAmount(String(a)));
  }, []);

  const save = async () => {
    const s = { url: url.trim(), secret: secret.trim() };
    if (!isConfigured(s)) {
      setUrlError(t.settings.invalidUrl);
      return;
    }
    setUrlError(undefined);
    await saveSyncSettings(s);
    const a = parseAmount(amount);
    if (a !== null) await setDefaultAmount(a);
    await refreshSyncInfo();
    setToast(t.settings.saved);
    void syncNow();
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await appsScriptTransport(url.trim())({ action: 'ping', secret: secret.trim() });
      if (res.ok) setToast(t.settings.testOk);
      else setToast(res.error === 'unauthorized' ? t.sync.errUnauthorized : `${t.sync.errServer}: ${res.error}`);
    } catch {
      setToast(t.sync.errNetwork);
    } finally {
      setTesting(false);
    }
  };

  const saveAmount = async () => {
    const a = parseAmount(amount);
    if (a !== null) await setDefaultAmount(a);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Section title={t.settings.syncSection}>
          <View style={styles.statusBox}>
            <Row label={t.settings.lastSync} value={lastSyncAt ? formatTimestamp(lastSyncAt) : t.settings.never} />
            <Row label={t.settings.pending} value={String(pending)} />
            {phase === 'error' && error ? <Text style={{ color: colors.owes }}>{error}</Text> : null}
          </View>
          <Button
            mode="contained"
            icon="sync"
            onPress={() => syncNow()}
            loading={phase === 'syncing'}
            disabled={phase === 'syncing'}
            contentStyle={styles.bigBtn}
          >
            {t.settings.syncNow}
          </Button>

          <TextInput
            mode="outlined"
            label={t.settings.url}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={!!urlError}
          />
          <HelperText type={urlError ? 'error' : 'info'}>{urlError ?? t.settings.urlHelp}</HelperText>
          <TextInput
            mode="outlined"
            label={t.settings.secret}
            value={secret}
            onChangeText={setSecret}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showSecret}
            right={<TextInput.Icon icon={showSecret ? 'eye-off' : 'eye'} onPress={() => setShowSecret((v) => !v)} />}
          />
          <View style={styles.btnRow}>
            <Button mode="outlined" onPress={test} loading={testing} disabled={testing || !url} style={{ flex: 1 }}>
              {t.settings.test}
            </Button>
            <Button mode="contained-tonal" onPress={save} style={{ flex: 1 }}>
              {t.common.save}
            </Button>
          </View>
        </Section>

        <Section title={t.settings.defaultsSection}>
          <TextInput
            mode="outlined"
            label={t.settings.defaultAmount}
            value={amount}
            onChangeText={setAmount}
            onBlur={saveAmount}
            keyboardType="number-pad"
          />
        </Section>

        <Section title={t.settings.aboutSection}>
          <Text variant="bodyMedium" style={styles.muted}>
            {t.settings.about}
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            {t.settings.version} {Constants.expoConfig?.version}
          </Text>
        </Section>
      </ScrollView>
      <Snackbar visible={!!toast} onDismiss={() => setToast(null)} duration={2500}>
        {toast}
      </Snackbar>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="titleSmall" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 48 },
  section: { gap: 10 },
  sectionTitle: { color: colors.primary, letterSpacing: 1 },
  statusBox: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: colors.textMuted },
  bigBtn: { height: 52 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
