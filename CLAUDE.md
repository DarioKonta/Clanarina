# CLAUDE.md — Kick box članarina

Android app for a kickbox club to track who has paid their membership (članarina).
Used by a few people, installed as an APK (no Play Store). See `App idea.txt` for the original brief
and `SESSION_STATE.md` for current progress.

> **Session rule:** read `SESSION_STATE.md` at the start of every session and update it at the end
> (what was done, decisions, next step).

## Requirements (short)
- UI language: **Serbian, Latin script only**.
- **Offline-first**: data is entered without internet, stored locally, synced to Google Sheets later.
- Two-way sync: push local changes to Google Sheets, pull changes from Google Sheets.
- Log a member, membership duration (usually 1 month, can be more), and allow **delayed payment**:
  the membership period starts on the due date (e.g. 1 Nov) even if money is paid later.
- Simple, good-looking, easy to use (large tap targets, few steps).

## Stack
| Concern | Choice |
|---|---|
| Framework | Expo (latest stable SDK) + React Native + TypeScript (strict) |
| Navigation | Expo Router (file-based, `app/`) |
| Local DB | `expo-sqlite` + Drizzle ORM (migrations via drizzle-kit) |
| UI | React Native Paper (Material 3), custom theme |
| UI state | Zustand (light, non-persistent UI state only — data lives in SQLite) |
| Dates | date-fns with `sr-Latn` locale |
| Network | `@react-native-community/netinfo` |
| Secrets on device | `expo-secure-store` (Apps Script URL + shared secret) |
| Backend | Google Apps Script web app bound to the Google Sheet (`apps-script/Code.gs`) |
| Tests | Jest (`jest-expo`) for domain + sync logic |
| Build | EAS Build, `preview` profile → APK, sideloaded |

## Architecture
```
app/                    Expo Router screens
  (tabs)/index.tsx        Članovi — member list + status chips + search
  (tabs)/dugovanja.tsx    Dugovanja — who owes
  (tabs)/podesavanja.tsx  Podešavanja — sync URL, secret, manual sync, last sync
  clan/[id].tsx           Član detail + membership/payment history
  clanarina/nova.tsx      Nova članarina form
src/
  db/                   Drizzle schema, migrations, repositories (single source of truth on device)
  domain/               Pure logic: status, period end, debts — no React, no DB, fully unit-tested
  sync/                 Sync engine (push/pull) + Apps Script HTTP client
  i18n/sr.ts            ALL user-facing strings (Serbian Latin)
  ui/                   Shared components + theme
apps-script/Code.gs     Google Apps Script backend (copy into the Sheet's script editor)
```
Data flow: Screen → repository (`src/db`) → SQLite. The sync engine reads dirty rows from SQLite and
talks to Apps Script. Screens never call the network directly.

## Data model
All rows: `id` (UUID v4, generated on device), `createdAt`, `updatedAt` (ISO UTC), `deleted` (soft delete, 0/1).

**members**: id, firstName, lastName, phone?, note?, active, createdAt, updatedAt, deleted, dirty

**memberships**: id, memberId, periodStart (`YYYY-MM-DD`), months (default 1), periodEnd (derived:
periodStart + months − 1 day), amount (RSD, integer), paidAt (nullable ISO date), note?, createdAt,
updatedAt, deleted, dirty

- **Delayed payment** = membership with `paidAt = null`. Recording payment later sets `paidAt`;
  `periodStart`/`periodEnd` never change because of late payment.
- Derived status (in `src/domain`, never stored):
  - `placeno` — paidAt set
  - `duguje` — paidAt null and periodStart ≤ today
  - `istice_uskoro` — paid, periodEnd within 5 days
  - `isteklo` — no membership covering today
- `dirty` is local-only (never sent to Sheets).

## Sync rules (Apps Script)
- Every local write sets `updatedAt = now()` and `dirty = 1`.
- **Push**: `POST {action:"push", secret, members:[...], memberships:[...]}` with dirty rows.
  Script upserts by `id` into tabs `Clanovi` and `Clanarine`, last-write-wins on `updatedAt`.
  On success app clears `dirty` for those rows (only if `updatedAt` unchanged since send).
- **Pull**: `POST {action:"pull", secret, since:lastSyncAt}` → rows with `updatedAt > since`.
  App upserts locally only when remote `updatedAt` is newer than local.
- Order: push then pull. Store `lastSyncAt` = server time returned by the script.
- Triggers: manual button, app foreground, NetInfo offline→online. Never block the UI on sync.
- Deletes are soft (`deleted = 1`) so they propagate.
- Apps Script uses `LockService` to serialize writes.

## Conventions
- Code, identifiers, comments: **English**. User-facing text: **Serbian Latin**, only via `src/i18n/sr.ts`.
- Dates: store `YYYY-MM-DD` for calendar dates, ISO UTC for timestamps; format for display with date-fns `sr-Latn` (`d. MMMM yyyy.`).
- Money: integer RSD, displayed as `3.000 RSD`.
- Domain logic stays pure and tested; write tests before changing `src/domain` or `src/sync`.
- Keep screens small; put logic in hooks / domain.

## Commands
```bash
npm install
npx expo start                              # dev server (Expo Go / dev build)
npm test                                    # Jest
npx drizzle-kit generate                    # new migration after schema change
eas build -p android --profile preview      # APK for sideloading
```

## Do not
- Commit secrets: Apps Script URL/secret, `.env*`, keystores, `credentials.json`.
- Write to Google Sheets from anywhere except `src/sync`.
- Hard-delete rows (breaks sync).
- Hardcode Serbian strings in components.
- Add a login/auth system — out of scope for a few trusted users.
