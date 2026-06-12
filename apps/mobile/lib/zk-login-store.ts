import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_KEY = 'zklogin_session_v1';

export interface ZkLoginSession {
  ephemeralPrivateKey: string;
  ephemeralPublicKey: string;
  suiAddress: string;
  maxEpoch: number;
  randomness: string;
  zkProof: string;
}

// expo-secure-store is native-only; ZK Login sessions are not needed on web
export async function saveSession(session: ZkLoginSession): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<ZkLoginSession | null> {
  if (Platform.OS === 'web') return null;
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ZkLoginSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
