import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, IconButton, Menu, Text } from 'react-native-paper';
import { countInMonth, lastAttended } from '@/domain/attendance';
import { ageOn, isBirthday, monthOf, todayKey } from '@/domain/dates';
import { formatDate, formatMoney, formatPeriod, fullName, initials } from '@/domain/format';
import { membershipStatus } from '@/domain/status';
import type { Membership } from '@/domain/types';
import { deleteMember, deleteMembership, restoreMember, restoreMembership, setPayment, updateMember } from '@/db/repo';
import { useMemberDetail } from '@/hooks/useData';
import { t } from '@/i18n/sr';
import { offerUndo } from '@/state/store';
import { EmptyState } from '@/ui/EmptyState';
import { PaymentDialog } from '@/ui/PaymentDialog';
import { ReminderButton } from '@/ui/ReminderButton';
import { Pill, StatusChip } from '@/ui/StatusChip';
import { colors, statusColor } from '@/ui/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
interface Detail {
  icon: IconName;
  text: string;
}

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useMemberDetail(id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paying, setPaying] = useState<Membership | null>(null);

  if (loading) return null;
  const member = data?.member;
  if (!member || member.deleted) return <EmptyState icon="account-question" title={t.members.notFound} />;
  const { memberships, status, attendance } = data;
  const accent = statusColor[status.kind];
  const today = todayKey();
  const birthday = isBirthday(member.birthDate, today);
  const last = lastAttended(attendance, member.id);
  const details: Detail[] = ([
    member.groupName ? { icon: 'account-group', text: member.groupName } : null,
    member.price !== null ? { icon: 'cash', text: t.memberFields.ownPrice(formatMoney(member.price)) } : null,
    member.birthDate
      ? { icon: 'cake-variant', text: `${formatDate(member.birthDate)} · ${t.memberFields.age(ageOn(member.birthDate, today))}` }
      : null,
    member.joinedAt ? { icon: 'calendar-start', text: t.memberFields.memberSince(formatDate(member.joinedAt)) } : null,
    {
      icon: 'dumbbell',
      text: `${t.attendance.thisMonth(countInMonth(attendance, member.id, monthOf(today)))} · ${
        last ? t.attendance.last(formatDate(last)) : t.attendance.never
      }`,
    },
  ] as (Detail | null)[]).filter((d): d is Detail => !!d);

  const confirmDelete = () =>
    Alert.alert(t.members.deleteConfirmTitle, t.members.deleteConfirmText, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          const ids = await deleteMember(member.id);
          offerUndo(t.undo.memberDeleted, () => restoreMember(member.id, ids));
          router.back();
        },
      },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Menu
              visible={menuOpen}
              onDismiss={() => setMenuOpen(false)}
              anchor={<IconButton icon="dots-vertical" onPress={() => setMenuOpen(true)} />}
            >
              <Menu.Item
                leadingIcon="pencil"
                title={t.common.edit}
                onPress={() => {
                  setMenuOpen(false);
                  router.push({ pathname: '/clan/uredi', params: { id: member.id } });
                }}
              />
              <Menu.Item
                leadingIcon={member.active ? 'archive' : 'archive-arrow-up'}
                title={member.active ? t.members.archive : t.members.unarchive}
                onPress={() => {
                  setMenuOpen(false);
                  const wasActive = member.active;
                  void updateMember(member.id, { active: !wasActive });
                  offerUndo(wasActive ? t.undo.archived : t.undo.unarchived, () =>
                    updateMember(member.id, { active: wasActive }),
                  );
                }}
              />
              <Menu.Item
                leadingIcon="delete"
                title={t.common.delete}
                onPress={() => {
                  setMenuOpen(false);
                  confirmDelete();
                }}
              />
            </Menu>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.header, { borderColor: accent + '66' }]}>
          <Avatar.Text size={64} label={initials(member) || '?'} style={{ backgroundColor: accent + '33' }} color={accent} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
              {fullName(member)}
            </Text>
            <StatusChip status={status} />
            {!member.active ? <Pill color={colors.expired} label={t.members.archived} /> : null}
          </View>
        </View>

        {birthday ? (
          <View style={styles.birthday}>
            <Text variant="titleMedium">{t.memberFields.birthdayToday}</Text>
          </View>
        ) : null}

        <View style={styles.details}>
          {details.map((d) => (
            <View key={d.icon} style={styles.detailRow}>
              <MaterialCommunityIcons name={d.icon} size={18} color={colors.textMuted} />
              <Text variant="bodyMedium" style={{ flex: 1 }}>
                {d.text}
              </Text>
            </View>
          ))}
        </View>

        {status.kind === 'duguje' ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <ReminderButton member={member} status={status} />
            {!member.phone ? (
              <Text variant="bodySmall" style={[styles.muted, { marginTop: 4 }]}>
                {t.reminder.noPhone}
              </Text>
            ) : null}
          </View>
        ) : null}

        {member.phone || member.note ? (
          <View style={styles.info}>
            {member.phone ? (
              <Button
                icon="phone"
                mode="text"
                onPress={() => Linking.openURL(`tel:${member.phone}`)}
                style={{ alignSelf: 'flex-start' }}
              >
                {member.phone}
              </Button>
            ) : null}
            {member.note ? <Text style={styles.muted}>{member.note}</Text> : null}
          </View>
        ) : null}

        <Button
          mode="contained"
          icon="plus"
          contentStyle={styles.bigBtn}
          onPress={() => router.push({ pathname: '/clanarina/nova', params: { memberId: member.id } })}
        >
          {t.member.newMembership}
        </Button>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t.member.history}
        </Text>
        {memberships.length === 0 ? (
          <Text style={styles.muted}>{t.member.noHistory}</Text>
        ) : (
          memberships.map((m) => <MembershipRow key={m.id} m={m} onPay={() => setPaying(m)} />)
        )}
      </ScrollView>

      <PaymentDialog member={member} membership={paying} onDismiss={() => setPaying(null)} />
    </View>
  );
}

