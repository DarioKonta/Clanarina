import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Button, List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n/sr';
import { colors, useAccent } from '@/ui/theme';

const SHEETS_URL = 'https://sheets.google.com';
const CODE_URL = 'https://github.com/DarioKonta/Clanarina/blob/main/apps-script/Code.gs';

/** Step-by-step Google Sheets setup with common problems and fixes. */
export default function SyncGuideScreen() {
  const accent = useAccent();
  const { bottom } = useSafeAreaInsets();

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + bottom }]}>
      <Text variant="bodyMedium" style={styles.muted}>
        {t.guide.intro}
      </Text>

      <View style={styles.btnRow}>
        <Button mode="contained-tonal" icon="google-spreadsheet" onPress={() => Linking.openURL(SHEETS_URL)} style={{ flex: 1 }}>
          {t.guide.openSheets}
        </Button>
        <Button mode="contained-tonal" icon="code-braces" onPress={() => Linking.openURL(CODE_URL)} style={{ flex: 1 }}>
          {t.guide.openCode}
        </Button>
      </View>

      <Text variant="titleSmall" style={[styles.heading, { color: accent }]}>
        {t.guide.stepsTitle.toUpperCase()}
      </Text>
      {t.guide.steps.map((step, i) => (
        <View key={step.title} style={styles.step}>
          <View style={[styles.num, { backgroundColor: accent }]}>
            <Text style={styles.numText}>{i + 1}</Text>
          </View>
          <View style={styles.stepBody}>
            <Text variant="titleMedium">{step.title}</Text>
            <Text variant="bodyMedium" style={styles.body}>
              {step.body}
            </Text>
          </View>
        </View>
      ))}

      <Text variant="titleSmall" style={[styles.heading, { color: accent }]}>
        {t.guide.problemsTitle.toUpperCase()}
      </Text>
      <View style={styles.problems}>
        {t.guide.problems.map((p) => (
          <List.Accordion
            key={p.title}
            title={p.title}
            titleNumberOfLines={3}
            left={(props) => <List.Icon {...props} icon="alert-circle-outline" />}
            style={styles.accordion}
          >
            <Text variant="bodyMedium" style={styles.answer}>
              {p.body}
            </Text>
          </List.Accordion>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  muted: { color: colors.textMuted },
  heading: { letterSpacing: 1, marginTop: 10 },
  btnRow: { flexDirection: 'row', gap: 10 },
  step: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.surface },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  numText: { color: colors.onPrimary, fontWeight: '700' },
  stepBody: { flex: 1, gap: 4 },
  body: { color: colors.text, lineHeight: 21 },
  problems: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface },
  accordion: { backgroundColor: colors.surface },
  answer: { color: colors.text, lineHeight: 21, paddingHorizontal: 16, paddingBottom: 16, paddingLeft: 56 },
});
