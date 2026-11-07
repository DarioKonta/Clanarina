import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Chip, FAB, IconButton, Menu, Searchbar, Text } from 'react-native-paper';
import { DEFAULT_LIST_PREFS, getListPrefs, setListPrefs, type ListPrefs } from '@/db/repo';
import { todayKey } from '@/domain/dates';
import { fullName, initials, searchKey } from '@/domain/format';
import { DEFAULT_SORT_DIR, SORT_KEYS, sortMembers, type SortKey } from '@/domain/sort';
import { oldestUnpaid } from '@/domain/status';
import type { Member, Membership, MemberStatusKind } from '@/domain/types';
import { useMembersWithStatus, type MemberWithStatus } from '@/hooks/useData';
import { t } from '@/i18n/sr';
import { EmptyState } from '@/ui/EmptyState';
import { MemberTable } from '@/ui/MemberTable';
import { OfflineBanner } from '@/ui/OfflineBanner';
import { PaymentDialog } from '@/ui/PaymentDialog';
import { StatusChip } from '@/ui/StatusChip';
import { colors, statusColor, useAccent } from '@/ui/theme';

type Filter = 'all' | MemberStatusKind | 'archived';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: t.filters.all },
  { key: 'duguje', label: t.filters.owes },
  { key: 'istice_uskoro', label: t.filters.soon },
  { key: 'placeno', label: t.filters.paid },
  { key: 'isteklo', label: t.filters.expired },
  { key: 'archived', label: t.filters.archived },
];

export default function MembersScreen() {
  const { data, loading } = useMembersWithStatus();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [paying, setPaying] = useState<{ member: Member; membership: Membership } | null>(null);
  const [prefs, setPrefs] = useState<ListPrefs>(DEFAULT_LIST_PREFS);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const accent = useAccent();

  useEffect(() => {
    void getListPrefs().then(setPrefs);
  }, []);

  const updatePrefs = (patch: Partial<ListPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void setListPrefs(next);
  };

  // Same key again flips the direction; a new key starts in its natural direction.
  const onSort = (key: SortKey) =>
    updatePrefs(
      key === prefs.sortKey
        ? { sortDir: prefs.sortDir === 'asc' ? 'desc' : 'asc' }
        : { sortKey: key, sortDir: DEFAULT_SORT_DIR[key] },
    );

  const items = useMemo(() => {
    const q = searchKey(query.trim());
    const filtered = (data?.items ?? []).filter(({ member, status }) => {
      if (filter === 'archived') {
        if (member.active) return false;
      } else {
        if (!member.active) return false;
        if (filter === 'isteklo' && !(status.kind === 'isteklo' || status.kind === 'bez_clanarine')) return false;
        if (filter !== 'all' && filter !== 'isteklo' && status.kind !== filter) return false;
      }
      if (!q) return true;
      return searchKey(`${fullName(member)} ${member.phone ?? ''}`).includes(q);
    });
    return sortMembers(filtered, prefs.sortKey, prefs.sortDir);
  }, [data, query, filter, prefs.sortKey, prefs.sortDir]);

  const onQuickPay = (item: MemberWithStatus) => {
    const unpaid = oldestUnpaid(item.memberships, todayKey());
    if (unpaid) setPaying({ member: item.member, membership: unpaid });
    else router.push({ pathname: '/clanarina/nova', params: { memberId: item.member.id, paid: '1' } });
  };

  const hasMembers = (data?.members.length ?? 0) > 0;
  const openMember = (item: MemberWithStatus) =>
    router.push({ pathname: '/clan/[id]', params: { id: item.member.id } });
  const empty = loading ? undefined : hasMembers ? (
    <EmptyState icon="account-search" title={t.members.noResults} />
  ) : (
    <EmptyState icon="account-plus" title={t.members.emptyTitle} text={t.members.emptyText} />
  );

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <View style={styles.top}>
        <View style={styles.searchRow}>
          <Searchbar
            placeholder={t.members.search}
            value={query}
            onChangeText={setQuery}
            style={styles.search}
            inputStyle={{ minHeight: 0 }}
          />
          <Menu
            visible={sortMenuOpen}
            onDismiss={() => setSortMenuOpen(false)}
            anchor={
              <IconButton
                icon="sort"
                mode="contained-tonal"
                size={24}
                accessibilityLabel={t.list.sort}
                onPress={() => setSortMenuOpen(true)}
              />
            }
          >
            {SORT_KEYS.map((key) => {
              const active = prefs.sortKey === key;
              return (
                <Menu.Item
                  key={key}
                  title={t.list.sortOptions[key]}
                  titleStyle={active ? { color: accent, fontWeight: '700' } : undefined}
                  trailingIcon={active ? (prefs.sortDir === 'asc' ? 'arrow-up' : 'arrow-down') : undefined}
                  accessibilityLabel={
                    active
                      ? `${t.list.sortOptions[key]}, ${prefs.sortDir === 'asc' ? t.list.ascending : t.list.descending}`
                      : t.list.sortOptions[key]
                  }
                  onPress={() => {
                    setSortMenuOpen(false);
                    onSort(key);
                  }}
                />
              );
            })}
          </Menu>
          <IconButton
            icon={prefs.view === 'cards' ? 'table' : 'view-agenda'}
            mode="contained-tonal"
            size={24}
            accessibilityLabel={prefs.view === 'cards' ? t.list.showTable : t.list.showCards}
            onPress={() => updatePrefs({ view: prefs.view === 'cards' ? 'table' : 'cards' })}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
              showSelectedOverlay
              style={filter === f.key ? { backgroundColor: accent + '40' } : styles.chip}
            >
              {f.label}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {prefs.view === 'table' ? (
        <MemberTable
          items={items}
          sortKey={prefs.sortKey}
          sortDir={prefs.sortDir}
          onSort={onSort}
          onOpen={openMember}
          empty={empty}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.member.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <MemberCard item={item} onQuickPay={() => onQuickPay(item)} />}
          ListEmptyComponent={empty}
        />
      )}

      <FAB
        icon="plus"
        label={t.members.newMember}
        style={[styles.fab, { backgroundColor: accent }]}
        color={colors.onPrimary}
        onPress={() => router.push('/clan/uredi')}
      />

      <PaymentDialog
        member={paying?.member ?? null}
        membership={paying?.membership ?? null}
        onDismiss={() => setPaying(null)}
      />
    </View>
  );
}

function MemberCard({ item, onQuickPay }: { item: MemberWithStatus; onQuickPay: () => void }) {
  const { member, status } = item;
  const accent = statusColor[status.kind];
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/clan/[id]', params: { id: member.id } })}
      style={({ pressed }) => [styles.card, { borderLeftColor: accent }, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
    >
      <Avatar.Text
        size={44}
        label={initials(member) || '?'}
        style={{ backgroundColor: accent + '33' }}
        color={accent}
      />
      <View style={styles.cardBody}>
        <Text variant="titleMedium" numberOfLines={1}>
          {fullName(member)}
        </Text>
        <StatusChip status={status} />
      </View>
      {member.active ? (
        <Button
          mode={status.kind === 'duguje' ? 'contained' : 'contained-tonal'}
          compact
          onPress={onQuickPay}
          icon="cash"
          contentStyle={styles.payBtn}
        >
          {t.members.payQuick}
        </Button>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  search: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, height: 48 },
  chips: { gap: 8, paddingBottom: 8 },
  chip: { backgroundColor: colors.surface },
  list: { padding: 16, paddingTop: 4, paddingBottom: 96, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
  },
  cardBody: { flex: 1, gap: 6 },
  payBtn: { height: 40 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
