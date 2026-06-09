export type EventType = 'Hackathon' | 'Workshop' | 'Talk' | 'Others' | 'Seminar' | 'Bootcamp';

export type ParticipantStatus =
  | 'pending'      // legacy — treated as 'registered'
  | 'registered'   // joined, awaiting check-in
  | 'checked_in'   // admin scanned QR at event
  | 'submitted'    // student uploaded photo + feedback
  | 'approved'     // admin reviewed and awarded badge
  | 'rejected';    // admin rejected submission

export interface ParticipantSubmission {
  photoUrl:    string;
  feedback:    string;
  submittedAt: any; // Firestore Timestamp
}

export interface RegistrationFormField {
  id:           string;
  label:        string;
  type:         'text' | 'textarea' | 'number' | 'email' | 'select' | 'checkbox';
  required:     boolean;
  options?:     string[]; // only for type === 'select'
  placeholder?: string;
}

export interface FeedbackFormTask {
  id: string;
  type: 'photo' | 'text' | 'textarea';
  title: string;
  description?: string;
  required: boolean;
  minLength?: number;
}

export interface FeedbackFormConfig {
  instructions?: string;
  tasks: FeedbackFormTask[];
}

export interface Participant {
  uid:               string;
  email:             string;
  name:              string;
  status:            ParticipantStatus;
  checkinCode:       string;
  shortCode?:        string;
  checkedInAt?:      any; // Firestore Timestamp
  submission?:       ParticipantSubmission;
  registrationData?: Record<string, string | boolean>;
}

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
  locationType?:    'physical' | 'online';
  venueAddress?:    string;
  meetingUrl?:      string;
  onlinePlatform?:  'google-meet' | 'teams' | 'zoom';
  registrationForm?: RegistrationFormField[];
  feedbackForm?: FeedbackFormConfig;
  organizer?: string;
}
