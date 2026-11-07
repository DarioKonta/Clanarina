import { useState } from 'react';
import { Linking, Share } from 'react-native';
import { Button, IconButton, Menu } from 'react-native-paper';
import { formatDate, formatMoney } from '@/domain/format';
import { smsUrl } from '@/domain/reminder';
import type { Member, MemberStatus } from '@/domain/types';
import { t } from '@/i18n/sr';

/** Debt reminder: opens SMS with the text filled in, or the share sheet (Viber, WhatsApp…). */
export function ReminderButton({
  member,
  status,
  compact,
}: {
  member: Member;
  status: MemberStatus;
  /** Icon only (for lists). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (status.kind !== 'duguje') return null;

  const text = t.reminder.message(member.firstName, formatMoney(status.debt), formatDate(status.since), status.unpaidCount);
  const sendSms = () => {
    setOpen(false);
    if (member.phone) void Linking.openURL(smsUrl(member.phone, text));
  };
  const share = () => {
    setOpen(false);
    void Share.share({ message: text });
  };

  const anchor = compact ? (
    <IconButton icon="message-alert-outline" mode="contained-tonal" accessibilityLabel={t.reminder.button} onPress={() => setOpen(true)} />
  ) : (
    <Button mode="outlined" icon="message-alert-outline" onPress={() => setOpen(true)}>
      {t.reminder.button}
    </Button>
  );

  return (
    <Menu visible={open} onDismiss={() => setOpen(false)} anchor={anchor}>
      {member.phone ? <Menu.Item leadingIcon="message-text" title={t.reminder.sms} onPress={sendSms} /> : null}
      <Menu.Item leadingIcon="share-variant" title={t.reminder.share} onPress={share} />
    </Menu>
  );
}
