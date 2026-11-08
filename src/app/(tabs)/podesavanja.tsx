import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Snackbar, Text, TextInput } from 'react-native-paper';
import { formatTimestamp } from '@/domain/format';
import { parseAmount } from '@/domain/validation';
import { getDefaultAmount, setAccent, setDefaultAmount } from '@/db/repo';
import { t } from '@/i18n/sr';
import { useSyncStore, useUiStore } from '@/state/store';
import { appsScriptTransport } from '@/sync/client';
import { connectOutcome, keepsSettings } from '@/sync/connect';
import type { SyncResponse } from '@/sync/protocol';
import { refreshSyncInfo, syncNow } from '@/sync/service';
import { exportToExcel } from '@/ui/exportExcel';
import { isConfigured, loadSyncSettings, saveSyncSettings } from '@/sync/settings';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ACCENT_KEYS, ACCENTS, colors, useAccent, type AccentKey } from '@/ui/theme';

export default function SettingsScreen() {
  const { phase, lastSyncAt, pending, error } = useSyncStore();
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [amount, setAmount] = useState('');
  const [urlError, setUrlError] = useState<string>();
  const [toast, setToast] = useState<string | null>(null);
  const [saved, setSaved] = useState({ url: '', secret: '' });
  const [connecting, setConnecting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadSyncSettings().then((s) => {
      setUrl(s.url);
      setSecret(s.secret);
      setSaved({ url: s.url.trim(), secret: s.secret.trim() });
    });
    getDefaultAmount().then((a) => setAmount(String(a)));
  }, []);

  const unsaved = url.trim() !== saved.url || secret.trim() !== saved.secret;

  /** One step: check the URL + key against the script, save them if they work, then sync. */
  const connect = async () => {
    const s = { url: url.trim(), secret: secret.trim() };
    if (!isConfigured(s)) {
      setUrlError(t.settings.invalidUrl);
      return;
    }
    setUrlError(undefined);
    setConnecting(true);
    try {
      let res: SyncResponse | null;
      try {
        res = await appsScriptTransport(s.url)({ action: 'ping', secret: s.secret });
      } catch {
        res = null;
      }
      const outcome = connectOutcome(res);
      if (keepsSettings(outcome)) {
        await saveSyncSettings(s);
        setSaved(s);
        await refreshSyncInfo();
        if (outcome === 'ok') void syncNow();
      }
      setToast(
        outcome === 'ok'
          ? t.settings.connectOk
          : outcome === 'outdated'
            ? t.settings.connectOutdated
            : outcome === 'offline'
              ? t.settings.connectOffline
              : outcome === 'unauthorized'
                ? t.settings.connectUnauthorized
                : t.settings.connectServer(res && !res.ok ? res.error : '?'),
      );
    } finally {
      setConnecting(false);
    }
  };

  const runExport = async () => {
    setExporting(true);
    try {
      await exportToExcel();
    } catch {
      setToast(t.export.failed);
    } finally {
      setExporting(false);
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
          <Button mode="text" icon="help-circle-outline" onPress={() => router.push('/uputstvo')} style={styles.guideBtn}>
            {t.guide.open}
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
          {unsaved ? <HelperText type="error">{t.settings.unsaved}</HelperText> : null}
          <Button
            mode={unsaved ? 'contained' : 'contained-tonal'}
            icon="link-variant"
            onPress={connect}
            loading={connecting}
            disabled={connecting || !url.trim()}
            contentStyle={styles.bigBtn}
          >
            {t.settings.connect}
          </Button>

          <View style={styles.syncGap} />
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

        <Section title={t.export.button}>
          <Text variant="bodyMedium" style={styles.muted}>
            {t.export.hint}
          </Text>
          <Button
            mode="contained-tonal"
            icon="microsoft-excel"
            onPress={runExport}
            loading={exporting}
            disabled={exporting}
            contentStyle={styles.bigBtn}
          >
            {t.export.button}
          </Button>
        </Section>

        <Section title={t.settings.appearanceSection}>
          <AccentPicker />
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

function AccentPicker() {
  const current = useUiStore((s) => s.accent);
  const pick = (key: AccentKey) => {
    useUiStore.getState().setAccent(key);
    void setAccent(key);
  };
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.muted}>{t.settings.accent}</Text>
      <View style={styles.swatches}>
        {ACCENT_KEYS.map((key) => {
          const selected = key === current;
          return (
            <Pressable
              key={key}
              onPress={() => pick(key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t.settings.accentNames[key]}
              style={[styles.swatch, { backgroundColor: ACCENTS[key] }, selected && styles.swatchSelected]}
            >
              {selected ? <MaterialCommunityIcons name="check" size={26} color={colors.onPrimary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const accent = useAccent();
  return (
    <View style={styles.section}>
      <Text variant="titleSmall" style={[styles.sectionTitle, { color: accent }]}>
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
  sectionTitle: { letterSpacing: 1 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderWidth: 3, borderColor: colors.text },
  syncGap: { height: 12 },
  statusBox: { padding: 14, borderRadius: 16, backgroundColor: colors.surface, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: colors.textMuted },
  bigBtn: { height: 52 },
  guideBtn: { alignSelf: 'flex-start', marginLeft: -8 },
});
