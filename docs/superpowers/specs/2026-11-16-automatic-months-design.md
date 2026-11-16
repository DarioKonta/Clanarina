# Automatic months, pause and restart — design

_2026-11-16_

## Why
Today the trainer creates a member, then creates a membership, and has to create a new one every time a period ends.
If they forget, the app doesn't know the member owes. That's too much work. The trainer should add a member once
and afterwards only record money.

## What the trainer does
- **Join:** the new-member form has a **Početak** date (default today). Months run from that day:
  start 15 Nov → 15 Nov – 14 Dec, 15 Dec – 14 Jan, …
- **Pay:** tap **Uplata**. The oldest owed month is marked paid.
- **Pause:** **Pauziraj** is one tap. Billing stops from today.
- **Restart:** **Nastavi** opens a date picker (default today). Months run from the chosen day.
  Example: start 1 Dec, pause 1 Jan, back 15 Feb → 1 Dec – 31 Dec, (break, owes nothing), 15 Feb – 14 Mar, 15 Mar – 14 Apr, …
- **Fix mistakes:** in the member's history, ✎ on a segment changes its start date or its pause date.
  (Paused on 10 Jan but really stopped on 1 Jan → move the pause to 1 Jan and January is no longer owed.)

## Goals / non-goals / anti-goals
- Goals: nothing to create each month; one tap to pay; pause/restart with a chosen date; editable dates; delayed payment still counts for the month it was due.
- Non-goals: refunds, credits or prorating (a started month counts in full: paid stays paid, unpaid is owed);
  calendar-month billing; converting existing data (user chose to **start fresh**).
- Anti-goals: a member owing twice because two phones were offline; the trainer having to remember to create anything.

## Approaches
- **A. Billing segments + payment rows, owed months computed (chosen).** Stores only what the trainer did
  (start/pause/restart, payments). Owed months are derived, so editing a date just recalculates and nothing can duplicate.
- B. Auto-create an unpaid row each month. Rejected: two offline phones both create "December"; editing dates means rewriting rows; the Sheet fills with empty months.
- C. Billing start on the member + a pauses table. Same information as A, but editing "the second restart" and showing history is clumsier.

The user left the technical choice to me; A is my pick.

## Data model
New synced table **segments** (sheet tab `Periodi`): `id, memberId, startDate, endDate?, createdAt, updatedAt, deleted`.
- `startDate`: first billed day. `endDate`: the pause date = first day **not** billed; `null` = still running.
- A member's segments must not overlap; at most one is open (`endDate = null`), and it is the latest.
- Pauziraj sets `endDate = today` on the open segment. Nastavi inserts a segment with the chosen `startDate` (≥ the previous `endDate`).

**memberships** stays, but now means **payments only**: `periodStart` = the month's start, `months` = how many months the payment covers,
`amount`, `paidAt` (always set for new rows). The new-membership screen (`clanarina/nova.tsx`) goes away.

## Month grid (pure, `src/domain`, tested first)
- In a segment, month *k* starts at `addMonths(startDate, k)`, anchored to the segment start, not chained
  (31 Jan → 28 Feb → 31 Mar). It ends the day before month *k+1* starts.
- A month belongs to the segment if its start is `≥ startDate` and `< endDate` (or the segment is open).
  So pausing on 20 Dec still owes the month that started on 1 Dec.
- A grid month is **paid** if a non-deleted payment covers its start date (`periodStart ≤ start ≤ periodEnd`).
- **Owed** = an unpaid grid month whose start is ≤ today. Its amount = `member.price ?? defaultAmount` at today's price; paid rows keep their stored amount.
- Grid months up to 12 months ahead are generated so the trainer can pay in advance.

## Status (replaces `memberStatus`)
| kind | when |
|---|---|
| `duguje` | any owed month (takes priority, also while paused) |
| `placeno` / `istice_uskoro` | today is in a paid month; "paid until" = end of the consecutive paid months; ≤ 5 days left = istice_uskoro |
| `pauza` (new) | no open segment, nothing owed; if a future segment exists the text says "nastavlja od …" |
| `bez_clanarine` | no segments |

`isteklo` disappears: a running member can't lapse, the next month is simply owed.
Note: a month is owed from its first day (no grace days). This matches what the user agreed ("duguje za novembar" on 5 Nov).

## Screens
- **Članovi card – Uplata:** tap → pays the oldest owed month now (paidAt today, amount = member price/default) + undo snackbar.
  Nothing owed but running → opens the payment dialog for the next month (advance payment). Paused / no segment → button hidden.
  Long press → payment dialog.
- **Payment dialog:** member, the month(s) it covers, months chips (1/2/3/6/12), amount (price × months), payment date. Delayed payment = pick an earlier/later date; the period never moves.
- **Member detail:** Uplata + Pauziraj/Nastavi buttons; history grouped by segment (newest first), each month shown as plaćeno/duguje/upcoming,
  breaks shown as "pauza"; ✎ per segment opens a dialog with start date and pause date (validated: start < pause, no overlap with neighbours); tap a paid month → undo the payment (soft delete).
- **New member form:** required **Početak** date (new members only) → creates the first segment.
- **Archive:** archiving also pauses today (no billing for archived members). Unarchiving does not restart; the trainer uses Nastavi.
- **Dugovanja, Pregled, Excel export, reminders:** use computed months. Pregled "due" = grid months starting in that month; "collected" = payments by `paidAt` as today.

## Sync / Sheet
- `segments` added to push/pull, the engine and `SyncStore`. Bump `SCHEMA` in Code.gs to 4 and `MIN_SERVER_SCHEMA` to 4; user must update the script.
- `buildOverview()` in Code.gs mirrors the new status logic (segments + payments + default price). `sheetOverview.test.ts` parity test updated.
  Code.gs needs the default amount: the app sends it with push and Code.gs keeps it in Script Properties (my call).
- Two phones paying the same month offline: payment ids are derived from `memberId + periodStart` (UUID-shaped hash),
  so both phones write the same row and newest wins instead of a double payment (my call; other ids stay UUID v4).

## Database
Append a migration creating `segments` (+ `dirty`). Starting fresh: old rows are not converted; the user clears app data and the Sheet tabs before using v1.3.
Old membership rows would still count as payments if they cover a grid start, so nothing breaks if some remain.

## Left to the builder
Exact component layout and Serbian wording (in `src/i18n/sr.ts`), the hash helper, how the history list is virtualized, test case selection.
