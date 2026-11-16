import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { todayKey } from '@/domain/dates';
import { formatMoney, formatPeriod, fullName } from '@/domain/format';
import { coveredUntil, type MonthSlot } from '@/domain/months';
import type { DateKey, Member } from '@/domain/types';
import { parseAmount } from '@/domain/validation';
import { payMonths, setPaymentDeleted } from '@/db/repo';
import { t } from '@/i18n/sr';
import { offerUndo } from '@/state/store';
import { DateField } from './DateField';

const MONTH_OPTIONS = [1, 2, 3, 6, 12];

export interface PaymentTarget {
  member: Member;
  /** The member's whole month grid, to show which months a payment covers. */
  slots: MonthSlot[];
  /** First month the payment is for. */
  slot: MonthSlot;
  price: number;
}

/** Records a payment for one or more months starting at `slot`, with undo. */
export async function recordPayment(
  memberId: string,
  start: DateKey,
  months: number,
  amount: number,
  paidAt: DateKey,
): Promise<void> {
  const id = await payMonths(memberId, start, months, amount, paidAt);
  offerUndo(t.undo.paid, () => setPaymentDeleted(id, true));
}

/** "Uplata" in one tap: the given month, today, at the member's price. */
export function quickPay(target: PaymentTarget): Promise<void> {
  return recordPayment(target.member.id, target.slot.start, 1, target.price, todayKey());
}

export function PaymentDialog({ target, onDismiss }: { target: PaymentTarget | null; onDismiss: () => void }) {
  return (
    <Portal>
      <Dialog visible={!!target} onDismiss={onDismiss}>
        {target ? (
          // Keyed so the form resets for each month.
          <PaymentForm key={target.member.id + target.slot.start} target={target} onDone={onDismiss} />
        ) : null}
      </Dialog>
    </Portal>
  );
}

function PaymentForm({ target, onDone }: { target: PaymentTarget; onDone: () => void }) {
  const [months, setMonths] = useState(1);
  const [date, setDate] = useState(todayKey);
  const [amount, setAmount] = useState(String(target.price));
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const pickMonths = (n: number) => {
    setMonths(n);
    setAmount(String(target.price * n));
  };

  const confirm = async () => {
    const value = parseAmount(amount);
    if (value === null) {
      setError(t.validation.required);
      return;
    }
    setSaving(true);
    try {
      await recordPayment(target.member.id, target.slot.start, months, value, date);
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
          <Text variant="bodyLarge">{fullName(target.member)}</Text>
          <Text variant="bodyMedium" style={styles.muted}>
            {t.payment.covers}: {formatPeriod(target.slot.start, coveredUntil(target.slots, target.slot.start, months))}
          </Text>
        </View>
        <View style={{ gap: 6 }}>
          <Text variant="labelLarge" style={styles.muted}>
            {t.payment.monthsLabel}
          </Text>
          {/* Plain numbers: five "N m" labels don't fit in a dialog on a phone. */}
          <SegmentedButtons
            value={String(months)}
            onValueChange={(v) => pickMonths(Number(v))}
            buttons={MONTH_OPTIONS.map((n) => ({ value: String(n), label: String(n), style: styles.seg }))}
          />
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
          <HelperText type={error ? 'error' : 'info'}>
            {error ?? `${formatMoney(target.price)} × ${t.membership.months(months)} · ${t.payment.hint}`}
          </HelperText>
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
  seg: { minWidth: 0 },
});
