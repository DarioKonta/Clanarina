/// <reference types="node" />
/**
 * Parity test: the "Pregled članova" tab in apps-script/Code.gs re-implements
 * buildMonths() + memberStatus() in plain Apps Script. Load Code.gs in a sandbox and check that both agree.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';
import { addMonths } from 'date-fns';
import { addDaysKey, fromDateKey, periodEnd, toDateKey } from './dates';
import { buildMonths } from './months';
import { memberStatus } from './status';
import type { Membership, Segment } from './types';

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
    segments: Row[],
    today: string,
    defaultAmount: number,
  ): { rows: OverviewRow[]; counts: Record<string, number>; totalDebt: number };
  periodEndKey(start: string, months: number): string;
  addMonthsKey(start: string, months: number): string;
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
        member('owes', { price: '2.500' }),
        member('none'),
        member('archived', { active: '0' }),
        member('gone', { deleted: '1' }),
        member('soon'),
        member('break'),
      ],
      [
        { memberId: 'paid', periodStart: '2026-11-01', months: '1', periodEnd: '', amount: '3000', paidAt: '2026-11-01', deleted: '0' },
        { memberId: 'soon', periodStart: '2026-10-16', months: '1', periodEnd: '2026-11-15', amount: '3000', paidAt: '2026-10-16', deleted: '0' },
        { memberId: 'break', periodStart: '2026-09-01', months: '1', periodEnd: '', amount: '3000', paidAt: '2026-09-03', deleted: '0' },
      ],
      [
        { memberId: 'paid', startDate: '2026-11-01', endDate: '', deleted: '0' },
        { memberId: 'owes', startDate: '2026-10-01', endDate: '2026-11-01', deleted: '0' },
        { memberId: 'soon', startDate: '2026-10-16', endDate: '2026-11-16', deleted: '0' },
        { memberId: 'archived', startDate: '2026-11-01', endDate: '', deleted: '0' },
        { memberId: 'break', startDate: '2026-09-01', endDate: '2026-10-01', deleted: '0' },
        { memberId: 'break', startDate: '2026-12-15', endDate: '', deleted: '0' },
      ],
      today,
      3000,
    );
    expect(view.rows.map((r) => r.kind)).toEqual(['duguje', 'istice_uskoro', 'placeno', 'pauza', 'bez_clanarine']);
    expect(view.totalDebt).toBe(2500);
    expect(view.rows[0].note).toBe('Treba da plati 2.500 RSD (1 mesec od 1. okt 2026.)');
    expect(view.rows[1].note).toBe('Ističe za 2 dana, treba produžiti');
    expect(view.rows[2].paidUntil).toBe('30. nov 2026.');
    expect(view.rows[3].note).toBe('Na pauzi, nastavlja 15. dec 2026.');
    expect(view.counts).toMatchObject({ duguje: 1, istice_uskoro: 1, placeno: 1, pauza: 1, bez_clanarine: 1 });
  });

  it('builds anchored months like the app', () => {
    for (const start of ['2026-01-31', '2026-01-30', '2024-01-31', '2026-03-31', '2026-11-01']) {
      for (const k of [0, 1, 2, 5, 13]) {
        expect(gs.addMonthsKey(start, k)).toBe(toDateKey(addMonths(fromDateKey(start), k)));
      }
    }
  });

  it('agrees with memberStatus on random histories', () => {
    // mulberry32: 32-bit math so every bit is random (a float LCG loses its low bits).
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed + 0x6d2b79f5) | 0;
      let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) % n;
    };
    const today = '2026-11-13';
    const seen = new Set<string>();
    for (let i = 0; i < 600; i++) {
      const memberId = `m${i}`;
      const price = rand(3) === 0 ? 2500 : null;
      const segments: Segment[] = [];
      let start = addDaysKey(today, -150 + rand(170));
      const count = rand(4);
      for (let j = 0; j < count; j++) {
        const last = j === count - 1;
        const endDate = last && rand(2) ? null : addDaysKey(start, rand(5) === 0 ? 0 : 1 + rand(100));
        segments.push({
          id: `${i}-s${j}`,
          memberId,
          startDate: start,
          endDate,
          createdAt: TS,
          updatedAt: TS,
          deleted: rand(12) === 0,
        });
        if (!endDate) break;
        start = addDaysKey(endDate, rand(40));
      }
      const payments: Membership[] = [];
      for (const slot of buildMonths(segments, [], price ?? 3000, today)) {
        if (rand(3) === 0) continue;
        if (payments.some((p) => p.periodStart <= slot.start && slot.start <= p.periodEnd)) continue;
        const months = [1, 1, 1, 2, 3][rand(5)];
        payments.push({
          id: `${i}-${slot.start}`,
          memberId,
          periodStart: slot.start,
          months,
          periodEnd: periodEnd(slot.start, months),
          amount: 1000 * (1 + rand(4)),
          paidAt: slot.start,
          note: null,
          createdAt: TS,
          updatedAt: TS,
          deleted: rand(10) === 0,
        });
      }
      const paymentRows: Row[] = payments.map((m) => ({
        memberId: m.memberId,
        periodStart: m.periodStart,
        months: String(m.months),
        periodEnd: rand(2) ? m.periodEnd : '', // hand-typed rows may lack periodEnd
        amount: String(m.amount),
        paidAt: m.paidAt ?? '',
        deleted: m.deleted ? '1' : '0',
      }));
      const segmentRows: Row[] = segments.map((s) => ({
        memberId: s.memberId,
        startDate: s.startDate,
        endDate: s.endDate ?? '',
        deleted: s.deleted ? '1' : '0',
      }));
      const expected = memberStatus(segments, payments, price ?? 3000, today);
      const view = gs.buildOverview(
        [member(memberId, price ? { price: String(price) } : {})],
        paymentRows,
        segmentRows,
        today,
        3000,
      );
      seen.add(expected.kind);
      expect({ i, kind: view.rows[0].kind }).toEqual({ i, kind: expected.kind });
      if (expected.kind === 'duguje') expect({ i, debt: view.totalDebt }).toEqual({ i, debt: expected.debt });
      if (expected.kind === 'placeno' || expected.kind === 'istice_uskoro') {
        expect(view.rows[0].paidUntil).toBe(gs.formatDateKey(expected.until));
      }
    }
    expect([...seen].sort()).toEqual(['bez_clanarine', 'duguje', 'istice_uskoro', 'pauza', 'placeno']);
  });
});
