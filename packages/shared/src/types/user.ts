export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  interests: string[];
  skills: string[];
  onboarded: boolean;
}
