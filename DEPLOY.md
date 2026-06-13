# TalentBank — Deployment Runbook

Four surfaces, deployed in this order (each feeds the next):

| # | Surface | Host | Output |
|---|---|---|---|
| 0 | Pre-flight | local | build/type-check must pass |
| 1 | Firebase | Firebase | rules + indexes + functions |
| 2 | AI sidecar | Render | `https://talentbank-ai.onrender.com` |
| 3 | Web admin | Vercel | `https://<app>.vercel.app` |
| 4 | Mobile | EAS | Android APK |

> All deploy CLIs need **interactive login** (browser). Run them yourself; outputs feed later phases.

---

## Prerequisites (one-time)

- Node 18+ and `pnpm` 9 on PATH (`pnpm -v`).
- Accounts: Firebase (project `talentbank-7c970`, **Blaze plan** for Functions), Render, Vercel, Expo (EAS).
- Two secrets ready:
  - `firebase-service-account.json` — Firebase Console → Project Settings → Service Accounts → Generate new private key.
  - `SUI_ADMIN_PRIVATE_KEY` — `sui keytool export --key-identity <deployer-address>`.

---

## Phase 0 — Pre-flight gate (local, MUST pass)

```bash
pnpm install
pnpm type-check
pnpm build:web
cd apps/mobile && npx expo install expo-notifications && cd ../..
```

Fix everything before continuing. If `build:web` fails, deployment will fail identically on Vercel.

---

## Phase 1 — Firebase (rules + indexes + functions)

Functions run on Node 22 and require the **Blaze** (pay-as-you-go) billing plan.

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes,functions
```

Verify: command exits 0; rules visible in Firebase Console → Firestore → Rules.

---

## Phase 2 — AI sidecar (Render)

Code is already prod-ready: `services/ai/main.py` binds `$PORT`, CORS reads `ALLOWED_ORIGINS`, blueprint in `services/ai/render.yaml`.

1. Render → **New → Blueprint** → select this repo → it reads `render.yaml`.
2. Set env vars (dashboard):
   - `AZURE_OPENAI_ENDPOINT` = `https://lifelonglearningwallet-resource.openai.azure.com` (**no** `/openai/v1`)
   - `AZURE_OPENAI_API_KEY` = <azure key>
   - `AZURE_OPENAI_DEPLOYMENT` = `gpt-4o-mini`
   - `ALLOWED_ORIGINS` = (leave for now; set to Vercel URL in Phase 3)
   - `FIREBASE_SERVICE_ACCOUNT_PATH` = `/etc/secrets/firebase-service-account.json`
3. Settings → **Secret Files** → upload `firebase-service-account.json` (filename exactly that).
4. Deploy. Verify: `GET https://<render-url>/health` → `{"status":"ok","indexed_events":N}` with N > 0.

**Capture the Render URL.** Without the service-account, `/health` shows `indexed_events: 0`.

---

## Phase 3 — Web admin (Vercel)

`apps/web/vercel.json` sets framework + pnpm install.

```bash
npx vercel link        # Root Directory = apps/web (Vercel auto-detects pnpm workspace)
```

Set Environment Variables (Vercel dashboard → Project → Settings → Environment Variables), **Production**:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD1tsnUd-67oIo02vLraB-QhDmAbPYFhqI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=talentbank-7c970.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=talentbank-7c970
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=talentbank-7c970.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=802047612229
NEXT_PUBLIC_FIREBASE_APP_ID=1:802047612229:web:db1fbbb7b17be465295a2c
AZURE_FOUNDRY_ENDPOINT=https://lifelonglearningwallet-resource.openai.azure.com/openai/v1
AZURE_FOUNDRY_API_KEY=<azure key>
AZURE_FOUNDRY_DEPLOYMENT=gpt-4o-mini
AI_SERVICE_URL=<render-url from Phase 2>
NEXT_PUBLIC_SUI_PACKAGE_ID=0xda878e5395fce3e2b3e3f664b7176f603719b537e189bb5977d2da7d9861d011
NEXT_PUBLIC_SUI_REGISTRY_ID=0x663cc5c8d1b6e910b209c3d9a2628a82c6d0f00822a629376df48c4882d6c9bc
NEXT_PUBLIC_SUI_ADMIN_CAP_ID=0x124b4b2ad7f3796b9a1f8d2ce9a394de83fc9772cb4082fb9abbb93119390e0e
SUI_ADMIN_PRIVATE_KEY=<exported deployer key>
```

```bash
npx vercel --prod
```

Then: copy the Vercel prod URL → set it as `ALLOWED_ORIGINS` on Render → redeploy Render (closes CORS loop).

Verify: load admin URL → sign in → AI Fill on create-event works → chatbot reply has `source:"rag"` (proves sidecar wired; `"direct"` means sidecar unreachable).

---

## Phase 4 — Mobile (EAS, Android APK)

`apps/mobile/eas.json` + `app.json` (expo-notifications plugin) are ready.

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init          # writes extra.eas.projectId into app.json
```

Set EAS environment variables (public EXPO_PUBLIC_* — used at build time):

```bash
npx eas-cli env:create --name EXPO_PUBLIC_API_URL --value "<vercel-url>" --environment production
npx eas-cli env:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "AIzaSyD1tsnUd-67oIo02vLraB-QhDmAbPYFhqI" --environment production
# repeat for: EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, _PROJECT_ID, _STORAGE_BUCKET,
#   _MESSAGING_SENDER_ID, _APP_ID, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
#   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID, EXPO_PUBLIC_SUI_PACKAGE_ID, EXPO_PUBLIC_SUI_REGISTRY_ID
```

```bash
npx eas-cli build -p android --profile preview
```

Optional — push notifications (Android): `npx eas-cli credentials` → upload FCM key. Skip for first build.

Verify: download APK from EAS link → install on device → sign in → events list + wallet populate from Firestore.

---

## Post-deploy

- **Rotate the Azure key** (Azure Portal → AI Foundry → Keys) — it was shared in chat. Update on Render + Vercel after.
- `git status` clean — no `.env*` / `firebase-service-account.json` committed (all gitignored).
- Tighten Firestore rules later: `events`/`certExams` currently allow update by any authed user.
