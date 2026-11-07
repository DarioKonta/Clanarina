import * as XLSX from 'xlsx';
import { t } from '@/i18n/sr';
import { fullName } from './format';
import type { Attendance, Member, Membership } from './types';

export type Cell = string | number;
export interface ExportSheet {
  name: string;
  rows: Cell[][];
}

const byName = (a: Member, b: Member) => fullName(a).localeCompare(fullName(b), 'sr-Latn');

/** Spreadsheet-ready tables (header row first) for the Excel export. Deleted rows are left out. */
export function buildExport(members: Member[], memberships: Membership[], attendance: Attendance[]): ExportSheet[] {
  const h = t.export.headers;
  const live = members.filter((m) => !m.deleted).sort(byName);
  const nameOf = new Map(members.map((m) => [m.id, fullName(m)]));
  const name = (id: string) => nameOf.get(id) ?? '';

  const membersRows: Cell[][] = [
    [h.firstName, h.lastName, h.phone, h.group, h.price, h.birthDate, h.joinedAt, h.status, h.note],
    ...live.map((m) => [
      m.firstName,
      m.lastName,
      m.phone ?? '',
      m.groupName ?? '',
      m.price ?? '',
      m.birthDate ?? '',
      m.joinedAt ?? '',
      m.active ? t.export.active : t.export.archived,
      m.note ?? '',
    ]),
  ];

  const membershipRows: Cell[][] = [
    [h.member, h.periodStart, h.periodEnd, h.months, h.amount, h.paidAt, h.note],
    ...memberships
      .filter((m) => !m.deleted)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart) || name(a.memberId).localeCompare(name(b.memberId)))
      .map((m) => [name(m.memberId), m.periodStart, m.periodEnd, m.months, m.amount, m.paidAt ?? '', m.note ?? '']),
  ];

  const attendanceRows: Cell[][] = [
    [h.date, h.member],
    ...attendance
      .filter((a) => !a.deleted)
      .sort((a, b) => b.date.localeCompare(a.date) || name(a.memberId).localeCompare(name(b.memberId)))
      .map((a) => [a.date, name(a.memberId)]),
  ];

  return [
    { name: t.export.sheetMembers, rows: membersRows },
    { name: t.export.sheetMemberships, rows: membershipRows },
    { name: t.export.sheetAttendance, rows: attendanceRows },
  ];
}

/** .xlsx file content (base64) with one worksheet per table and readable column widths. */
export function toXlsxBase64(sheets: ExportSheet[]): string {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    ws['!cols'] = sheet.rows[0].map((_, c) => ({
      wch: Math.min(40, Math.max(8, ...sheet.rows.map((r) => String(r[c] ?? '').length + 2))),
    }));
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
  }
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) as string;
}
