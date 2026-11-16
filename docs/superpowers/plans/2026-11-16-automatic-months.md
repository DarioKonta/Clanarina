# Automatic Months Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members are billed month by month automatically from a start date; the trainer only records payments, pauses and restarts.

**Architecture:** New synced `segments` table (start/pause per member). `memberships` rows become payments only. Owed months are computed by a pure month grid in `src/domain/months.ts`; status, debts, summary, export and the Sheet overview all derive from it.

**Tech Stack:** Expo SDK 58, TypeScript strict, expo-sqlite, React Native Paper, Jest (jest-expo), Apps Script.

**Spec:** `docs/superpowers/specs/2026-11-16-automatic-months-design.md`

## Global Constraints
- UI text Serbian Latin, only in `src/i18n/sr.ts`. Code/comments English.
- Dates `YYYY-MM-DD`; timestamps ISO UTC; money whole RSD.
- Soft deletes only. Append migrations, never edit existing ones.
- Domain + sync logic pure and tested; tests first.
- Code.gs `SCHEMA = 4`, app `MIN_SERVER_SCHEMA = 4`. Sheet tab for segments: `Periodi`.
- `EXPIRING_SOON_DAYS = 5`; months generated up to 12 ahead; no grace days; no refunds.
- Done = `npm test && npm run typecheck && npx eslint .`

## Review Focus
1. Segment starting on the 29th–31st: months stay anchored (31 Jan → 28 Feb → 31 Mar), no drift. Test in Task 1.
2. Pause on the same day the segment started (`endDate == startDate`): zero months, nothing owed. Test in Task 1.
3. Two payments for the same month from two phones: same `paymentId`, one row after sync. Test in Task 1 (id determinism) and Task 3.
4. Segment start edited after payments exist: payments covering a grid month's start still count; others leave months owed. Test in Task 1.
5. Unpaid month while paused still shows `duguje` (debt survives pause). Test in Task 1.

---

### Task 1: Month grid and status (domain)

**Files:** Modify `src/domain/types.ts`, `src/domain/status.ts`, `src/domain/status.test.ts`; Create `src/domain/months.ts`, `src/domain/months.test.ts`; Delete `src/domain/pricing.ts` usage if unused.

**Interfaces – Produces:**
- `types.ts`: `interface Segment { id; memberId; startDate: DateKey; endDate: DateKey | null; createdAt; updatedAt; deleted: boolean }`.
- `MemberStatus` = `duguje {debt, since, unpaidCount}` | `istice_uskoro {until, daysLeft}` | `placeno {until}` | `pauza {resumesAt: DateKey | null}` | `bez_clanarine`. (`isteklo` removed.)
- `months.ts`:
  - `type MonthState = 'placeno' | 'duguje' | 'predstojece'`
  - `interface MonthSlot { segmentId: string; start: DateKey; end: DateKey; state: MonthState; amount: number; payment: Membership | null }`
  - `buildMonths(segments: Segment[], payments: Membership[], price: number, today: DateKey, ahead = 12): MonthSlot[]` – ascending by start. Month k of a segment starts `addMonths(startDate, k)`, ends day before k+1. Included while `start < endDate` (open: while start ≤ today + `ahead` months). Paid if a live payment has `periodStart ≤ start ≤ periodEnd`; amount = payment.amount if paid else `price`.
  - `paymentId(memberId: string, periodStart: DateKey): string` – deterministic UUID-shaped (8-4-4-4-12 lowercase hex, version nibble 5) from a pure string hash.
  - `openSegment(segments): Segment | undefined`, `validateSegment(segments, edited: {id?: string; startDate; endDate}): 'invalidRange' | 'overlap' | null` (start < end when end set; no overlap with other live segments of the member; only the latest may be open).
- `status.ts`: `memberStatus(segments, payments, price, today): MemberStatus`; `oldestOwed(slots): MonthSlot | undefined`; `nextToPay(slots): MonthSlot | undefined` (oldest owed, else first `predstojece`); `collectDebts(members, segmentsBy: Map, paymentsBy: Map, defaultAmount, today)` → same `DebtItem`/total shape; `groupByMember<T extends {memberId}>(rows: T[])`; `priceOf(member, defaultAmount)`.

- [ ] Step 1: Write `months.test.ts`: spec example (start 2026-12-01, end 2027-01-01, second segment 2027-02-15 open, today 2027-03-01) → starts `['2026-12-01','2027-02-15','2027-03-15', …]`, `2026-12-01` owed when unpaid; anchor 2026-01-31 → `2026-02-28, 2026-03-31`; `endDate == startDate` → no slots; pause 2026-12-20 keeps the 2026-12-01 month; 3-month payment from a slot covers exactly 3 slots; moved segment start with old payment; `paymentId` stable and differs per month, matches `/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`; `validateSegment` overlap/range cases.
- [ ] Step 2: Rewrite `status.test.ts` for the new `memberStatus` (duguje while paused, placeno chaining across consecutive paid months, istice_uskoro at ≤5 days, pauza with/without future segment, bez_clanarine) and `collectDebts`.
- [ ] Step 3: Run `npx jest src/domain/months src/domain/status` → FAIL.
- [ ] Step 4: Implement `months.ts` and `status.ts`.
- [ ] Step 5: Run → PASS. Commit `feat(domain): month grid from billing segments`.

