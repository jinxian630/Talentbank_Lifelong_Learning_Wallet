import { jwtToAddress } from '@mysten/zklogin';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

export interface ZkPrep {
  nonce: string;
  ephemeralKeypair: unknown;
  maxEpoch: number;
  randomness: bigint;
}

// Web doesn't use nonce-based OAuth flow
export async function prepareZkLogin(): Promise<ZkPrep | null> {
  return null;
}

// Not used on web; address derivation is done via deriveAddressOnly after signInWithPopup
export async function completeZkLogin(): Promise<{ suiAddress: string }> {
  return { suiAddress: '' };
}

// Web-only: derive Sui address from any valid Google Firebase ID token.
// No ZK proof needed — just salt + jwtToAddress (pure JS, no SecureStore).
export async function deriveAddressOnly(idToken: string): Promise<string> {
  const fns = getFunctions(app);
  const getSuiSalt = httpsCallable<object, { salt: string }>(fns, 'getSuiSalt');
  const { data } = await getSuiSalt({});
  return jwtToAddress(idToken, data.salt);
}
