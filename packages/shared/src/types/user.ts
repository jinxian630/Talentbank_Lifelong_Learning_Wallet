export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  interests: string[];
  skills: string[];
  onboarded: boolean;
  xp?: number;
  level?: number;
  suiAddress?: string;
  suiNetwork?: string;
  zkLoginProvider?: string;
}
