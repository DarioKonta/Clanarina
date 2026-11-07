import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';
import { fromDateKey, toDateKey } from '@/domain/dates';
import { formatDate } from '@/domain/format';
import type { DateKey } from '@/domain/types';

interface Props {
  label: string;
  value: DateKey;
  onChange: (value: DateKey) => void;
  error?: string;
}

/** Read-only text field that opens the native Android date dialog. */
export function DateField({ label, value, onChange, error }: Props) {
  const open = () =>
    DateTimePickerAndroid.open({
      value: value ? fromDateKey(value) : new Date(),
      mode: 'date',
      firstDayOfWeek: 1,
      onValueChange: (_e, date) => onChange(toDateKey(date)),
    });

  return (
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
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </View>
  );
}
