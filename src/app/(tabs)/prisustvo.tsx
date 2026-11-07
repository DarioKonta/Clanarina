import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, IconButton, Text } from 'react-native-paper';
import { presentOn } from '@/domain/attendance';
import { addDaysKey, fromDateKey, toDateKey, todayKey } from '@/domain/dates';
import { formatDate, fullName } from '@/domain/format';
import { setPresent } from '@/db/repo';
import { useMembersWithStatus } from '@/hooks/useData';
import { t } from '@/i18n/sr';
import { EmptyState } from '@/ui/EmptyState';
import { OfflineBanner } from '@/ui/OfflineBanner';
import { colors, useAccent } from '@/ui/theme';

/** Training attendance: pick a day, tap members to mark them present. */
export default function AttendanceScreen() {
  const { data, loading } = useMembersWithStatus();
  const accent = useAccent();
  const [date, setDate] = useState(todayKey);
  const [group, setGroup] = useState<string | null>(null);

  const members = useMemo(
    () =>
      (data?.members ?? [])
        .filter((m) => m.active && (!group || m.groupName?.trim() === group))
        .sort((a, b) => fullName(a).localeCompare(fullName(b), 'sr-Latn')),
    [data, group],
  );
  const present = useMemo(() => presentOn(data?.attendance ?? [], date), [data, date]);
  const presentCount = members.filter((m) => present.has(m.id)).length;
  const groups = data?.groups ?? [];
  const isToday = date === todayKey();

  const pickDate = () =>
    DateTimePickerAndroid.open({
      value: fromDateKey(date),
      mode: 'date',
      firstDayOfWeek: 1,
      onValueChange: (_e, d) => setDate(toDateKey(d)),
    });

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <View style={styles.top}>
        <View style={styles.dateRow}>
          <IconButton icon="chevron-left" onPress={() => setDate(addDaysKey(date, -1))} />
          <Pressable onPress={pickDate} style={styles.dateBtn} accessibilityRole="button" accessibilityLabel={t.attendance.date}>
            <MaterialCommunityIcons name="calendar" size={20} color={accent} />
            <Text variant="titleMedium">{formatDate(date)}</Text>
          </Pressable>
          <IconButton icon="chevron-right" disabled={isToday} onPress={() => setDate(addDaysKey(date, 1))} />
        </View>
        {groups.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {[null, ...groups].map((g) => (
              <Chip
                key={g ?? '*'}
                compact
                selected={group === g}
                onPress={() => setGroup(g)}
                showSelectedOverlay
                style={group === g ? { backgroundColor: accent + '40' } : styles.chip}
              >
                {g ?? t.memberFields.allGroups}
              </Chip>
            ))}
          </ScrollView>
        ) : null}
        {members.length > 0 ? (
          <Text variant="labelLarge" style={{ color: colors.textMuted }}>
            {t.attendance.present(presentCount, members.length)}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const on = present.has(item.id);
          return (
            <Pressable
              onPress={() => void setPresent(item.id, date, !on)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [
                styles.row,
                on && { borderColor: accent, backgroundColor: accent + '1F' },
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialCommunityIcons
                name={on ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                size={28}
                color={on ? accent : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium" numberOfLines={1}>
                  {fullName(item)}
                </Text>
                {item.groupName && !group ? (
                  <Text variant="bodySmall" style={{ color: colors.textMuted }}>
                    {item.groupName}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? undefined : <EmptyState icon="account-off" title={t.attendance.empty} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chips: { gap: 8 },
  chip: { backgroundColor: colors.surface },
  list: { padding: 16, paddingTop: 8, gap: 8, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
