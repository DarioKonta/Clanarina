import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, View } from 'react-native';
import { HelperText, IconButton, TextInput } from 'react-native-paper';
import { fromDateKey, toDateKey } from '@/domain/dates';
import { formatDate } from '@/domain/format';
import type { DateKey } from '@/domain/types';
import { t } from '@/i18n/sr';

interface Props {
  label: string;
  /** Empty string = no date. */
  value: DateKey;
  onChange: (value: DateKey) => void;
  error?: string;
  /** Optional field: shows an ✕ to remove the date. */
  onClear?: () => void;
}

/** Read-only text field that opens the native Android date dialog. */
export function DateField({ label, value, onChange, error, onClear }: Props) {
  const open = () =>
    DateTimePickerAndroid.open({
      value: value ? fromDateKey(value) : new Date(),
      mode: 'date',
      firstDayOfWeek: 1,
      onValueChange: (_e, date) => onChange(toDateKey(date)),
    });

  return (
    <View>
      <View>
        <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={label}>
          <View pointerEvents="none">
            <TextInput
              mode="outlined"
              label={label}
              value={value ? formatDate(value) : ''}
              editable={false}
              right={<TextInput.Icon icon="calendar" />}
              error={!!error}
            />
          </View>
        </Pressable>
        {onClear && value ? (
          <IconButton
            icon="close"
            size={20}
            onPress={onClear}
            accessibilityLabel={t.memberFields.clear}
            style={styles.clear}
          />
        ) : null}
      </View>
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Left of the calendar icon, vertically centred in the outlined input.
  clear: { position: 'absolute', right: 40, top: 8 },
});
