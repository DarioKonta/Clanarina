# Kick box članarina

Android app for tracking kickbox club membership payments (Serbian UI). It works offline and syncs with Google Sheets through a Google Apps Script web app.

- **Stack:** Expo SDK 58 + React Native + TypeScript, expo-sqlite, React Native Paper, EAS Build (APK)
- **Docs:** [CLAUDE.md](CLAUDE.md) (architecture, conventions), [SESSION_STATE.md](SESSION_STATE.md) (progress), [apps-script/README.md](apps-script/README.md) (Google Sheets setup), [docs/secret-key.md](docs/secret-key.md) (secret key)

## Run on your phone (development)
1. Install **Expo Go** from the Play Store.
2. Run:
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code with Expo Go. The phone and PC must be on the same Wi-Fi; if they aren't, use `npx expo start --tunnel`.

## Run on the computer (Android emulator)
An emulator named **Clanarina** (Android 16, Pixel 7) is set up in `%LOCALAPPDATA%\Android\Sdk`, without Android Studio.
1. Open a terminal in the project folder (it finds the Android SDK by itself; `scripts/android.mjs`).
2. Run `npm run android`. It starts the emulator if it isn't running, installs Expo Go and opens the app.
3. Edit code and save: the app reloads by itself in a second or two. No build needed.
   In the terminal: `r` reloads, `m` opens the dev menu, `Ctrl+C` stops.

Type with the PC keyboard. The emulator keeps its data between starts; to reset the app, long-press Expo Go → App info → Clear storage.
If the app shows a red error such as *Cannot find native module* after it worked before, run `npm run android -- --clear` (rebuilds the bundler cache).
A build (`npm run release`) is only needed to ship to phones, or to check the icon and splash screen.

## Tests
```bash
npm test            # logic tests
npm run typecheck
npx eslint .
```

## Google Sheets sync
Follow [apps-script/README.md](apps-script/README.md). Then enter the URL and the secret key in the app under **Podešavanja**. See [docs/secret-key.md](docs/secret-key.md) for where to find the key, how to enter it, and how to change it.

## Release an update (Obtainium)
Phones install and update the app with [Obtainium](https://github.com/ImranR98/Obtainium) from this repo's GitHub Releases.

```bash
npm run release -- patch                 # 1.0.0 → 1.0.1: commit, push, build APK on EAS, publish GitHub release
npm run release -- patch --notes "Šta je novo"
npm run release -- --build <eas-build-id> # publish an already finished EAS build as the current version
```
Needs `gh auth login` and `npx eas-cli@latest login` once, and a clean, committed working tree.
The tag `v<version>` must match `expo.version` in `app.json`; EAS raises the internal build number automatically.

**On each phone (once):** install Obtainium → **Add app** → paste `https://github.com/DarioKonta/Clanarina` → **Add** → **Install**.
Then open Članarina → Podešavanja → enter the sync URL and secret key ([docs/secret-key.md](docs/secret-key.md)).

## Repository
https://github.com/DarioKonta/Clanarina (public). The sync URL and secret key are never committed; they live only on the phones.
