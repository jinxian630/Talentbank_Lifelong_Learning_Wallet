export type EventType = 'Hackathon' | 'Workshop' | 'Talk' | 'Others';

export interface TalentEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startAt: Date | { toDate: () => Date };
  endAt: Date | { toDate: () => Date };
  participants: string[];
  pendingParticipants: Participant[];
  emoji?: string;
  badgeShape?: string;
  badgeColor?: string;
  badgeEmoji?: string;
  badgeLogoUrl?: string;
  capacity?: number;
  imageUrl?: string;
  createdAt: Date | { toDate: () => Date };
}

export interface Participant {
  uid: string;
  email: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
}
