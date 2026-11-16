# CLAUDE.md — Članarina

Android app for a sports club (any discipline) to track who has paid their membership (članarina).
It's used by a few people and installed as an APK, not through the Play Store. See `App idea.txt` for the original brief,
`SESSION_STATE.md` for current progress, and `AGENTS.md` for Expo-specific agent rules.

> **Session rule:** read `SESSION_STATE.md` at the start of every session. Update it at the end with
> what was done, any decisions, and the next step.

> **Expo SDK 58:** don't trust memory for Expo APIs. Check https://docs.expo.dev/llms.txt and the
> versioned docs before using one. Always use `npx expo install <pkg>`, never a plain `npm install`, for RN/Expo packages.

## Requirements (short)
- The UI language is **Serbian, Latin script only**.
- **Offline-first:** data is entered without internet, stored locally, and synced to Google Sheets later.
- Sync goes both ways: local changes are pushed to Google Sheets, and changes from Google Sheets are pulled to the phone.
- The app records a member and their membership duration (usually 1 month, can be more), and allows **delayed payment**:
  the period starts on the due date (e.g. 1 Nov) even if the money comes later.
- It should be simple, look good and be easy to use: large tap targets, few steps.

## Stack
| Concern | Choice |
|---|---|
| Framework | Expo SDK 58 + React Native 0.88 + React 19 + TypeScript (strict) |
| Navigation | Expo Router, file-based, routes in `src/app/` |
| Local DB | `expo-sqlite`, plain SQL with migrations in `src/db/database.ts` (`PRAGMA user_version`) |
| UI | React Native Paper (Material 3), dark theme in `src/ui/theme.ts` |
| UI state | Zustand (`src/state/store.ts`): data version counter + sync status only |
| Dates | date-fns plus our own helpers; calendar dates are `YYYY-MM-DD` strings |
| Network | `@react-native-community/netinfo` |
| Secrets on device | `expo-secure-store` (Apps Script URL + shared secret) |
| Backend | Google Apps Script web app bound to the Sheet (`apps-script/Code.gs`) |
| Tests | Jest (`jest-expo`) for `src/domain` and `src/sync` |
| Build | EAS Build, `preview` profile → APK (`eas.json`) |

## Architecture
```
src/app/                 Expo Router screens
  _layout.tsx              Root: Paper theme, DB migration gate, sync triggers
  (tabs)/index.tsx         Članovi: search, filter chips, member cards, quick "Uplata"
  (tabs)/dugovanja.tsx     Dugovanja: who owes, total, quick payment, reminder (SMS/share)
  (tabs)/prisustvo.tsx     Prisustvo: training attendance per day (tap to mark present)
  (tabs)/pregled.tsx       Pregled: monthly money in, due/paid, debt, 6-month chart
  (tabs)/podesavanja.tsx   Podešavanja: sync URL/secret, test, sync now, default amount, Excel export, accent color
  uputstvo.tsx             In-app Google Sheets setup guide + troubleshooting
  clan/[id].tsx            Member detail: Uplata, Pauziraj/Nastavi, history by segment (✎ edit dates)
  clan/uredi.tsx           Create/edit member (?id= for edit); new members get a "Početak" date
src/domain/              Pure logic (no React/DB): dates, months (grid), status, debts, format, validation (+ tests)
src/db/                  database.ts (open + migrations + meta), repo.ts (all reads/writes + SyncStore impl)
src/sync/                engine.ts (pure push/pull, tested), protocol.ts, client.ts (HTTP), service.ts (triggers/status), settings.ts
src/hooks/useData.ts     Data loading hooks that reload when data changes
src/i18n/sr.ts           ALL user-facing strings
src/ui/                  Shared components (StatusChip, DateField, PaymentDialog, SyncPill, ...)
apps-script/             Code.gs + setup README
```
**Data flow:** screen → `src/db/repo.ts` → SQLite. Each write bumps `useDataStore.version`, so screens reload.
Local writes also bump `localVersion`, which triggers a debounced auto-sync from the root layout. Screens never call the network.

## Data model
Every row has `id` (UUID v4, made on the device), `createdAt`, `updatedAt` (ISO UTC) and `deleted` (soft delete, 0/1).
The local-only `dirty` flag (0/1) is never sent to the server.

**members:** id, firstName, lastName, phone?, note?, groupName?, price? (whole RSD; null = default), birthDate?, joinedAt?,
active (archived = 0), createdAt, updatedAt, deleted

**attendance:** id, memberId, date `YYYY-MM-DD`, createdAt, updatedAt, deleted. One row per member+day; unchecking sets
`deleted = 1` and checking again reuses the row (`setPresent` in repo).

