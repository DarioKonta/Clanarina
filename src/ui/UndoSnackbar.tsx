import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n/sr';
import { useUndoStore } from '@/state/store';

/** App-wide "… · Poništi" bar for the last undoable action. Mounted once in the root layout. */
export function UndoSnackbar() {
  const item = useUndoStore((s) => s.item);
  const clear = useUndoStore((s) => s.clear);
  const { bottom } = useSafeAreaInsets();
  return (
    <Snackbar
      key={item?.id}
      visible={!!item}
      onDismiss={clear}
      duration={6000}
      // Sits above the tab bar.
      wrapperStyle={{ bottom: 64 + bottom }}
      action={{
        label: t.undo.action,
        onPress: () => {
          const undo = item?.undo;
          clear();
          void undo?.();
        },
      }}
    >
      {item?.message}
    </Snackbar>
  );
}
