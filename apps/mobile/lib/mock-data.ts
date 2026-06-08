// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface MockSkills {
  backend:    number; // 0–100
  frontend:   number;
  aiml:       number;
  blockchain: number;
  devops:     number;
}

export interface MockUserProfile {
  uid:         string;
  // TODO: BLOCKCHAIN — replace with wallet address from WalletConnect / RainbowKit
  walletAddress: string;
  displayName: string;
  level:       number;
  xp:          number;
  xpToNext:    number;
  streak:      number;
  skills:      MockSkills;
}

export type EventType = 'Hackathon' | 'Workshop' | 'Seminar' | 'Bootcamp' | 'Talk';
export type BadgeShape = 'hexagon' | 'star' | 'diamond' | 'pentagon' | 'circle' | 'square';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type BadgeTier  = 'bronze' | 'silver' | 'gold' | 'legendary';

export interface MockEvent {
  id:          string;
  emoji:       string;
  title:       string;
  type:        EventType;
  xpReward:    number;
  date:        string; // ISO date string
  skills:      string[];
  description: string;
  badgeShape:  BadgeShape;
  badgeColor:  string;
  badgeEmoji:  string;
}

export interface MockBadge {
  id:         string;
  eventId:    string;
  eventTitle: string;
  skill:      string;
  level:      SkillLevel;
  tier:       BadgeTier;
  xpValue:    number;
  shape:      BadgeShape;
  color:      string;
  emoji:      string;
  awardedAt:  string; // ISO date string
  // TODO: BLOCKCHAIN — real Arbitrum Sepolia TX hash from SBT mint
  // TODO: BLOCKCHAIN — link to https://sepolia.arbiscan.io/tx/{txHash}
  txHash:     string;
  // TODO: BLOCKCHAIN — on-chain token ID after mintSBT()
  tokenId:    number;
}

export interface StudyGoal {
  id:          string;
  label:       string;
  defaultDone: boolean;
}

export interface CheckinResult {
  // TODO: AI — from ai_assessment in GET /checkin/{id}/status response
  skill_name:   string;
  skill_level:  SkillLevel;
  xp_earned:    number;
  badge_tier:   BadgeTier;
  // TODO: BLOCKCHAIN — real TX hash returned after mintSBT()
  txHash:       string;
}

// ─── MOCK USER ────────────────────────────────────────────────────────────────

export const mockUser: MockUserProfile = {
  uid:          'mock-uid-001',
  // TODO: BLOCKCHAIN — replace with useAccount().address from RainbowKit / WalletConnect
  walletAddress: '0x1234...abcd',
  displayName:  'Alex Chen',
  level:        3,
  xp:           850,
  xpToNext:     1500,
  streak:       5,
  skills: {
    backend:    65,
    frontend:   40,
    aiml:       30,
    blockchain: 55,
    devops:     20,
  },
};

// ─── MOCK EVENTS ──────────────────────────────────────────────────────────────
// TODO: FIREBASE — replace with getEvents() from packages/firebase-config/src/firestore.ts

export const mockEvents: MockEvent[] = [
  {
    id:          'evt-001',
    emoji:       '⚡',
    title:       'Solidity Bootcamp: From Zero to Rekt',
    type:        'Bootcamp',
    xpReward:    300,
    date:        '2026-06-15',
    skills:      ['Solidity', 'Web3', 'Smart Contracts'],
    description: "Learn to write smart contracts that will definitely not get hacked. Probably.",
    badgeShape:  'hexagon',
    badgeColor:  '#a855f7',
    badgeEmoji:  '⚡',
  },
  {
    id:          'evt-002',
    emoji:       '🤖',
    title:       'Build an AI Agent in 2 Hours',
    type:        'Workshop',
    xpReward:    150,
    date:        '2026-06-20',
    skills:      ['Python', 'LLM', 'AI/ML'],
    description: "Prompt engineer your way to sentience. Claude not included.",
    badgeShape:  'star',
    badgeColor:  '#38bdf8',
    badgeEmoji:  '🤖',
  },
  {
    id:          'evt-003',
    emoji:       '🏆',
    title:       'TalentBank Hackathon 2026',
    type:        'Hackathon',
    xpReward:    500,
    date:        '2026-07-01',
    skills:      ['Blockchain', 'AI/ML', 'Frontend', 'Backend'],
    description: "48 hours. 0 sleep. Infinite energy drinks. Let's go.",
    badgeShape:  'diamond',
    badgeColor:  '#fbbf24',
    badgeEmoji:  '🏆',
  },
  {
    id:          'evt-004',
    emoji:       '🎓',
    title:       'Web3 Career Paths: How to Explain to Your Parents',
    type:        'Seminar',
    xpReward:    75,
    date:        '2026-06-25',
    skills:      ['Web3', 'Career'],
    description: "Spoiler: they still won't understand. But you will.",
    badgeShape:  'pentagon',
    badgeColor:  '#34d399',
    badgeEmoji:  '🎓',
  },
  {
    id:          'evt-005',
    emoji:       '🚀',
    title:       'Next.js 16 & Edge Functions Deep Dive',
    type:        'Workshop',
    xpReward:    200,
    date:        '2026-06-18',
    skills:      ['Frontend', 'Backend', 'DevOps'],
    description: "We use Next.js 16 because apparently v15 wasn't chaotic enough.",
    badgeShape:  'hexagon',
    badgeColor:  '#fb7185',
    badgeEmoji:  '🚀',
  },
];

