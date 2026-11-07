import { format } from 'date-fns';
import { srLatn } from 'date-fns/locale/sr-Latn';
import { fromDateKey } from './dates';
import type { DateKey } from './types';

// Short Serbian month names without trailing dots, e.g. "1. nov 2026."
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];

function dayMonth(key: DateKey): string {
  const d = fromDateKey(key);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

const MONTHS_FULL = [
  'januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar',
];

/** `2026-11` → "novembar 2026". */
export function formatMonth(month: string): string {
  return `${MONTHS_FULL[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** `2026-11` → "nov" (chart labels). */
export function formatMonthShort(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

export function formatDate(key: DateKey): string {
  return `${dayMonth(key)} ${key.slice(0, 4)}.`;
}

export function formatDayMonth(key: DateKey): string {
  return dayMonth(key);
}

export function formatPeriod(start: DateKey, end: DateKey): string {
  if (start.slice(0, 4) === end.slice(0, 4)) {
    return `${dayMonth(start)} – ${formatDate(end)}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** e.g. "danas u 14:32" or "5. nov u 09:10". */
export function formatTimestamp(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = format(d, 'HH:mm', { locale: srLatn });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `danas u ${time}`;
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} u ${time}`;
}

export function formatMoney(amount: number): string {
  const s = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${s} RSD`;
}

type Named = { firstName: string; lastName: string };

export function fullName(m: Named): string {
  return `${m.firstName} ${m.lastName}`.trim();
}

export function initials(m: Named): string {
  return `${m.firstName.charAt(0)}${m.lastName.charAt(0)}`.toUpperCase();
}

/** Lowercase, diacritics folded (č→c, đ→dj…) for forgiving search. */
export function searchKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
