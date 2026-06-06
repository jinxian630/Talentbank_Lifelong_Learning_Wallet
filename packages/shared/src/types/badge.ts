export type BadgeShape = 'circle' | 'hexagon' | 'star' | 'shield' | 'pentagon' | 'diamond';

export interface Badge {
  id: string;
  eventId: string;
  eventTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  shape: BadgeShape;
  color: string;
  emoji: string;
  logoUrl?: string | null;
  awardedAt: Date | { toDate: () => Date };
}
