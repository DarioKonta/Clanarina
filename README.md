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
