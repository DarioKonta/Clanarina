import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text } from 'react-native-paper';
import { todayKey } from '@/domain/dates';
import { validateSegment } from '@/domain/months';
import type { DateKey, Segment } from '@/domain/types';
import { resumeMember, setSegmentDeleted, updateSegment } from '@/db/repo';
import { t } from '@/i18n/sr';
import { offerUndo } from '@/state/store';
import { DateField } from './DateField';
import { colors } from './theme';

/** "Nastavi": pick the day months start again from (default today). */
export function ResumeDialog({
  memberId,
  segments,
  visible,
  onDismiss,
}: {
  memberId: string;
  segments: Segment[];
  visible: boolean;
  onDismiss: () => void;
}) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        {visible ? <ResumeForm memberId={memberId} segments={segments} onDone={onDismiss} /> : null}
      </Dialog>
    </Portal>
  );
}

function ResumeForm({ memberId, segments, onDone }: { memberId: string; segments: Segment[]; onDone: () => void }) {
  const [date, setDate] = useState<DateKey>(todayKey);
  const error = validateSegment(segments, { startDate: date, endDate: null });

  const confirm = async () => {
    if (error) return;
    const id = await resumeMember(memberId, date);
    offerUndo(t.undo.resumed, () => setSegmentDeleted(id, true));
    onDone();
  };

  return (
    <>
      <Dialog.Title>{t.member.resumeTitle}</Dialog.Title>
      <Dialog.Content style={styles.content}>
        <DateField label={t.member.resumeFrom} value={date} onChange={setDate} />
        <HelperText type={error ? 'error' : 'info'}>{error ? t.validation[error] : t.member.resumeHint}</HelperText>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDone}>{t.common.cancel}</Button>
        <Button mode="contained" onPress={confirm} disabled={!!error}>
          {t.member.resume}
        </Button>
      </Dialog.Actions>
    </>
  );
}

/** ✎ on a history segment: change its start or pause date, or delete it. */
export function SegmentDialog({
  segment,
  segments,
  onDismiss,
}: {
  segment: Segment | null;
  segments: Segment[];
  onDismiss: () => void;
}) {
  return (
    <Portal>
      <Dialog visible={!!segment} onDismiss={onDismiss}>
        {segment ? <SegmentForm key={segment.id} segment={segment} segments={segments} onDone={onDismiss} /> : null}
      </Dialog>
    </Portal>
  );
}

function SegmentForm({ segment, segments, onDone }: { segment: Segment; segments: Segment[]; onDone: () => void }) {
  const [startDate, setStartDate] = useState(segment.startDate);
  const [endDate, setEndDate] = useState<DateKey | null>(segment.endDate);
  const error = validateSegment(segments, { id: segment.id, startDate, endDate });

  const save = async () => {
    if (error) return;
    await updateSegment(segment.id, { startDate, endDate });
    onDone();
  };

  const remove = () =>
    Alert.alert(t.member.deleteSegment, t.member.deleteSegmentConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.delete,
        style: 'destructive',
        onPress: async () => {
          await setSegmentDeleted(segment.id, true);
          offerUndo(t.undo.segmentDeleted, () => setSegmentDeleted(segment.id, false));
          onDone();
        },
      },
    ]);

  return (
    <>
      <Dialog.Title>{t.member.editSegment}</Dialog.Title>
      <Dialog.Content style={styles.content}>
        <DateField label={t.member.segmentStart} value={startDate} onChange={setStartDate} />
        <View>
          <DateField
            label={t.member.segmentPause}
            value={endDate ?? ''}
            onChange={setEndDate}
            onClear={endDate ? () => setEndDate(null) : undefined}
          />
          {!endDate ? (
            <Text variant="bodySmall" style={styles.muted}>
              {t.member.removePause}
            </Text>
          ) : null}
        </View>
        {error ? <HelperText type="error">{t.validation[error]}</HelperText> : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button textColor={colors.owes} onPress={remove} style={styles.left}>
          {t.member.deleteSegment}
        </Button>
        <Button onPress={onDone}>{t.common.cancel}</Button>
        <Button mode="contained" onPress={save} disabled={!!error}>
          {t.common.save}
        </Button>
      </Dialog.Actions>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  muted: { opacity: 0.7, marginTop: 4, marginLeft: 4 },
  left: { marginRight: 'auto' },
});
