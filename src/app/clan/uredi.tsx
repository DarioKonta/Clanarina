import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, TextInput } from 'react-native-paper';
import { todayKey } from '@/domain/dates';
import { formatMoney } from '@/domain/format';
import type { DateKey } from '@/domain/types';
import { hasErrors, parseAmount, validateMember, type MemberInput } from '@/domain/validation';
import { createMember, getDefaultAmount, getMember, listGroups, updateMember } from '@/db/repo';
import { t } from '@/i18n/sr';
import { DateField } from '@/ui/DateField';
import { colors } from '@/ui/theme';

interface Extra {
  groupName: string;
  price: string;
  birthDate: DateKey;
  joinedAt: DateKey;
}

/** Create (no id) or edit (with ?id=) a member. */
export default function MemberFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState<MemberInput>({ firstName: '', lastName: '', phone: '', note: '' });
  const [extra, setExtra] = useState<Extra>({ groupName: '', price: '', birthDate: '', joinedAt: id ? '' : todayKey() });
  const [errors, setErrors] = useState<Partial<Record<keyof MemberInput, string>>>({});
  const [priceError, setPriceError] = useState<string>();
  const [groups, setGroups] = useState<string[]>([]);
  const [defaultAmount, setDefaultAmountState] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listGroups().then(setGroups);
    void getDefaultAmount().then(setDefaultAmountState);
    if (!id) return;
    getMember(id).then((m) => {
      if (!m) return;
      setForm({ firstName: m.firstName, lastName: m.lastName, phone: m.phone ?? '', note: m.note ?? '' });
      setExtra({
        groupName: m.groupName ?? '',
        price: m.price === null ? '' : String(m.price),
        birthDate: m.birthDate ?? '',
        joinedAt: m.joinedAt ?? '',
      });
    });
  }, [id]);

  const set = (k: keyof MemberInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setX = <K extends keyof Extra>(k: K, v: Extra[K]) => setExtra((x) => ({ ...x, [k]: v }));

  const save = async () => {
    const e = validateMember(form);
    setErrors(e);
    const price = extra.price.trim() ? parseAmount(extra.price) : null;
    const badPrice = extra.price.trim() !== '' && price === null;
    setPriceError(badPrice ? t.validation.required : undefined);
    if (hasErrors(e) || badPrice) return;
    setSaving(true);
    const fields = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || null,
      note: form.note.trim() || null,
      groupName: extra.groupName.trim() || null,
      price,
      birthDate: extra.birthDate || null,
      joinedAt: extra.joinedAt || null,
    };
    try {
      if (id) {
        await updateMember(id, fields);
        router.back();
      } else {
        const newId = await createMember(fields);
        // Straight to the member so a membership can be added right away.
        router.replace({ pathname: '/clan/[id]', params: { id: newId } });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <Stack.Screen options={{ title: id ? t.members.editMember : t.members.newMember }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <TextInput
            mode="outlined"
            label={t.members.firstName}
            value={form.firstName}
            onChangeText={set('firstName')}
            autoFocus={!id}
            autoCapitalize="words"
            error={!!errors.firstName}
          />
          {errors.firstName ? <HelperText type="error">{errors.firstName}</HelperText> : null}
        </View>
        <TextInput
          mode="outlined"
          label={t.members.lastName}
          value={form.lastName}
          onChangeText={set('lastName')}
          autoCapitalize="words"
        />
        <View>
          <TextInput
            mode="outlined"
            label={`${t.members.phone} ${t.common.optional}`}
            value={form.phone}
            onChangeText={set('phone')}
            keyboardType="phone-pad"
            error={!!errors.phone}
          />
          {errors.phone ? <HelperText type="error">{errors.phone}</HelperText> : null}
        </View>

        <View style={{ gap: 8 }}>
          <TextInput
            mode="outlined"
            label={`${t.memberFields.group} ${t.common.optional}`}
            placeholder={t.memberFields.groupHint}
            value={extra.groupName}
            onChangeText={(v) => setX('groupName', v)}
            autoCapitalize="sentences"
          />
          {groups.length > 0 ? (
            <View style={styles.chips}>
              {groups.map((g) => (
                <Chip
                  key={g}
                  compact
                  selected={extra.groupName.trim() === g}
                  onPress={() => setX('groupName', extra.groupName.trim() === g ? '' : g)}
                  style={styles.chip}
                >
                  {g}
                </Chip>
              ))}
            </View>
          ) : null}
        </View>

        <View>
          <TextInput
            mode="outlined"
            label={`${t.memberFields.price} ${t.common.optional}`}
            value={extra.price}
            onChangeText={(v) => setX('price', v)}
            keyboardType="number-pad"
            error={!!priceError}
          />
          <HelperText type={priceError ? 'error' : 'info'}>
            {priceError ?? (defaultAmount !== null ? t.memberFields.priceHint(formatMoney(defaultAmount)) : '')}
          </HelperText>
        </View>

        <DateField
          label={`${t.memberFields.birthDate} ${t.common.optional}`}
          value={extra.birthDate}
          onChange={(v) => setX('birthDate', v)}
          onClear={() => setX('birthDate', '')}
        />
        <DateField
          label={`${t.memberFields.joinedAt} ${t.common.optional}`}
          value={extra.joinedAt}
          onChange={(v) => setX('joinedAt', v)}
          onClear={() => setX('joinedAt', '')}
        />

        <TextInput
          mode="outlined"
          label={`${t.members.note} ${t.common.optional}`}
          value={form.note}
          onChangeText={set('note')}
          multiline
        />
        <Button mode="contained" onPress={save} loading={saving} disabled={saving} contentStyle={styles.btn}>
          {t.common.save}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  btn: { height: 52 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.surface },
});
