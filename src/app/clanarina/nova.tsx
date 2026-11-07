import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Menu, SegmentedButtons, Switch, Text, TextInput } from 'react-native-paper';
import { periodEnd, todayKey } from '@/domain/dates';
import { formatPeriod, fullName } from '@/domain/format';
import { suggestNextPeriodStart } from '@/domain/status';
import type { Member } from '@/domain/types';
import { hasErrors, parseAmount, validateMembership, type MembershipInput } from '@/domain/validation';
import { createMembership, getDefaultAmount, listMembers, listMemberships } from '@/db/repo';
import { t } from '@/i18n/sr';
import { DateField } from '@/ui/DateField';
import { colors } from '@/ui/theme';

const DURATIONS = [1, 2, 3, 6];

export default function NewMembershipScreen() {
  const params = useLocalSearchParams<{ memberId?: string; paid?: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState<MembershipInput>({
    memberId: params.memberId ?? '',
    periodStart: todayKey(),
    months: 1,
    amount: '',
    paidNow: params.paid === '1',
    paidAt: todayKey(),
    note: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof MembershipInput, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listMembers().then((all) => setMembers(all.filter((m) => m.active)));
    getDefaultAmount().then((a) => setForm((f) => (f.amount ? f : { ...f, amount: String(a) })));
  }, []);

  // Suggest a start date that continues the member's previous period.
  useEffect(() => {
    if (!form.memberId) return;
    listMemberships(form.memberId).then((ms) =>
      setForm((f) => ({ ...f, periodStart: suggestNextPeriodStart(ms, todayKey()) })),
    );
  }, [form.memberId]);

  const selected = members.find((m) => m.id === form.memberId);
  const end = useMemo(() => periodEnd(form.periodStart, form.months), [form.periodStart, form.months]);
  const set = <K extends keyof MembershipInput>(k: K, v: MembershipInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const e = validateMembership(form);
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      await createMembership({
        memberId: form.memberId,
        periodStart: form.periodStart,
        months: form.months,
        amount: parseAmount(form.amount)!,
        paidAt: form.paidNow ? form.paidAt : null,
        note: form.note.trim() || null,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View>
        <Menu
          visible={pickerOpen}
          onDismiss={() => setPickerOpen(false)}
          anchor={
            <Button
              mode="outlined"
              icon="account"
              onPress={() => setPickerOpen(true)}
              contentStyle={styles.pickerBtn}
              disabled={!!params.memberId}
              textColor={colors.text}
            >
              {selected ? fullName(selected) : t.membership.pickMember}
            </Button>
          }
        >
          <ScrollView style={{ maxHeight: 360 }}>
            {members.map((m) => (
              <Menu.Item
                key={m.id}
                title={fullName(m)}
                onPress={() => {
                  set('memberId', m.id);
                  setPickerOpen(false);
                }}
              />
            ))}
          </ScrollView>
        </Menu>
        {errors.memberId ? <HelperText type="error">{errors.memberId}</HelperText> : null}
      </View>

      <DateField
        label={t.membership.start}
        value={form.periodStart}
        onChange={(v) => set('periodStart', v)}
        error={errors.periodStart}
      />

      <View style={{ gap: 6 }}>
        <Text variant="labelLarge" style={styles.muted}>
          {t.membership.duration}
        </Text>
        <SegmentedButtons
          value={String(form.months)}
          onValueChange={(v) => set('months', Number(v))}
          buttons={DURATIONS.map((n) => ({ value: String(n), label: t.membership.monthsShort(n) }))}
        />
        <Text variant="bodyMedium" style={styles.period}>
          {t.membership.period}: {formatPeriod(form.periodStart, end)}
        </Text>
      </View>

      <View>
        <TextInput
          mode="outlined"
          label={t.membership.amount}
          value={form.amount}
          onChangeText={(v) => set('amount', v)}
          keyboardType="number-pad"
          error={!!errors.amount}
        />
        {errors.amount ? <HelperText type="error">{errors.amount}</HelperText> : null}
      </View>

      <View style={styles.switchRow}>
        <Text variant="titleMedium">{t.membership.paidNow}</Text>
        <Switch value={form.paidNow} onValueChange={(v) => set('paidNow', v)} color={colors.paid} />
      </View>
      {form.paidNow ? (
        <DateField
          label={t.membership.paidDate}
          value={form.paidAt}
          onChange={(v) => set('paidAt', v)}
          error={errors.paidAt}
        />
      ) : (
        <Text variant="bodySmall" style={styles.hint}>
          {t.membership.delayedHint}
        </Text>
      )}

      <TextInput
        mode="outlined"
        label={`${t.membership.note} ${t.common.optional}`}
        value={form.note}
        onChangeText={(v) => set('note', v)}
      />

      <Button mode="contained" onPress={save} loading={saving} disabled={saving} contentStyle={styles.bigBtn}>
        {t.common.save}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  pickerBtn: { height: 52, justifyContent: 'flex-start' },
  muted: { color: colors.textMuted },
  period: { color: colors.text, marginTop: 2 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  hint: { color: colors.soon, marginTop: -6, paddingHorizontal: 4 },
  bigBtn: { height: 52 },
});