**segments** (sheet tab `Periodi`): id, memberId, startDate, endDate? (pause date = first day not billed; null = running),
createdAt, updatedAt, deleted. Creating a member makes the first one; Pauziraj sets `endDate`; Nastavi adds a new one.
Segments of a member never overlap (`validateSegment`).

**memberships** = **payments only**: id, memberId, periodStart (a grid month start), months, periodEnd (derived),
amount (whole RSD), paidAt, note?, createdAt, updatedAt, deleted. The id is `paymentId(memberId, periodStart)`
(deterministic), so two phones paying the same month offline end up with one row.

- **Months are never stored.** `buildMonths` (`src/domain/months.ts`) derives them: month k of a segment starts at
  startDate + k months (anchored: 31 Jan → 28 Feb → 31 Mar), belongs to the segment if it starts before the pause date
  (a started month counts in full, no refunds), and is paid if a payment covers its start date. Unpaid months cost the
  member's current price (own or default). Open segments are generated 12 months ahead for advance payments.
- **Delayed payment:** an unpaid month that has started is owed from its first day; paying later doesn't move it.
- Status is derived in `src/domain/status.ts` and never stored:
  - `duguje`: an owed month exists (takes priority, also while paused)
  - `placeno`: today is in a paid month (directly following paid months are chained)
  - `istice_uskoro`: paid coverage ends within 5 days
  - `pauza`: no running segment and nothing owed (`resumesAt` = a future segment start, if any)
  - `bez_clanarine`: no segments
- Archiving a member also pauses them today.

## Sync rules (Apps Script)
- Each local write sets `updatedAt = now` and `dirty = 1`.
- **Push:** dirty rows go to the server. The server upserts by `id` (newest `updatedAt` wins) and stamps `syncedAt = serverTime`.
  Afterwards the client clears `dirty` only where `updatedAt` hasn't changed since the push.
- **Pull:** `since = lastSyncAt` and the server returns rows with `syncedAt > since`. This uses server time, so a skewed phone clock is harmless.
  The client applies remote rows that are newer by `updatedAt` and recomputes `periodEnd`.
- Push always runs before pull. `lastSyncAt` is set to the `serverTime` from the response.
- Sync is triggered by app start, returning to the foreground, coming back online, 3 s after a local edit, the header pill and the settings button.
- Deletes are soft (`deleted = 1`).
- In the sheet, cells are plain text and `onEdit` stamps rows edited by hand.
- The **Pregled članova** tab is a read-only view for trainers, built by `refreshOverview()` in Code.gs (after push, on open,
  after hand edits, daily and from the menu). `buildOverview()` mirrors `buildMonths()` + `memberStatus()` (using the
  `defaultAmount` the app sends on push/pull, kept in Script Properties), and `src/domain/sheetOverview.test.ts`
  checks they agree. Change both together. It's not synced, so changing it doesn't need a `MIN_SERVER_SCHEMA` bump.
- Code.gs matches columns by header name and appends missing ones. Every response has `schema`; the app requires
  `MIN_SERVER_SCHEMA` (`src/sync/protocol.ts`) and otherwise fails with `outdated` *before* clearing dirty rows.
  Adding synced fields/tables = bump `SCHEMA` in Code.gs **and** `MIN_SERVER_SCHEMA`, and tell users to update the script.

## Conventions
- Code, identifiers and comments are in **English**. User-facing text is in **Serbian Latin** and lives only in `src/i18n/sr.ts`.
- Dates: `YYYY-MM-DD` for calendar dates and ISO UTC for timestamps. Display them with `src/domain/format.ts`.
- Money is whole RSD, displayed as `3.000 RSD`.
- Domain and sync logic stay pure and tested. Write the test first when changing them.
- DB schema changes: **append** a migration to `MIGRATIONS`. Never edit an existing one.
- `.npmrc` has `legacy-peer-deps=true` because of an optional react-dom peer conflict from Paper.

## Commands
```bash
npm install
npx expo start              # dev server; scan the QR code with Expo Go
npm test                    # Jest
npm run typecheck           # tsc --noEmit
npx eslint .                # lint (npx expo lint has an eslint version-check bug right now)
npx expo-doctor             # dependency health
npx eas-cli@latest build -p android --profile preview   # APK for sideloading
```
Before declaring any task done: `npm test && npm run typecheck && npx eslint .`

## Do not
- Commit secrets: the Apps Script URL/secret, `.env*`, keystores, `credentials.json`.
- Talk to Google Sheets from anywhere except `src/sync`.
- Hard-delete rows (this breaks sync).
- Hardcode Serbian strings in components.
- Add a login/auth system. That's out of scope for a few trusted users.
- Create or edit `android/` or `ios/` by hand. They are generated.
