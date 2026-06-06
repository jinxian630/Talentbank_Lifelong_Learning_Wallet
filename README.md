# TalentBank — Lifelong Learning Wallet

A monorepo containing a **React Native mobile app** (Expo) and a **Next.js web admin/dashboard**, sharing TypeScript types and Firebase config across packages.

---

## Project Structure

```
talentbank/
├── apps/
│   ├── mobile/          # Expo 53 React Native app (iOS, Android, Web)
│   └── web/             # Next.js 16 admin dashboard
├── packages/
│   ├── shared/          # Shared TypeScript types (TalentEvent, UserProfile, Badge)
│   └── firebase-config/ # Shared Firebase initialization for the web app
├── package.json         # pnpm workspace root
└── turbo.json           # Turborepo pipeline config
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | >= 18 | https://nodejs.org |
| pnpm | >= 9 | `npm install -g pnpm` |
| Expo Go | Latest | App Store / Google Play |
| Expo CLI | Latest | `npm install -g expo` |

---

## 1. Clone & Install

```bash
git clone <your-repo-url>
cd talentbank
pnpm install
```

This installs dependencies for all apps and packages in one step.

---

## 2. Firebase Setup

### 2a. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com) and create a new project
2. Enable **Authentication** → Sign-in method → enable **Google**
3. Enable **Firestore Database** → Start in test mode (for development)

### 2b. Get your Firebase web config

In Firebase Console → Project Settings → Your apps → Add app → Web:

Copy the config values — you'll need them for both apps below.

---

## 3. Mobile App Setup (`apps/mobile`)

### Environment variables

Create `apps/mobile/.env`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_google_web_client_id
```

To get `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`:
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Find the **Web client** OAuth 2.0 client ID (created automatically by Firebase)
3. Copy its Client ID

### Google OAuth redirect URI (for Expo Go mobile)

In Google Cloud Console → Credentials → edit your Web client OAuth ID:

Under **Authorized redirect URIs**, add:
```
https://auth.expo.io/@your-expo-username/talentbank-mobile
```

Replace `your-expo-username` with your Expo account username (`npx expo whoami`).

> **Web mode** (`localhost`) does not need this — it uses a popup instead.

### App icons (placeholder for development)

The app requires icon files. For production, replace with real 1024×1024 PNG images:

```
apps/mobile/assets/images/icon.png
apps/mobile/assets/images/splash-icon.png
apps/mobile/assets/images/adaptive-icon.png
```

Placeholder files are already included for development.

### Run the mobile app

```bash
# IMPORTANT: always run from inside apps/mobile, not the workspace root
cd apps/mobile

npx expo start --clear
```

Then:
- Press `w` to open in browser (web mode, uses Firebase popup sign-in)
- Scan QR code with **Expo Go** app for mobile (iOS or Android)

> Do **not** run `expo start` from `D:\talentbank` (workspace root) — Metro will fail to find the Expo config.

---

## 4. Web App Setup (`apps/web`)

### Environment variables

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key   # Optional — powers the AI chatbot
```

### Run the web app

```bash
cd apps/web
pnpm dev
```

Opens at `http://localhost:3000`.

---

## 5. Run Everything Together (from workspace root)

```bash
# Both apps in parallel using Turborepo
pnpm dev

# Mobile only
pnpm dev:mobile

# Web only
pnpm dev:web
```

> `pnpm dev:mobile` opens the Expo CLI from the correct `apps/mobile` directory automatically.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo 53, React Native 0.79, Expo Router |
| Web | Next.js 16, React 19, Tailwind CSS |
| Auth | Firebase Auth + Google Sign-In |
| Database | Firebase Firestore |
| Types | Shared TypeScript package (`@talentbank/shared`) |
| Monorepo | pnpm workspaces + Turborepo |

---

## Common Issues

### "Something went wrong" in Expo Go
The mobile app uses the Firebase **JavaScript SDK** (not `@react-native-firebase`). If you see this error, make sure you are running `expo start` from inside `apps/mobile` and not the workspace root.

### `redirect_uri_mismatch` on Google Sign-In (mobile)
Add `https://auth.expo.io/@your-expo-username/talentbank-mobile` to your Google OAuth client's authorized redirect URIs in Google Cloud Console.

### `Unable to resolve "../../App"` bundling error
You ran `expo start` from the wrong directory. Always `cd apps/mobile` first.

### Firestore permission denied
Your Firestore security rules may be restricting access. During development, set rules to test mode in Firebase Console → Firestore → Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
Remember to tighten these rules before going to production.
