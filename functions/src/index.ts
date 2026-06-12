import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as crypto from 'crypto';

initializeApp();

/**
 * Returns a deterministic salt for the authenticated user.
 * Generated once and stored permanently — same Google account always
 * produces the same Sui address via jwtToAddress(jwt, salt).
 */
export const getSuiSalt = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }

  const uid = request.auth.uid;
  const db = getFirestore();
  const saltRef = db.collection('userSalts').doc(uid);
  const snap = await saltRef.get();

  if (snap.exists) {
    return { salt: snap.data()!.salt as string };
  }

  // BigInt decimal string — compatible with Sui SDK's jwtToAddress()
  const salt = BigInt('0x' + crypto.randomBytes(16).toString('hex')).toString();
  await saltRef.set({ salt, createdAt: new Date() });
  return { salt };
});