function MembershipRow({ m, onPay }: { m: Membership; onPay: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const s = membershipStatus(m, todayKey());
  const color = s === 'placeno' ? colors.paid : s === 'duguje' ? colors.owes : colors.textMuted;
  const label = s === 'placeno' ? t.status.paid : s === 'duguje' ? t.status.unpaid : t.status.upcoming;

  return (
    <View style={[styles.row, { borderLeftColor: color }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="titleSmall">{formatPeriod(m.periodStart, m.periodEnd)}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          {t.membership.months(m.months)} · {formatMoney(m.amount)}
        </Text>
        {m.paidAt ? (
          <Text variant="bodySmall" style={styles.muted}>
            {t.member.paidOn(formatDate(m.paidAt))}
          </Text>
        ) : null}
        {m.note ? (
          <Text variant="bodySmall" style={styles.muted}>
            {m.note}
          </Text>
        ) : null}
        <Pill color={color} label={label} />
      </View>
      {!m.paidAt ? (
        <Button mode="contained" compact onPress={onPay}>
          {t.member.recordPayment}
        </Button>
      ) : null}
      <Menu
        visible={menuOpen}
        onDismiss={() => setMenuOpen(false)}
        anchor={<IconButton icon="dots-vertical" size={20} onPress={() => setMenuOpen(true)} />}
      >
        {m.paidAt ? (
          <Menu.Item
            leadingIcon="cash-remove"
            title={t.member.undoPayment}
            onPress={() => {
              setMenuOpen(false);
              const { id, paidAt, amount } = m;
              void setPayment(id, null, amount);
              offerUndo(t.undo.unpaid, () => setPayment(id, paidAt, amount));
            }}
          />
        ) : null}
        <Menu.Item
          leadingIcon="delete"
          title={t.member.deleteMembership}
          onPress={() => {
            setMenuOpen(false);
            Alert.alert(t.member.deleteMembershipConfirm, formatPeriod(m.periodStart, m.periodEnd), [
              { text: t.common.cancel, style: 'cancel' },
              {
                text: t.common.delete,
                style: 'destructive',
                onPress: () => {
                  void deleteMembership(m.id);
                  offerUndo(t.undo.membershipDeleted, () => restoreMembership(m.id));
                },
              },
            ]);
          }}
        />
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
  },
  info: { gap: 4 },
  details: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.surface },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  birthday: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.soon + '22',
    borderWidth: 1,
    borderColor: colors.soon + '66',
  },
  muted: { color: colors.textMuted },
  bigBtn: { height: 52 },
  sectionTitle: { marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    paddingRight: 4,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
  },
});
