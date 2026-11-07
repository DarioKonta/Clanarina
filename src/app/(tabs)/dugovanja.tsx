import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { todayKey } from '@/domain/dates';
import { formatDayMonth, formatMoney, fullName } from '@/domain/format';
import { collectDebts, groupByMember, oldestUnpaid } from '@/domain/status';
import type { Member, Membership } from '@/domain/types';
import { useMembersWithStatus } from '@/hooks/useData';
import { t } from '@/i18n/sr';
import { EmptyState } from '@/ui/EmptyState';
import { OfflineBanner } from '@/ui/OfflineBanner';
import { PaymentDialog } from '@/ui/PaymentDialog';
import { colors } from '@/ui/theme';

export default function DebtsScreen() {
  const { data, loading } = useMembersWithStatus();
  const [paying, setPaying] = useState<{ member: Member; membership: Membership } | null>(null);

  const { debts, byMember } = useMemo(() => {
    const members = (data?.members ?? []).filter((m) => m.active);
    const memberships = data?.memberships ?? [];
    return {
      debts: collectDebts(members, memberships, todayKey()),
      byMember: groupByMember(memberships),
    };
  }, [data]);

  const pay = (member: Member) => {
    const m = oldestUnpaid(byMember.get(member.id) ?? [], todayKey());
    if (m) setPaying({ member, membership: m });
  };

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <FlatList
        data={debts.items}
        keyExtractor={(d) => d.member.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          debts.items.length > 0 ? (
            <View style={styles.summary}>
              <Text variant="labelLarge" style={styles.muted}>
                {t.debts.totalLabel}
              </Text>
              <Text variant="headlineMedium" style={styles.total}>
                {formatMoney(debts.total)}
              </Text>
              <Text variant="bodyMedium" style={styles.muted}>
                {t.debts.count(debts.items.length)}
              </Text>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push({ pathname: '/clan/[id]', params: { id: item.member.id } })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="titleMedium" numberOfLines={1}>
                {fullName(item.member)}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                {t.debts.since(formatDayMonth(item.since), item.daysOverdue)}
                {t.debts.unpaidCount(item.unpaidCount)}
              </Text>
            </View>
            <Text variant="titleMedium" style={{ color: colors.owes }}>
              {formatMoney(item.debt)}
            </Text>
            <Button mode="contained" compact icon="cash" onPress={() => pay(item.member)}>
              {t.members.payQuick}
            </Button>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? undefined : <EmptyState icon="check-decagram" title={t.debts.emptyTitle} text={t.debts.emptyText} />
        }
      />
      <PaymentDialog
        member={paying?.member ?? null}
        membership={paying?.membership ?? null}
        onDismiss={() => setPaying(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  summary: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.owes + '22',
    borderWidth: 1,
    borderColor: colors.owes + '55',
    marginBottom: 6,
    gap: 2,
  },
  total: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
});
