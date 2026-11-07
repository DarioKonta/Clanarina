import { isValidDateKey } from './dates';

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export interface MemberInput {
  firstName: string;
  lastName: string;
  phone: string;
  note: string;
}

export function validateMember(input: MemberInput): FieldErrors<keyof MemberInput> {
  const errors: FieldErrors<keyof MemberInput> = {};
  if (!input.firstName.trim()) errors.firstName = 'Unesi ime';
  if (input.phone.trim() && !/^[+\d][\d\s/-]{5,}$/.test(input.phone.trim())) {
    errors.phone = 'Neispravan broj telefona';
  }
  return errors;
}

export interface MembershipInput {
  memberId: string;
  periodStart: string;
  months: number;
  amount: string;
  paidNow: boolean;
  paidAt: string;
  note: string;
}

export function validateMembership(
  input: MembershipInput,
): FieldErrors<keyof MembershipInput> {
  const errors: FieldErrors<keyof MembershipInput> = {};
  if (!input.memberId) errors.memberId = 'Izaberi člana';
  if (!isValidDateKey(input.periodStart)) errors.periodStart = 'Neispravan datum';
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 24) {
    errors.months = 'Trajanje mora biti od 1 do 24 meseca';
  }
  const amount = parseAmount(input.amount);
  if (amount === null) errors.amount = 'Unesi iznos';
  if (input.paidNow && !isValidDateKey(input.paidAt)) errors.paidAt = 'Neispravan datum';
  return errors;
}

/** "3.000" / "3000" / "3 000" → 3000. Returns null for empty/invalid/negative. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[.\s]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export const hasErrors = (e: object) => Object.keys(e).length > 0;
