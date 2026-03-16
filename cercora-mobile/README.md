# Cercora Mobile

Expo mobile/web client for Cercora.

## Development

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure env

   Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.

3. Start the app

   ```bash
   npx expo start
   ```

## Backend connection

This app talks to the FastAPI server in this repo (`/health`, `/auth/login`, `/auth/register`, etc.).

- Configure the API URL with `EXPO_PUBLIC_API_URL` (recommended).
  - For local development, set your machine’s LAN IP.
  - For production, set your deployed backend URL.
- If you’re running on a physical device, make sure the FastAPI server is reachable on your network (bind `uvicorn` to `0.0.0.0`).
  - Run from the repo root: `.\venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000`

In the Expo output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Production deployment

This project now includes:

- Expo app config in `app.json`
- EAS build profiles in `eas.json`
- Default native identifiers:
  - iOS bundle identifier: `com.cercora.mobile`
  - Android package: `com.cercora.mobile`

Before your first store release, verify those identifiers are the ones you want to keep.

### Build with EAS

1. Install Expo/EAS tooling if needed.

   ```bash
   npm install
   npm install -g eas-cli
   ```

2. Log in to Expo.

   ```bash
   eas login
   ```

3. Configure production env vars.

   Required:
   - `EXPO_PUBLIC_API_URL`

   Optional for web push:
   - `EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`

4. Build production binaries.

   ```bash
   eas build --platform android --profile production
   eas build --platform ios --profile production
   ```

5. Submit when ready.

   ```bash
   eas submit --platform android --profile production
   eas submit --platform ios --profile production
   ```

### Web deployment

For web builds:

```bash
npx expo export --platform web
```

The static output is generated for hosting behind your preferred web platform.

## True Web Push notifications (tab can be closed)

This project supports Web Push (Service Worker + VAPID) for the web build.

1. Generate VAPID keys (once):

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Set backend env vars (Railway):

   - `WEB_PUSH_VAPID_PUBLIC_KEY`
   - `WEB_PUSH_VAPID_PRIVATE_KEY`
   - `WEB_PUSH_VAPID_SUBJECT` (example: `mailto:support@yourdomain.com`)
   - `AUTO_WEB_PUSH_REMINDER_ENABLED=true`

3. Set mobile/web env var:

   - `EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` (same value as backend public key)

4. In the app: open Dashboard -> Push notifications -> Enable -> Send test.