// ─── MOCK BADGES ──────────────────────────────────────────────────────────────
// TODO: FIREBASE — replace with getUserBadges(user.uid) from packages/firebase-config/src/firestore.ts

export const mockBadges: MockBadge[] = [
  {
    id: 'badge-001', eventId: 'evt-past-001',
    eventTitle: 'Intro to Blockchain Workshop',
    skill: 'Blockchain', level: 'beginner', tier: 'bronze',
    xpValue: 100, shape: 'hexagon', color: '#a855f7', emoji: '⛓️',
    awardedAt: '2026-05-10',
    txHash: '0xabc123def456789012345678901234567890abcdef',
    tokenId: 1,
  },
  {
    id: 'badge-002', eventId: 'evt-past-002',
    eventTitle: 'React Fundamentals Bootcamp',
    skill: 'Frontend', level: 'intermediate', tier: 'silver',
    xpValue: 200, shape: 'star', color: '#38bdf8', emoji: '⚛️',
    awardedAt: '2026-04-22',
    txHash: '0xfed987654321abcdef0123456789fedcba987654',
    tokenId: 2,
  },
  {
    id: 'badge-003', eventId: 'evt-past-003',
    eventTitle: 'Python & ML Workshop',
    skill: 'AI/ML', level: 'beginner', tier: 'bronze',
    xpValue: 150, shape: 'pentagon', color: '#34d399', emoji: '🧠',
    awardedAt: '2026-04-05',
    txHash: '0x111aaa222bbb333ccc444ddd555eee666fff7777',
    tokenId: 3,
  },
  {
    id: 'badge-004', eventId: 'evt-past-004',
    eventTitle: 'Node.js API Bootcamp',
    skill: 'Backend', level: 'intermediate', tier: 'silver',
    xpValue: 250, shape: 'hexagon', color: '#6366f1', emoji: '🖥️',
    awardedAt: '2026-03-18',
    txHash: '0x888hhh999iii000jjjaaa111bbb222ccc333ddd4',
    tokenId: 4,
  },
  {
    id: 'badge-005', eventId: 'evt-past-005',
    eventTitle: 'DeFi Deep Dive Seminar',
    skill: 'Blockchain', level: 'intermediate', tier: 'gold',
    xpValue: 300, shape: 'diamond', color: '#fbbf24', emoji: '💎',
    awardedAt: '2026-03-01',
    txHash: '0xgold1111aaaa2222bbbb3333cccc4444dddd5555',
    tokenId: 5,
  },
  {
    id: 'badge-006', eventId: 'evt-past-006',
    eventTitle: 'DevOps & CI/CD Workshop',
    skill: 'DevOps', level: 'beginner', tier: 'bronze',
    xpValue: 100, shape: 'circle', color: '#fb7185', emoji: '⚙️',
    awardedAt: '2026-02-14',
    txHash: '0xdevops000111222333444555666777888999aaab',
    tokenId: 6,
  },
];

// ─── MOTIVATIONAL QUOTES ──────────────────────────────────────────────────────

export const MOTIVATIONAL_QUOTES: string[] = [
  "You're not procrastinating. You're letting the ideas marinate. 🧠",
  "Every smart contract bug is just a feature for hackers. Stay humble.",
  "GM. Your future self is watching and judging. Make them proud. ☀️",
  "Technically, sleeping is just offline debugging. You're welcome.",
  "Touch grass. Then touch blockchain. In that order.",
  "Your GitHub green squares are your actual personality now. Own it.",
];

// ─── STUDY GOALS ──────────────────────────────────────────────────────────────
// TODO: FIREBASE — sync study goals to Firestore users/{uid}/goals subcollection

export const STUDY_GOALS: StudyGoal[] = [
  { id: 'goal-1', label: 'Survive one workshop without Googling everything', defaultDone: false },
  { id: 'goal-2', label: 'Read one whitepaper (abstract counts)',            defaultDone: false },
  { id: 'goal-3', label: 'Commit code that actually runs first try',         defaultDone: false },
  { id: 'goal-4', label: 'Explain blockchain to someone without crying',     defaultDone: false },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function getLevelTitle(level: number): string {
  const titles: Record<number, string> = {
    1: 'Script Kiddie',
    2: 'Junior Goblin',
    3: 'Blockchain Explorer',
    4: 'Protocol Warrior',
    5: 'Chain Maximalist',
  };
  return titles[level] ?? 'Legendary Dev';
}

export function truncateTx(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export function truncateWallet(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
