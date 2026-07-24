import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
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

export const deleteExpiredEvents = onSchedule('every 24 hours', async () => {
  const db = getFirestore();
  const now = Timestamp.now();

  const expired = await db.collection('events')
    .where('endAt', '<', now)
    .get();

  if (expired.empty) return;

  // Firestore batch limit is 500 writes per commit
  const batches: FirebaseFirestore.WriteBatch[] = [];
  let batch = db.batch();
  let count = 0;

  for (const doc of expired.docs) {
    batch.delete(doc.ref);
    count++;
    if (count === 500) {
      batches.push(batch);
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) batches.push(batch);

  await Promise.all(batches.map(b => b.commit()));
});
