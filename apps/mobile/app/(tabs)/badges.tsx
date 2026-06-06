import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import type { Badge } from '@talentbank/shared';

export default function BadgesScreen() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'badges'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Badge, 'id'>),
      }));
      setBadges(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  if (badges.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No badges yet.</Text>
        <Text style={styles.emptySubtext}>Join events to earn badges!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={badges}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <View style={[styles.badge, { backgroundColor: item.color + '22', borderColor: item.color + '44' }]}>
            <Text style={styles.badgeEmoji}>{item.emoji}</Text>
            <Text style={styles.badgeTitle} numberOfLines={2}>
              {item.eventTitle}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#888', marginTop: 8 },
  badge: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 120,
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 36, marginBottom: 8 },
  badgeTitle: { color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: '600' },
});
