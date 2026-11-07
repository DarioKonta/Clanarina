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

## Build an APK
```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```
Open the link from the build on each phone and install it (allow "install from unknown sources").

## Push to GitLab (first time)
1. Create an empty project on GitLab. Don't add a README.
2. Run:
   ```bash
   git remote add origin https://gitlab.com/<user>/<project>.git
   git push -u origin main
   ```
