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

## Native mobile push notifications (APK / iOS app)

The mobile app now supports native Expo push tokens for Android and iOS builds.

1. Android:

   - Add `google-services.json` to the project root when you are ready to build a push-enabled Android app.
   - Configure Firebase Cloud Messaging credentials in Expo/EAS for the Android app.

2. iOS:

   - Add `GoogleService-Info.plist` when you are ready to build a push-enabled iOS app.
   - Configure the Apple push credentials in Expo/EAS once your Apple Developer account is active.

3. Build a new app after credentials are configured:

   ```bash
   eas build --platform android --profile preview
   eas build --platform ios --profile production
   ```

Notes:

- `google-services.json` and `GoogleService-Info.plist` are ignored by git in this repo.
- Native push works on a real device build, not on Expo web and not reliably on a simulator.

## Beta feedback

Testers can open **Report a problem** from Profile or the Sign in screen, including
when they cannot sign in. The form asks where they got stuck and what happened;
guests also provide their name and phone number. It attaches the app version,
platform, OS version on mobile, and language. It does not attach logs, tokens,
device identifiers, or screenshots.

Reports use the existing `POST /support/ticket` endpoint and are saved in the
backend's `support_tickets` table. A successful submission displays the ticket
number. Failed requests keep the entered text and are never retried automatically.
No new database migration or native dependency is needed for this form.

To receive report notifications by email, configure these variables on the
backend service only: `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM_EMAIL`, and
`SUPPORT_EMAIL_TO`, plus `SMTP_USER` and `SMTP_PASSWORD` if the mail server requires
authentication. The existing email service uses STARTTLS. Tickets are saved even
if email is unavailable; the confirmation means the ticket was saved, not that an
email was delivered. There is currently no support-ticket inbox in the Admin tab.

Verify the form with `node scripts/check-problem-report.cjs`. On a test deployment,
submit once while signed in and once from the Sign in screen, confirm each report
number, and check the support inbox when email delivery is configured.
