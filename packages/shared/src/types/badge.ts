export type BadgeShape = 'circle' | 'hexagon' | 'star' | 'shield' | 'pentagon' | 'diamond';

export interface BadgeOnChain {
  txHash?: string;
  objectId?: string;
  mintedAt?: Date | { toDate: () => Date };
  voucherObjectId?: string;
  voucherTxHash?: string;
  voucherIssuedAt?: Date | { toDate: () => Date };
}

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
  badgeImageUrl?: string | null;
  awardedAt: Date | { toDate: () => Date };
  xpValue?: number;
  onChain?: BadgeOnChain;
}
