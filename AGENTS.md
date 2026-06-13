# TalentBank AI Agents & Pipelines

This document describes all AI agents and automated pipelines in the TalentBank Lifelong Learning Wallet platform.

---

## Azure AI Foundry Integration Pattern

All web agents use the same pattern as `/apps/web/app/api/chat/route.ts`:

```typescript
const response = await fetch(
  `${process.env.AZURE_FOUNDRY_ENDPOINT}openai/deployments/${process.env.AZURE_FOUNDRY_DEPLOYMENT}/chat/completions?api-version=2024-02-01`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.AZURE_FOUNDRY_API_KEY!,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.X,
    }),
  }
);
const data = await response.json();
const text = data.choices?.[0]?.message?.content ?? "";
```

JSON responses may be wrapped in markdown fences — strip them before parsing:
```typescript
raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
```

---

## Agent Registry

### 1. Badge Design Agent
| Field | Value |
|---|---|
| **Route** | `POST /api/ai/badge-design` |
| **File** | `apps/web/app/api/ai/badge-design/route.ts` |
| **Trigger** | Admin clicks "✨ AI Design" in event creation form |
| **Input** | `{ title: string, description: string, type: string }` |
| **Output** | `{ badgeShape, badgeColor, badgeEmoji, reasoning }` |
| **Temperature** | 0.8 (creative) |
| **UI** | Cyan-400 button in badge design section of event form modal |

Valid shapes: `hexagon, star, diamond, circle, square, pentagon`

Valid emojis: `🏆 🎯 🚀 🔬 💡 🌟 ⚡ 🎨 🔥 💎 🌱 🤝 🏅 🎓 👑 🔮 🌊 ⭐ 🦁 🎪`

---

### 2. Event Fill Agent
| Field | Value |
|---|---|
| **Route** | `POST /api/ai/event-fill` |
| **File** | `apps/web/app/api/ai/event-fill/route.ts` |
| **Trigger** | Admin clicks "🤖 AI Fill" after typing a rough description |
| **Input** | `{ description: string }` |
| **Output** | `{ title, description, type, emoji, badgeShape, badgeColor, badgeEmoji, suggestedCapacity }` |
| **Temperature** | 0.7 (balanced) |
| **UI** | Purple-400 button at top of event creation form modal |

Requires a non-empty description to be enabled.

---

### 3. Feedback Digest Agent
| Field | Value |
|---|---|
| **Route** | `POST /api/ai/feedback-digest` |
| **File** | `apps/web/app/api/ai/feedback-digest/route.ts` |
| **Trigger** | Admin clicks "Generate AI Digest" on event detail page |
| **Input** | `{ feedbackList: Array<{ feedback: string }> }` |
| **Output** | `{ summary, themes: string[], sentiment: 'positive'|'mixed'|'negative', actionItems: string[] }` |
| **Temperature** | 0.4 (factual) |
| **UI** | `FeedbackDigest` component on `apps/web/app/admin/events/[id]/page.tsx` |

Returns empty state immediately if no feedback exists (no Gemini call).

Firestore helper: `getFeedbackForEvent(eventId)` in `packages/firebase-config/src/firestore.ts`

---

### 4. Skill Gap Recommendation Engine (Mobile)
| Field | Value |
|---|---|
| **Location** | `apps/mobile/app/(tabs)/home.tsx` — `computeRecommendations()` |
| **Trigger** | Automatic on home tab load |
| **Input** | User `interests[]` from Firestore + upcoming events |
| **Output** | Top 3 matched events shown in "Recommended for You" section |
| **AI** | None — pure JS keyword matching (no API call) |
| **Algorithm** | Tokenize interests → score each event by keyword hits in `title+description+type` → sort descending → slice 3 |

---

### 5. Push Notification Pipeline
| Field | Value |
|---|---|
| **Send Route** | `POST /api/notifications/send` |
| **File** | `apps/web/app/api/notifications/send/route.ts` |
| **Trigger** | After `createEvent()` completes in admin events page |
| **Input** | `{ tokens: string[], title: string, body: string, data?: object }` |
| **Output** | `{ sent: number, result }` |
| **External API** | Expo Push API: `https://exp.host/--/api/v2/push/send` |

**Token registration flow:**
1. Mobile app installs and mounts `useNotifications` hook (`apps/mobile/hooks/useNotifications.ts`)
2. Hook requests permission, gets `ExponentPushToken[...]` via `expo-notifications`
3. Token saved to Firestore: `users/{uid}.expoPushToken`

**Matching flow:**
1. Admin creates event
2. `getUsersMatchingEventType(eventType)` queries `users` collection for tokens where user interests match event type
3. Matching tokens sent to `/api/notifications/send`

Firestore helpers: `updateUserPushToken(uid, token)`, `getUsersMatchingEventType(eventType)` in `packages/firebase-config/src/firestore.ts`

---

## Data Schema Additions

### `users` collection
```
expoPushToken?: string   // ExponentPushToken[...], saved by mobile useNotifications hook
```

---

## Environment Variables

| Variable | Used By | Purpose |
|---|---|---|
| `AZURE_FOUNDRY_ENDPOINT` | All web AI agents | Azure AI Foundry endpoint URL (e.g. `https://your-resource.openai.azure.com/`) |
| `AZURE_FOUNDRY_API_KEY` | All web AI agents | Azure AI Foundry API key |
| `AZURE_FOUNDRY_DEPLOYMENT` | All web AI agents | Model deployment name (e.g. `gpt-4o`) |

These are server-side only — no `NEXT_PUBLIC_` prefix needed. Expo Push API is unauthenticated for basic usage.

---

## Testing Checklist

- [ ] Badge Design: Create event "Python ML Workshop" → AI Design fills badge with relevant color/shape
- [ ] Event Fill: Type rough description → AI Fill populates all form fields
- [ ] Feedback Digest: Event with feedback in Firestore → Generate Digest shows sentiment + themes
- [ ] Skill Gap: Mobile user with `interests: ['Python']` + Python event in Firestore → "Recommended for You" shows it
- [ ] Push Notifications: Physical device (Expo Go) receives notification within ~5s of new event creation; `expoPushToken` field visible in Firestore users doc
