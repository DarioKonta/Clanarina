import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { monthOf, shiftMonth, todayKey } from '@/domain/dates';
import { formatMoney, formatMonth, formatMonthShort } from '@/domain/format';
import { collectDebts } from '@/domain/status';
import { collectedByMonth, monthSummary } from '@/domain/summary';
import { useMembersWithStatus } from '@/hooks/useData';
import { t } from '@/i18n/sr';
import { colors, useAccent } from '@/ui/theme';

const CHART_MONTHS = 6;

/** Monthly overview: money in, who paid for the month, debt, members. */
export default function OverviewScreen() {
  const { data } = useMembersWithStatus();
  const accent = useAccent();
  const current = monthOf(todayKey());
  const [month, setMonth] = useState(current);

  const { summary, chart, totalDebt, activeCount } = useMemo(() => {
    const members = data?.members ?? [];
    const memberships = data?.memberships ?? [];
    return {
      summary: monthSummary(members, memberships, month),
      // Chart ends at the later of the selected and current month so the selection is visible.
      chart: collectedByMonth(memberships, month > current ? month : current, CHART_MONTHS),
      totalDebt: collectDebts(members.filter((m) => m.active), memberships, todayKey()).total,
      activeCount: members.filter((m) => m.active).length,
    };
  }, [data, month, current]);

  const max = Math.max(1, ...chart.map((c) => c.collected));
  const paidShare = summary.dueCount ? summary.duePaidCount / summary.dueCount : 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.monthRow}>
        <IconButton icon="chevron-left" accessibilityLabel={t.overview.prevMonth} onPress={() => setMonth(shiftMonth(month, -1))} />
        <Text variant="titleLarge" style={styles.monthTitle}>
          {formatMonth(month)}
        </Text>
        <IconButton
          icon="chevron-right"
          accessibilityLabel={t.overview.nextMonth}
          disabled={month >= current}
          onPress={() => setMonth(shiftMonth(month, 1))}
        />
      </View>

      <View style={[styles.card, { borderColor: colors.paid + '66', backgroundColor: colors.paid + '1A' }]}>
        <Text variant="labelLarge" style={styles.muted}>
          {t.overview.collected}
        </Text>
        <Text variant="headlineMedium" style={styles.big}>
          {formatMoney(summary.collected)}
        </Text>
        <Text variant="bodyMedium" style={styles.muted}>
          {t.overview.payments(summary.paymentsCount)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text variant="labelLarge" style={styles.muted}>
          {t.overview.due}
        </Text>
        <View style={styles.bar}>
          <View style={{ flex: paidShare, backgroundColor: colors.paid }} />
          <View style={{ flex: 1 - paidShare, backgroundColor: summary.dueUnpaidCount ? colors.owes : colors.outline }} />
        </View>
        <View style={styles.split}>
          <Stat color={colors.paid} label={t.overview.duePaid} value={String(summary.duePaidCount)} />
          <Stat
            color={colors.owes}
            label={t.overview.dueUnpaid}
            value={summary.dueUnpaidCount ? `${summary.dueUnpaidCount} · ${formatMoney(summary.dueUnpaidTotal)}` : '0'}
          />
        </View>
      </View>

      <View style={styles.row2}>
        <View style={[styles.card, styles.half]}>
          <Text variant="labelLarge" style={styles.muted}>
            {t.overview.activeMembers}
          </Text>
          <Text variant="headlineSmall" style={styles.big}>
            {activeCount}
          </Text>
        </View>
        <View style={[styles.card, styles.half]}>
          <Text variant="labelLarge" style={styles.muted}>
            {t.overview.newMembers}
          </Text>
          <Text variant="headlineSmall" style={styles.big}>
            {summary.newMembers}
          </Text>
        </View>
      </View>

      <View style={[styles.card, { borderColor: colors.owes + '55' }]}>
        <Text variant="labelLarge" style={styles.muted}>
          {t.overview.totalDebt}
        </Text>
        <Text variant="titleLarge" style={{ color: totalDebt ? colors.owes : colors.text, fontWeight: '700' }}>
          {formatMoney(totalDebt)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text variant="labelLarge" style={styles.muted}>
          {t.overview.lastMonths}
        </Text>
        <View style={styles.chart}>
          {chart.map((c) => {
            const selected = c.month === month;
            return (
              <Pressable
                key={c.month}
                onPress={() => setMonth(c.month)}
                style={styles.chartCol}
                accessibilityRole="button"
                accessibilityLabel={`${formatMonth(c.month)}: ${formatMoney(c.collected)}`}
              >
                <Text variant="labelSmall" style={styles.muted} numberOfLines={1}>
                  {c.collected ? Math.round(c.collected / 1000) + 'k' : ''}
                </Text>
                <View style={styles.chartTrack}>
                  <View
                    style={{
                      height: `${(c.collected / max) * 100}%`,
                      backgroundColor: selected ? accent : accent + '66',
                      borderRadius: 6,
                    }}
                  />
                </View>
                <Text variant="labelMedium" style={selected ? { color: accent, fontWeight: '700' } : styles.muted}>
                  {formatMonthShort(c.month)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
        <Text variant="bodyMedium" style={styles.muted}>
          {label}
        </Text>
      </View>
      <Text variant="titleMedium">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingTop: 4, gap: 12, paddingBottom: 32 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontWeight: '700', textTransform: 'capitalize' },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
    gap: 6,
  },
  muted: { color: colors.textMuted },
  big: { color: colors.text, fontWeight: '700' },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginVertical: 6 },
  split: { flexDirection: 'row', gap: 12 },
  row2: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartTrack: { width: '100%', height: 120, justifyContent: 'flex-end' },
});
