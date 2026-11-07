# Session State

_Last updated: 2026-11-07_

## Current phase
**Phase 1: first full version built.** The app is not yet tested on a real phone or against a real Google Sheet.

## Done
- [x] Read the app idea and chose the stack and architecture (see `CLAUDE.md`)
- [x] Docs, git init, Google Stitch prompt (`docs/stitch-prompt.md`)
- [x] Expo SDK 58 app scaffolded (TypeScript, Expo Router in `src/app`)
- [x] SQLite schema and migrations, repository layer
- [x] Domain logic with tests: status, debts, period end, suggested start, formatting, validation
- [x] Sync engine with tests: push/pull, newest change wins, error codes; HTTP client; auto-triggers
- [x] Screens: Članovi, Član detail, Novi/izmeni član, Nova članarina, Evidentiraj uplatu (dialog), Dugovanja, Podešavanja
- [x] Apps Script backend (`apps-script/Code.gs`) and setup guide; checked against a mock Sheets harness in Node
- [x] `eas.json` with APK profiles
- [x] Checks: 35 Jest tests pass, `tsc` clean, eslint clean, expo-doctor 20/20, `expo export --platform android` bundles

## Decisions
| Decision | Why |
|---|---|
| Expo React Native + TypeScript | Big ecosystem, fast iteration, APK via EAS; safer offline storage than a PWA |
| Plain expo-sqlite instead of Drizzle | Small schema; avoids extra bundler/migration tooling |
| Apps Script web app for sync | No Google login in the app; a shared secret is enough for a few trusted users |
| Newest change wins (`updatedAt`) | Few users, low conflict risk |
| Pull by server `syncedAt` | Phone clock skew can't make a phone miss rows |
| Delayed payment = `paidAt` null | The period starts on the due date regardless of when money arrives |
| Dark theme, red accent (#E53935) | Matches the Stitch prompt |
| Default amount 3.000 RSD | Placeholder; can be changed in Podešavanja |
| Serbian Latin script | Assumed; confirm |

## Roadmap
- [ ] Run in Expo Go on a phone (`npx expo start`) and click through all screens
- [ ] Create the Google Sheet and deploy Code.gs (`apps-script/README.md`), then test real sync
- [ ] Offline test: airplane mode → add data → back online → check the sheet
- [ ] Two-phone test: edit on both, sync, check that the results match
- [ ] Optionally apply the Google Stitch design tweaks
- [ ] Custom app icon and splash screen (currently Expo defaults)
- [ ] Build the APK with EAS (`preview`), install on each phone
- [ ] Create the GitLab repo and push

## Open questions
- Is 3.000 RSD the right default price? Do prices differ per member or group?
- How many phones will enter data at the same time?
- Latin or Cyrillic script? (assumed Latin)
- Track groups (kids/adults)? Currently out of scope.
- Is 5 days the right "ističe uskoro" threshold?

## Known gaps
- No UI/component tests; only the logic is tested.
- Code.gs was tested only against a mock, not the real Google runtime.
- The default Expo icon and splash screen are still in place.

## Next step
Run `npx expo start`, open the app in Expo Go on an Android phone and try the main flow:
new member → new membership (unpaid) → Dugovanja → Uplata.
