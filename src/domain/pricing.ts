/** Default amount for a new membership: the member's own price (or the club default) × months. */
export function suggestAmount(memberPrice: number | null, defaultAmount: number, months: number): number {
  return (memberPrice ?? defaultAmount) * months;
}
