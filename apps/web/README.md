 TalentBank Badges

A lifelong learning wallet for students to earn verified badges from events.

## Tech Stack

- Next.js 15 + TypeScript
- TailwindCSS
- Firebase (Auth, Firestore, Storage)
- Gemini AI (2.5 Flash)

## Setup

1. Clone the repo

```bash
git clone https://github.com/yunyann375/Talentbank_Lifelong_Learning_Wallet.git
```

2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

4. Get your keys from:
   - Firebase: https://console.firebase.google.com
   - Gemini: https://aistudio.google.com

5. Add admin emails in `lib/admins.js`

6. Run development server:

```bash
npm run dev
```

## Features

- Google SSO login
- Student onboarding with interest tags
- Event browsing + registration
- Admin event management (CRUD)
- Attendance tracking + badge approval
- Collectible badge system
- AI event recommendations (Gemini 2.5 Flash)
