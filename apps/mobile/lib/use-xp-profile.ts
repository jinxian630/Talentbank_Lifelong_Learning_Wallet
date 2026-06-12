import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, limit, onSnapshot, orderBy, query, where,
} from 'firebase/firestore';
import { xpCapForLevel } from '@talentbank/shared';
import type { Badge } from '@talentbank/shared';
import { auth, db } from './firebase';

export interface XPProfile {
  uid:         string | null;
  displayName: string;
  xp:          number;
  level:       number;
  xpToNext:    number;
  loading:     boolean;
}

export function useXPProfile(): XPProfile {
  const [state, setState] = useState<XPProfile>({
    uid:         null,
    displayName: '',
    xp:          0,
    level:       1,
    xpToNext:    500,
    loading:     true,
  });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setState({ uid: null, displayName: '', xp: 0, level: 1, xpToNext: 500, loading: false });
        return;
      }

      const userRef = doc(db, 'users', firebaseUser.uid);
      const unsubUser = onSnapshot(userRef, (snap) => {
        const data = snap.data();
        const xp    = (data?.xp    ?? 0)  as number;
        const level = (data?.level ?? 1)  as number;
        const cap   = xpCapForLevel(level);
        setState({
          uid:         firebaseUser.uid,
          displayName: data?.name ?? firebaseUser.displayName ?? '',
          xp,
          level,
          xpToNext:    cap,
          loading:     false,
        });
      });

      return unsubUser;
    });

    return () => unsubAuth();
  }, []);

  return state;
}

export function useRecentBadges(limitCount = 4): Badge[] {
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setBadges([]);
        return;
      }

      const q = query(
        collection(db, 'badges'),
        where('userId', '==', firebaseUser.uid),
        orderBy('awardedAt', 'desc'),
        limit(limitCount),
      );

      const unsubBadges = onSnapshot(q, (snap) => {
        setBadges(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Badge)));
      });

      return unsubBadges;
    });

    return () => unsubAuth();
  }, [limitCount]);

  return badges;
}
