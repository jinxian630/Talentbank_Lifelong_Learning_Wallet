export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: string;
  users: [string, string];
  status: FriendshipStatus;
  requestedBy: string;
  requesterName: string;
  requesterPhoto: string;
  accepterName?: string;
  accepterPhoto?: string;
  createdAt: any;
  acceptedAt?: any;
}
