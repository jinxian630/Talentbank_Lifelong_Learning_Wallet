# TalentBank — Lifelong Learning Wallet

A monorepo containing a **React Native mobile app** (Expo) and a **Next.js web admin dashboard**, sharing TypeScript types and Firebase config across packages.

---

## Features

### Mobile App (Student-facing)

#### Explore Events
- Real-time event feed from Firestore with **debounced search** (300 ms)
- **Type filter pills** (Hackathon, Workshop, Talk, Seminar, Bootcamp, Others)
- **Date range & status dropdown filters** (Today / This Week / This Month, Open / Full)
- **Animated skeleton loading cards** while data fetches
- Section headers with event count badges
- Event cards with type-coloured left accent strip, attendee count, and "Full" indicator

#### My Events
- **Upcoming tab** — featured cards with type accent, 100 × 100 thumbnail, status pill, and QR hint
- **Past tab** — compact tappable cards; tap to view full submission details on the event detail screen
- **Submit Work tab** — pulsing amber badge when submissions are pending; "ACTION NEEDED" label on cards
- Animated shimmer skeletons during initial load
- Nested ring empty-state illustrations per tab

#### Event Detail
- Dynamic-ratio poster image with two-layer bottom fade overlay
- Summary card with type-coloured top border accent
- **Urgency-coded seats bar** (blue → amber at 60 % → red at 80 %)
- Participation funnel: Register → Check-in QR → Submit Work → Badge awarded
- **Submission view** for past events: photo, feedback, approval status
- Amber sparkle CTA button for registration

### Admin Web Dashboard

#### Events (`/admin/events`)
- Create / edit / delete events with registration forms, feedback tasks, and badge design
- Feedback form builder with photo, text, and textarea task types
- Event calendar view

#### Event Attendance (`/admin/events/[id]`)
| Tab | What it does |
|-----|-------------|
| **All Participants** | Excel-like table with dynamic columns — one column per registration form field. Hover a row → **Eye button** opens a full registration-response modal. |
| **Check-in** | QR code scanner + 8-digit manual code fallback for live check-in |
| **Submissions** | Review photo + feedback; award or reject badge per student |

**Export to Excel** — one click downloads all participants with all registration form responses as `.xlsx` (SheetJS).

#### Attendance Analytics (`/admin/students`)
Master-detail dashboard — **left sidebar** lists every event; click one to drill into its analytics on the **right panel**.

| Panel | Contents |
|-------|----------|
| **Overview (all events)** | 4 summary cards · Registration vs Check-in bar chart · Status donut chart · Attendance rate by event type progress bars |
| **Event detail** | Per-event stat cards · Status donut · Participation funnel (Registered → Checked In → Submitted → Approved) · **No-shows list** · **Attendees list** with status badges |

- Upcoming events appear in the sidebar with an "Upcoming" badge; past events show their attendance rate %
- Overview aggregate stats cover past events only

#### Requests (`/admin/requests`)
- Admin role request management (approve / reject pending admin accounts)

---

## Project Structure

```
talentbank/
├── apps/
│   ├── mobile/          # Expo 53 React Native app (iOS, Android, Web)
│   └── web/             # Next.js 16 admin dashboard
├── packages/
│   ├── shared/          # Shared TypeScript types (TalentEvent, Participant, Badge …)
│   └── firebase-config/ # Shared Firebase initialisation + Firestore helpers
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
4. Enable **Storage** (used for event submission photo uploads)

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

In Google Cloud Console → Credentials → edit your Web client OAuth ID.

Under **Authorized redirect URIs**, add:
```
https://auth.expo.io/@your-expo-username/talentbank-mobile
```

Replace `your-expo-username` with your Expo account username (`npx expo whoami`).

> **Web mode** (`localhost`) does not need this — it uses a popup instead.

### App icons (placeholder for development)

The app requires icon files. For production, replace with real 1024 × 1024 PNG images:

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

> Do **not** run `expo start` from the workspace root — Metro will fail to find the Expo config.

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

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo 53, React Native 0.79, Expo Router |
| Web | Next.js 16, React 19, Tailwind CSS v4 |
| Auth | Firebase Auth + Google Sign-In |
| Database | Firebase Firestore (real-time `onSnapshot` listeners) |
| Storage | Firebase Storage (submission photo uploads) |
| Charts | Recharts (admin attendance analytics) |
| Excel Export | SheetJS / xlsx (admin participant export) |
| Icons | Lucide React (web) · Expo Vector Icons / Ionicons (mobile) |
| Types | Shared TypeScript package (`@talentbank/shared`) |
| Monorepo | pnpm workspaces + Turborepo |

---

## Data Model (key Firestore collections)

| Collection | Purpose |
|---|---|
| `events` | Event docs with `pendingParticipants[]` (full participant objects including status, checkinCode, registrationData, submission) |
| `badges` | Awarded badge docs per student per event |
| `admins` | Admin role requests and approval status |
| `users` | Student profiles |

### Participant status flow

```
registered → checked_in → submitted → approved
                                    ↘ rejected
```

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

### My Events — Upcoming tab is empty after registering
The `participants array-contains` Firestore query requires no composite index. If you previously added an `orderBy` clause, remove it — sorting is handled client-side.
