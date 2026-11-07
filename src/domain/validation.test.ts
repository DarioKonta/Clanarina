import { parseAmount, validateMember, validateMembership } from './validation';

describe('validation', () => {
  test('parseAmount', () => {
    expect(parseAmount('3.000')).toBe(3000);
    expect(parseAmount('3 000')).toBe(3000);
    expect(parseAmount('2500')).toBe(2500);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
  });

  test('member needs a first name', () => {
    expect(validateMember({ firstName: ' ', lastName: '', phone: '', note: '' })).toHaveProperty(
      'firstName',
    );
    expect(validateMember({ firstName: 'Ana', lastName: '', phone: '064 123 4567', note: '' })).toEqual(
      {},
    );
  });

  test('membership fields', () => {
    const ok = {
      memberId: 'x',
      periodStart: '2026-11-01',
      months: 1,
      amount: '3000',
      paidNow: false,
      paidAt: '',
      note: '',
    };
    expect(validateMembership(ok)).toEqual({});
    expect(validateMembership({ ...ok, periodStart: '2026-13-01' })).toHaveProperty('periodStart');
    expect(validateMembership({ ...ok, months: 0 })).toHaveProperty('months');
    expect(validateMembership({ ...ok, amount: '' })).toHaveProperty('amount');
    expect(validateMembership({ ...ok, paidNow: true, paidAt: '' })).toHaveProperty('paidAt');
  });
});
