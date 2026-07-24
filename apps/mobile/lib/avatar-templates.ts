// Avatar template definitions.
// Two kinds are supported:
//   - URL:   { id, uri }   — remote image, saved directly to photoURL
//   - Local: { id, source } — require()'d asset, uploaded to Firebase Storage on selection
//
// To add your own avatar images:
//   1. Drop the file into apps/mobile/assets/avatars/ (e.g. avatar_1.png)
//   2. Uncomment a local entry below and point it at the file

export type AvatarTemplate =
  | { id: string; uri: string }
  | { id: string; source: ReturnType<typeof require> };

// DiceBear fun-emoji style — free, no sign-up needed.
// Replace or extend with local requires once you add images to assets/avatars/.
export const AVATAR_TEMPLATES: AvatarTemplate[] = [
  { id: 'bear',     uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=bear&size=200&backgroundColor=ffd5dc' },
  { id: 'panda',    uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=panda&size=200&backgroundColor=d1d4f9' },
  { id: 'fox',      uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=fox&size=200&backgroundColor=fde68a' },
  { id: 'rabbit',   uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=rabbit&size=200&backgroundColor=c7f7d0' },
  { id: 'cat',      uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=cat&size=200&backgroundColor=ffd5dc' },
  { id: 'dog',      uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=dog&size=200&backgroundColor=bfdbfe' },
  { id: 'tiger',    uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=tiger&size=200&backgroundColor=fed7aa' },
  { id: 'lion',     uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=lion&size=200&backgroundColor=fde68a' },
  { id: 'penguin',  uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=penguin&size=200&backgroundColor=ddd6fe' },
  { id: 'koala',    uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=koala&size=200&backgroundColor=d1fae5' },
  { id: 'raccoon',  uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=raccoon&size=200&backgroundColor=e0e7ff' },
  { id: 'hamster',  uri: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=hamster&size=200&backgroundColor=fce7f3' },

  // ── Local asset examples (uncomment after adding images) ─────────────────────
  // { id: 'custom_1', source: require('../assets/avatars/avatar_1.png') },
  // { id: 'custom_2', source: require('../assets/avatars/avatar_2.png') },
];