### Task 2: Domain consumers

**Files:** `src/domain/summary.ts`, `sort.ts`, `export.ts`, their tests (`extras.test.ts`, `sort.test.ts`), `src/ui/StatusChip.tsx`, `src/ui/theme.ts`.
**Consumes:** Task 1.
- `monthSummary(members, slotsByMember: Map<string, MonthSlot[]>, payments, month)`: due = slots with start in month; collected = payments with `paidAt` in month.
- `collectedByMonth(payments, lastMonth, n)` unchanged.
- `sort.ts`: STATUS_RANK `duguje 0, istice_uskoro 1, bez_clanarine 2, pauza 3, placeno 4`; `validUntil` drops `isteklo`.
- `buildExport(members, segments, payments, attendance)`: adds sheet `t.export.sheetSegments` (member, start, pause).
- StatusChip/theme: replace `isteklo` with `pauza` (color `colors.expired`).
- [ ] Update tests first, run (FAIL), implement, run (PASS), commit.

### Task 3: Sync protocol + engine

**Files:** `src/sync/protocol.ts`, `engine.ts`, `engine.test.ts`.
- `MIN_SERVER_SCHEMA = 4`; `TableName` adds `'segments'`; `normalizeSegment(raw): Segment | null` (needs id, memberId, valid startDate, updatedAt; empty endDate → null).
- Push and pull requests carry `segments` (push) and `defaultAmount: number` (both). `runSync(store, transport, secret, defaultAmount)`.
- `SyncStore.getDirty()` returns `segments` too.
- [ ] Tests first: segments push/markClean/pull newest-wins; `defaultAmount` sent on push and pull; schema 3 → `outdated`. Run FAIL → implement → PASS → commit.

### Task 4: Database + repo

**Files:** `src/db/database.ts` (append migration 3: `segments` table + `idx_segments_member`), `src/db/repo.ts`, `src/sync/service.ts` (pass default amount).
**Produces (repo):**
- `listSegments(memberId?)`, `createMember(fields, startDate: DateKey)` (also inserts first segment), `pauseMember(memberId, date = today)`, `resumeMember(memberId, startDate)`, `updateSegment(id, {startDate, endDate})`, `deleteSegment(id)` / `restoreSegment(id)`.
- `payMonths(memberId, periodStart, months, amount, paidAt): Promise<string>` – upsert row with `paymentId(memberId, periodStart)`, undeleting if it exists; `deletePayment(id)`, `restorePayment(id)`.
- `updateMember(..., {active:false})` also pauses the open segment.
- Remove `createMembership`, `markPaid`, `setPayment`, `markUnpaid`, `deleteMembership`, `restoreMembership`. `deleteMember` also soft-deletes the member's segments and returns their ids for undo.
- Sync store: segments in getDirty/COLS/countPending.
- [ ] Implement, `npm run typecheck`, commit.

### Task 5: Code.gs schema 4 + parity

**Files:** `apps-script/Code.gs`, `src/domain/sheetOverview.test.ts`, `apps-script/README.md`.
- `SCHEMA = 4`; `TABLES.segments = { sheet: 'Periodi', … }` header-driven like others; store `defaultAmount` from push/pull in Script Properties (refresh overview when it changes).
- `buildOverview(members, memberships, segments, today, defaultAmount)` mirrors `buildMonths` + `memberStatus` (kinds incl. `pauza`, no `isteklo`), with Serbian notes.
- [ ] Parity tests first (spec example, pause, prepay, anchoring), FAIL → implement → PASS → commit.

### Task 6: Screens

**Files:** `src/hooks/useData.ts`, `src/ui/PaymentDialog.tsx`, `src/ui/SegmentDialog.tsx` (new), `src/ui/ResumeDialog.tsx` (new), `src/app/(tabs)/index.tsx`, `dugovanja.tsx`, `pregled.tsx`, `podesavanja.tsx` (export args), `src/app/clan/[id].tsx`, `src/app/clan/uredi.tsx`, `src/app/_layout.tsx`; delete `src/app/clanarina/nova.tsx`; `src/i18n/sr.ts`.
- Hooks return `{ member, segments, payments, slots, status }` per member plus `defaultAmount`.
- `PaymentDialog({ member, slot, onDismiss })`: months chips 1/2/3/6/12, amount = price × months, date default today → `payMonths`; undo → `deletePayment`.
- Članovi card: tap Uplata → `oldestOwed` paid immediately + undo; none owed & open segment → dialog for `nextToPay`; paused/no segment → no button; long press → dialog. Filter chip `isteklo` → `pauza`.
- Member detail: Uplata, Pauziraj (one tap + undo) / Nastavi (ResumeDialog date, default today); history by segment newest first with month rows (plaćeno/duguje/predstoji), "pauza" gaps; ✎ → SegmentDialog (start, pause date, `validateSegment` errors); tap paid month → undo payment confirm.
- uredi: required `Početak` DateField for new members only.
- [ ] Implement, typecheck, eslint, commit.

### Task 7: Docs + final verification
- Update `CLAUDE.md` data model/status, in-app guide text if it mentions memberships, `SESSION_STATE.md`.
- [ ] `npm test && npm run typecheck && npx eslint .` all green. Commit.
