/// <reference types="node" />
/**
 * Parity test: the "Pregled članova" tab in apps-script/Code.gs re-implements
 * memberStatus() in plain Apps Script. Load Code.gs in a sandbox and check that both agree.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { addDaysKey, periodEnd } from './dates';
import { memberStatus } from './status';
import type { Membership } from './types';

type Row = Record<string, string>;
interface OverviewRow {
  name: string;
  kind: string;
  paidUntil: string;
  note: string;
}
interface Gs {
  buildOverview(
    members: Row[],
    memberships: Row[],
    today: string,
  ): { rows: OverviewRow[]; counts: Record<string, number>; totalDebt: number };
  periodEndKey(start: string, months: number): string;
  formatDateKey(k: string): string;
  daysText(n: number): string;
}

const gs = (() => {
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync(join(__dirname, '../../apps-script/Code.gs'), 'utf8'), ctx);
  return ctx as unknown as Gs;
})();

const TS = '2026-01-01T00:00:00.000Z';
const member = (id: string, extra: Row = {}): Row => ({
  id,
  firstName: 'Ana',
  lastName: id,
  active: '1',
  deleted: '0',
  ...extra,
});

describe('Code.gs overview', () => {
  it('matches date-fns month math for period ends', () => {
    for (const start of ['2026-01-31', '2026-01-30', '2024-01-31', '2026-03-31', '2026-11-01', '2026-12-15']) {
      for (const months of [1, 2, 3, 6, 12]) {
        expect(gs.periodEndKey(start, months)).toBe(periodEnd(start, months));
      }
    }
  });

  it('formats like the app', () => {
    expect(gs.formatDateKey('2026-11-01')).toBe('1. nov 2026.');
    expect(gs.daysText(1)).toBe('1 dan');
    expect(gs.daysText(3)).toBe('3 dana');
    expect(gs.daysText(11)).toBe('11 dana');
    expect(gs.daysText(21)).toBe('21 dan');
  });

  it('skips archived and deleted members, sorts the most urgent first', () => {
    const today = '2026-11-13';
    const view = gs.buildOverview(
      [
        member('paid'),
        member('owes'),
        member('none'),
        member('archived', { active: '0' }),
        member('gone', { deleted: '1' }),
        member('soon'),
      ],
      [
        { memberId: 'paid', periodStart: '2026-11-01', months: '1', periodEnd: '', amount: '3000', paidAt: '2026-11-01', deleted: '0' },
        { memberId: 'owes', periodStart: '2026-11-01', months: '1', periodEnd: '2026-11-30', amount: '3000', paidAt: '', deleted: '0' },
        { memberId: 'soon', periodStart: '2026-10-16', months: '1', periodEnd: '2026-11-15', amount: '3000', paidAt: '2026-10-16', deleted: '0' },
        { memberId: 'archived', periodStart: '2026-11-01', months: '1', periodEnd: '', amount: '3000', paidAt: '', deleted: '0' },
      ],
      today,
    );
    expect(view.rows.map((r) => r.kind)).toEqual(['duguje', 'istice_uskoro', 'placeno', 'bez_clanarine']);
    expect(view.totalDebt).toBe(3000);
    expect(view.rows[0].note).toBe('Treba da plati 3.000 RSD (članarinu od 1. nov 2026.)');
    expect(view.rows[1].note).toBe('Ističe za 2 dana, treba produžiti');
    expect(view.rows[2].paidUntil).toBe('30. nov 2026.');
  });

  it('agrees with memberStatus on random histories', () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const today = '2026-11-13';
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const list: Membership[] = [];
      let start = addDaysKey(today, -120 + rand(60));
      const count = rand(5);
      for (let j = 0; j < count; j++) {
        const months = [1, 1, 1, 2, 3, 12][rand(6)];
        list.push({
          id: `${i}-${j}`,
          memberId: `m${i}`,
          periodStart: start,
          months,
          periodEnd: periodEnd(start, months),
          amount: 1000 * (1 + rand(4)),
          paidAt: rand(3) ? start : null,
          note: null,
          createdAt: TS,
          updatedAt: TS,
          deleted: rand(10) === 0,
        });
        start = addDaysKey(periodEnd(start, months), 1 + (rand(4) === 0 ? rand(40) : 0));
      }
      const rows: Row[] = list.map((m) => ({
        memberId: m.memberId,
        periodStart: m.periodStart,
        months: String(m.months),
        periodEnd: rand(2) ? m.periodEnd : '', // hand-typed rows may lack periodEnd
        amount: String(m.amount),
        paidAt: m.paidAt ?? '',
        deleted: m.deleted ? '1' : '0',
      }));
      const expected = memberStatus(list, today);
      const view = gs.buildOverview([member(`m${i}`)], rows, today);
      seen.add(expected.kind);
      expect({ i, kind: view.rows[0].kind }).toEqual({ i, kind: expected.kind });
      if (expected.kind === 'duguje') expect(view.totalDebt).toBe(expected.debt);
      if (expected.kind === 'placeno' || expected.kind === 'istice_uskoro') {
        expect(view.rows[0].paidUntil).toBe(gs.formatDateKey(expected.until));
      }
    }
    expect([...seen].sort()).toEqual(['bez_clanarine', 'duguje', 'isteklo', 'istice_uskoro', 'placeno']);
  });
});
