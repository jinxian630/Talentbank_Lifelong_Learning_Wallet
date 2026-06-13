export const XP_REWARDS = {
  register: 10,
  checkin:  50,
  submit:   100,
  approve:  200,
} as const;

export const LEVEL_NAMES: Record<number, string> = {
  1: 'Explorer',
  2: 'Learner',
  3: 'Builder',
  4: 'Practitioner',
  5: 'Expert',
};

const LEVEL_THRESHOLDS = [0, 500, 1500, 3000, 6000];

export function computeLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

// Upper XP bound for the current level — used as the XP bar denominator
export function xpCapForLevel(level: number): number {
  const nextThreshold = LEVEL_THRESHOLDS[level];
  return nextThreshold ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
}
