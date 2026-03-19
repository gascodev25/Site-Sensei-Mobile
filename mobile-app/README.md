# ACGWorks Field — Android App

Native Android app for field service teams. Built with Expo / React Native.

## Screens

| Screen | Description |
|---|---|
| Login | Email + password (connects to `/api/login/local`) |
| Service List | Today / This Week / This Month tabs, team-filtered |
| Service Detail | Full service info, Maps + Call shortcuts, Start Service |
| Field Completion | 5-step: consumables → team sig → client sig → photos → review/submit |
| Success | Confirmation after field report submission |

## Configuration

### API Base URL

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL`:

```
# Physical device on same local network as dev machine:
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:5000

# Production (deployed Replit app):
EXPO_PUBLIC_API_BASE_URL=https://your-app.replit.app
```

Expo only exposes environment variables prefixed with `EXPO_PUBLIC_` to the
client bundle at build time, so this prefix is required.

### Team Assignment

Each field user must have a `linkedTeamId` set by a manager in the web app
(Users page → Edit User → Linked Team). Without this, the app shows a
"no team assigned" message after login.

## Running Locally

### Prerequisites
- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI (for builds): `npm install -g eas-cli`
- Expo Go app on your Android device (for quick preview)

### Start dev server

```bash
cd mobile-app
npm install
npm start
```

Scan the QR code with the Expo Go app on your Android device.

The "Start Android Dev" Replit workflow also runs `npx expo start` for you.

## EAS Build (Signed AAB for Google Play)

### One-time setup

1. Create an Expo account at [expo.dev](https://expo.dev)
2. Run `eas login` and `eas init` in the `mobile-app/` folder
3. Update `extra.eas.projectId` in `app.json` with your project ID
4. Create the keystore: `eas credentials`

### Trigger a build manually

```bash
cd mobile-app
eas build --platform android --profile production
```

This produces a signed `.aab` file ready for Google Play internal testing.

### GitHub Actions (automatic builds)

The workflow at `.github/workflows/build-android.yml` triggers on every push
to `main` that touches the `mobile-app/` directory.

Required GitHub secrets:
| Secret | Description |
|---|---|
| `EXPO_TOKEN` | Your personal Expo access token (from expo.dev → Account Settings) |

The build produces a signed AAB via EAS Build cloud. Download it from the
Expo dashboard or link it directly to the Google Play internal track.

## Project Structure

```
mobile-app/
├── App.tsx                  # Entry point — providers + root navigator
├── app.json                 # Expo config (bundle ID, permissions)
├── eas.json                 # EAS Build profiles (dev / preview / production)
├── .env                     # Local API_BASE_URL (gitignored)
├── .env.example             # Template for .env
├── src/
│   ├── api/
│   │   └── client.ts        # Axios API client + typed helpers
│   ├── navigation/
│   │   ├── AuthContext.tsx  # Session management + useAuth hook
│   │   └── RootNavigator.tsx# Root stack navigator (auth gating)
│   └── screens/
│       ├── LoginScreen.tsx
│       ├── ServiceListScreen.tsx
│       ├── ServiceDetailScreen.tsx
│       ├── FieldCompletionScreen.tsx  # Multi-step completion form
│       └── SuccessScreen.tsx
└── .github/
    └── workflows/
        └── build-android.yml
```
