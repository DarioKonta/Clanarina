import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';
import { hasErrors, validateMember, type MemberInput } from '@/domain/validation';
import { createMember, getMember, updateMember } from '@/db/repo';
import { t } from '@/i18n/sr';

/** Create (no id) or edit (with ?id=) a member. */
export default function MemberFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState<MemberInput>({ firstName: '', lastName: '', phone: '', note: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof MemberInput, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getMember(id).then((m) => {
      if (m) setForm({ firstName: m.firstName, lastName: m.lastName, phone: m.phone ?? '', note: m.note ?? '' });
    });
  }, [id]);

  const set = (k: keyof MemberInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const e = validateMember(form);
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    const fields = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || null,
      note: form.note.trim() || null,
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
  content: { padding: 16, gap: 14 },
  btn: { height: 52 },
});
