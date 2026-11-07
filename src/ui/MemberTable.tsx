import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { formatDayMonth, formatMoney, fullName } from '@/domain/format';
import { validUntil, type SortDir, type SortKey, type Sortable } from '@/domain/sort';
import { t } from '@/i18n/sr';
import { colors, statusColor, useAccent } from './theme';

interface Props<T extends Sortable> {
  items: T[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onOpen: (item: T) => void;
  empty?: ReactElement;
}

/** Compact members table. Tapping a column header sorts by it; tapping a row opens the member. */
export function MemberTable<T extends Sortable>({ items, sortKey, sortDir, onSort, onOpen, empty }: Props<T>) {
  // "Član" sorts by first or last name, whichever is active.
  const nameKey: SortKey = sortKey === 'lastName' ? 'lastName' : 'name';

  const header = (
    <View style={[styles.row, styles.header]}>
      <HeaderCell label={t.list.colMember} k={nameKey} style={styles.colName} {...{ sortKey, sortDir, onSort }} />
      <HeaderCell label={t.list.colStatus} k="status" style={styles.colStatus} {...{ sortKey, sortDir, onSort }} />
      <HeaderCell label={t.list.colValidUntil} k="validUntil" style={styles.colDate} {...{ sortKey, sortDir, onSort }} />
      <HeaderCell label={t.list.colDebt} k="debt" style={styles.colDebt} alignEnd {...{ sortKey, sortDir, onSort }} />
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.member.id}
      ListHeaderComponent={items.length ? header : undefined}
      stickyHeaderIndices={items.length ? [0] : undefined}
      contentContainerStyle={styles.list}
      ListEmptyComponent={empty}
      renderItem={({ item, index }) => {
        const { member, status } = item;
        const color = statusColor[status.kind];
        const until = validUntil(status);
        return (
          <Pressable
            onPress={() => onOpen(item)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              index % 2 === 1 && styles.rowAlt,
              pressed && { backgroundColor: colors.surfaceHigh },
            ]}
          >
            <Text style={[styles.cell, styles.colName, styles.name]} numberOfLines={2}>
              {fullName(member)}
            </Text>
            <View style={[styles.colStatus, styles.statusCell]}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={[styles.cell, { color }]} numberOfLines={1}>
                {t.list.statusShort[status.kind]}
              </Text>
            </View>
            <Text style={[styles.cell, styles.colDate]} numberOfLines={1}>
              {until ? formatDayMonth(until) : '—'}
            </Text>
            <Text
              style={[styles.cell, styles.colDebt, styles.right, status.kind === 'duguje' && { color: colors.owes }]}
              numberOfLines={1}
            >
              {status.kind === 'duguje' ? formatMoney(status.debt) : '—'}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

function HeaderCell({
  label,
  k,
  style,
  alignEnd,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k: SortKey;
  style: object;
  alignEnd?: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === k;
  const accent = useAccent();
  return (
    <Pressable
      onPress={() => onSort(k)}
      hitSlop={8}
      accessibilityRole="button"
      style={[style, styles.headerCell, alignEnd && { justifyContent: 'flex-end' }]}
    >
      <Text style={[styles.headerText, active && { color: accent }]} numberOfLines={1}>
        {label}
      </Text>
      {active ? (
        <MaterialCommunityIcons name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'} size={14} color={accent} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 8, paddingBottom: 96 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  rowAlt: { backgroundColor: colors.surface },
  header: { minHeight: 44, backgroundColor: colors.background, borderBottomWidth: 1 },
  headerCell: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 10 },
  headerText: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  cell: { fontSize: 13, color: colors.text },
  name: { fontSize: 14, fontWeight: '600' },
  colName: { flex: 1 },
  colStatus: { width: 76 },
  colDate: { width: 60 },
  colDebt: { width: 80 },
  statusCell: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  right: { textAlign: 'right' },
});
