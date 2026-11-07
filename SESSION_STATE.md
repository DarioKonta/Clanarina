# Session State

_Last updated: 2026-11-07_

## Current phase
**Phase 0 — project setup done. App not scaffolded yet.**

## Done
- [x] Read app idea, chose stack and architecture (see `CLAUDE.md`)
- [x] Created `CLAUDE.md`, `SESSION_STATE.md`, `README.md`, `.gitignore`, `.gitattributes`
- [x] `git init` (branch `main`) + initial commit
- [x] Google Stitch UI prompt → `docs/stitch-prompt.md`

## Decisions
| Decision | Why |
|---|---|
| Expo React Native + TypeScript | Big ecosystem, fast iteration, OTA updates, APK via EAS; safer offline storage than a PWA |
| expo-sqlite + Drizzle | Reliable on-device storage, typed schema, migrations |
| Apps Script web app for sync | No Google login in the app; simple for a few trusted users; shared secret |
| Last-write-wins on `updatedAt` | Few users, low conflict risk; simple to reason about |
| Delayed payment = `paidAt` null | Period starts on due date regardless of when money arrives |
| Serbian Latin script | Assumed — confirm (see open questions) |

## Roadmap
- [ ] Create GitLab repo, add remote, push (see README)
- [ ] Generate UI in Google Stitch, export screens/design for reference
- [ ] Scaffold Expo app (TypeScript, Expo Router) in this folder
- [ ] DB schema + migrations (Drizzle) + repositories
- [ ] Domain logic + Jest tests (status, periodEnd, debts)
- [ ] Screens: Članovi, Član detail, Nova članarina, Evidentiraj uplatu, Dugovanja, Podešavanja
- [ ] Apps Script backend (`apps-script/Code.gs`) + Sheet tabs `Clanovi`, `Clanarine`
- [ ] Sync engine (push/pull, triggers, status indicator)
- [ ] EAS `preview` build → APK, install on test phone
- [ ] Field test with real data offline → online

## Open questions
- Default membership price (RSD)? Different prices per member/group?
- How many phones will enter data at the same time?
- Latin or Cyrillic script? (assumed Latin)
- Track groups/trainings (e.g. kids/adults)? Currently out of scope.
- Should the "ističe uskoro" (expiring soon) threshold be 5 days?

## Next step
Create the GitLab repo and push. Then run the Stitch prompt and scaffold the Expo app.
