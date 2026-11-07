import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';
import { todayKey } from '@/domain/dates';
import { formatPeriod, fullName } from '@/domain/format';
import type { Member, Membership } from '@/domain/types';
import { parseAmount } from '@/domain/validation';
import { markPaid, setPayment } from '@/db/repo';
import { t } from '@/i18n/sr';
import { offerUndo } from '@/state/store';
import { DateField } from './DateField';

interface Props {
  member: Member | null;
  membership: Membership | null;
  onDismiss: () => void;
}

/** "Evidentiraj uplatu" — records a delayed payment without moving the period. */
export function PaymentDialog({ member, membership, onDismiss }: Props) {
  return (
    <Portal>
      <Dialog visible={!!membership} onDismiss={onDismiss}>
        {membership ? (
          // Keyed so the form resets for each membership.
          <PaymentForm key={membership.id} member={member} membership={membership} onDone={onDismiss} />
        ) : null}
      </Dialog>
    </Portal>
  );
}

function PaymentForm({
  member,
  membership,
  onDone,
}: {
  member: Member | null;
  membership: Membership;
  onDone: () => void;
}) {
  const [date, setDate] = useState(todayKey);
  const [amount, setAmount] = useState(String(membership.amount));
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    const value = parseAmount(amount);
    if (value === null) {
      setError(t.validation.required);
      return;
    }
    setSaving(true);
    try {
      await markPaid(membership.id, date, value);
      const { id, amount: before } = membership;
      offerUndo(t.undo.paid, () => setPayment(id, null, before));
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog.Title>{t.payment.title}</Dialog.Title>
      <Dialog.Content style={styles.content}>
        <View>
          {member ? <Text variant="bodyLarge">{fullName(member)}</Text> : null}
          <Text variant="bodyMedium" style={styles.muted}>
            {formatPeriod(membership.periodStart, membership.periodEnd)}
          </Text>
        </View>
        <DateField label={t.payment.date} value={date} onChange={setDate} />
        <View>
          <TextInput
            mode="outlined"
            label={t.payment.amount}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            error={!!error}
          />
          {error ? <HelperText type="error">{error}</HelperText> : null}
        </View>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDone}>{t.common.cancel}</Button>
        <Button mode="contained" onPress={confirm} loading={saving} disabled={saving}>
          {t.payment.confirm}
        </Button>
      </Dialog.Actions>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  muted: { opacity: 0.7 },
});
