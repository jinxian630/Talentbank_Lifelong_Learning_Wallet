export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  interests: string[];
  skills: string[];
  onboarded: boolean;
  expoPushToken?: string;
  xp?: number;
  level?: number;
  suiAddress?: string;
  suiNetwork?: string;
  zkLoginProvider?: string;
}
