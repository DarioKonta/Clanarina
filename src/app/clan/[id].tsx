import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, IconButton, Menu, Text } from 'react-native-paper';
import { countInMonth, lastAttended } from '@/domain/attendance';
import { addDaysKey, ageOn, isBirthday, monthOf, todayKey } from '@/domain/dates';
import { formatDate, formatMoney, formatPeriod, fullName, initials } from '@/domain/format';
import { openSegment, type MonthSlot } from '@/domain/months';
import { nextToPay, oldestOwed } from '@/domain/status';
import type { Segment } from '@/domain/types';
import { deleteMember, pauseMember, reopenSegment, restoreMember, setPaymentDeleted, updateMember } from '@/db/repo';
import { useMemberDetail } from '@/hooks/useData';
import { t } from '@/i18n/sr';
import { offerUndo } from '@/state/store';
import { EmptyState } from '@/ui/EmptyState';
import { PaymentDialog, quickPay, type PaymentTarget } from '@/ui/PaymentDialog';
import { ReminderButton } from '@/ui/ReminderButton';
import { ResumeDialog, SegmentDialog } from '@/ui/SegmentDialogs';
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
  const [paying, setPaying] = useState<PaymentTarget | null>(null);
  const [resuming, setResuming] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);

  if (loading) return null;
  const member = data?.member;
  const detail = data?.detail;
  if (!member || member.deleted || !detail) return <EmptyState icon="account-question" title={t.members.notFound} />;
  const { attendance } = data;
  const { status, segments, slots } = detail;
  const running = openSegment(segments);
  const toPay = nextToPay(slots);
  const payMonth = (slot: MonthSlot) => setPaying({ ...detail, slot });
  const onPay = () => {
    const owed = oldestOwed(slots);
    if (owed) void quickPay({ ...detail, slot: owed });
    else if (toPay) payMonth(toPay);
  };
  const onPause = async () => {
    const segId = await pauseMember(member.id);
    if (segId) offerUndo(t.undo.paused, () => reopenSegment(segId));
  };
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
                onPress={async () => {
                  setMenuOpen(false);
                  const wasActive = member.active;
                  // Archiving pauses billing; undo restores both.
                  const pausedId = await updateMember(member.id, { active: !wasActive });
                  offerUndo(wasActive ? t.undo.archived : t.undo.unarchived, async () => {
                    await updateMember(member.id, { active: wasActive });
                    if (pausedId) await reopenSegment(pausedId);
                  });
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

        {member.active ? (
          <View style={styles.actions}>
            {toPay ? (
              <Button
                mode="contained"
                icon="cash"
                style={{ flex: 1 }}
                contentStyle={styles.bigBtn}
                onPress={onPay}
                onLongPress={() => payMonth(toPay)}
              >
                {t.members.payQuick}
              </Button>
            ) : null}
            {running ? (
              <Button mode="contained-tonal" icon="pause" style={{ flex: 1 }} contentStyle={styles.bigBtn} onPress={onPause}>
                {t.member.pause}
              </Button>
            ) : (
              <Button
                mode="contained-tonal"
                icon="play"
                style={{ flex: 1 }}
                contentStyle={styles.bigBtn}
                onPress={() => setResuming(true)}
              >
                {t.member.resume}
              </Button>
            )}
          </View>
        ) : null}

        <Text variant="titleMedium" style={styles.sectionTitle}>
          {t.member.history}
        </Text>
        {segments.length === 0 ? (
          <Text style={styles.muted}>{t.member.noHistory}</Text>
        ) : (
          <History segments={segments} slots={slots} onEdit={setEditing} onPay={payMonth} />
        )}
      </ScrollView>

      <PaymentDialog target={paying} onDismiss={() => setPaying(null)} />
      <ResumeDialog memberId={member.id} segments={segments} visible={resuming} onDismiss={() => setResuming(false)} />
      <SegmentDialog segment={editing} segments={segments} onDismiss={() => setEditing(null)} />
    </View>
  );
}

/** Segments newest first, each with its months (started, paid, or the next upcoming one); breaks between. */
function History({
  segments,
  slots,
  onEdit,
  onPay,
}: {
  segments: Segment[];
  slots: MonthSlot[];
  onEdit: (s: Segment) => void;
  onPay: (slot: MonthSlot) => void;
}) {
  const today = todayKey();
  const ordered = [...segments].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return (
    <View style={{ gap: 10 }}>
      {ordered.map((seg, i) => {
        const own = slots.filter((s) => s.segmentId === seg.id);
        const firstUpcoming = own.find((s) => s.state === 'predstojece');
        const shown = own.filter((s) => s.start <= today || s.state === 'placeno' || s === firstUpcoming).reverse();
        const older = ordered[i + 1];
        return (
          <View key={seg.id} style={{ gap: 8 }}>
            <View style={styles.segmentHead}>
              <MaterialCommunityIcons
                name={seg.endDate ? 'calendar-range' : 'calendar-arrow-right'}
                size={18}
                color={colors.textMuted}
              />
              <Text variant="titleSmall" style={{ flex: 1 }}>
                {seg.endDate
                  ? t.member.segmentRange(formatDate(seg.startDate), formatDate(seg.endDate))
                  : t.member.segmentRunning(formatDate(seg.startDate))}
              </Text>
              <IconButton icon="pencil" size={20} accessibilityLabel={t.member.editSegment} onPress={() => onEdit(seg)} />
            </View>
            {shown.map((slot) => (
              <MonthRow key={slot.start} slot={slot} onPay={() => onPay(slot)} />
            ))}
            {older?.endDate && older.endDate < seg.startDate ? (
              <View style={styles.gap}>
                <Text variant="bodySmall" style={styles.muted}>
                  {t.member.gap}: {formatPeriod(older.endDate, addDaysKey(seg.startDate, -1))}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function MonthRow({ slot, onPay }: { slot: MonthSlot; onPay: () => void }) {
  const color = slot.state === 'placeno' ? colors.paid : slot.state === 'duguje' ? colors.owes : colors.textMuted;
  const label =
    slot.state === 'placeno' ? t.member.monthPaid : slot.state === 'duguje' ? t.member.monthOwes : t.member.monthUpcoming;
  const payment = slot.payment;

  const undoPayment = () => {
    if (!payment) return;
    Alert.alert(t.member.undoPaymentConfirm, formatPeriod(payment.periodStart, payment.periodEnd), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.member.undoPayment,
        style: 'destructive',
        onPress: () => {
          void setPaymentDeleted(payment.id, true);
          offerUndo(t.undo.unpaid, () => setPaymentDeleted(payment.id, false));
        },
      },
    ]);
  };

  return (
    <View style={[styles.row, { borderLeftColor: color }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="titleSmall">{formatPeriod(slot.start, slot.end)}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          {payment && payment.months > 1
            ? t.member.partOfPayment(formatMoney(payment.amount), t.membership.months(payment.months))
            : formatMoney(slot.amount)}
          {payment?.paidAt ? ` · ${t.member.paidOn(formatDate(payment.paidAt))}` : ''}
        </Text>
        <Pill color={color} label={label} />
      </View>
      {payment ? (
        <IconButton icon="cash-remove" size={20} accessibilityLabel={t.member.undoPayment} onPress={undoPayment} />
      ) : (
        <Button mode={slot.state === 'duguje' ? 'contained' : 'contained-tonal'} compact onPress={onPay}>
          {t.members.payQuick}
        </Button>
      )}
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
  actions: { flexDirection: 'row', gap: 10 },
  sectionTitle: { marginTop: 8 },
  segmentHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  gap: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.textMuted + '66' },
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
