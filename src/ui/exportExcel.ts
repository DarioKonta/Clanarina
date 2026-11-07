import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { todayKey } from '@/domain/dates';
import { buildExport, toXlsxBase64 } from '@/domain/export';
import { listAttendance, listMembers, listMemberships } from '@/db/repo';
import { t } from '@/i18n/sr';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Writes all data to an .xlsx file in the cache and opens the share sheet (Drive, Viber, mail…). */
export async function exportToExcel(): Promise<void> {
  const [members, memberships, attendance] = await Promise.all([listMembers(), listMemberships(), listAttendance()]);
  const base64 = toXlsxBase64(buildExport(members, memberships, attendance));

  const file = new File(Paths.cache, `${t.export.fileName}-${todayKey()}.xlsx`);
  if (file.exists) file.delete();
  file.create();
  await file.write(base64, { encoding: 'base64' });

  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
  await Sharing.shareAsync(file.uri, { mimeType: XLSX_MIME, dialogTitle: t.export.button });
}
