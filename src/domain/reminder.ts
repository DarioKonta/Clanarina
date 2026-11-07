/** Phone number with only digits and an optional leading `+`, for sms:/tel: links. */
export function cleanPhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/** Opens the SMS app with the number and text filled in (Android `sms:` URI). */
export function smsUrl(phone: string, body: string): string {
  return `sms:${cleanPhone(phone)}?body=${encodeURIComponent(body)}`;
}
