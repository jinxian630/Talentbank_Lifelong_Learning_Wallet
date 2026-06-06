import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TalentEvent, EventType } from '@talentbank/shared';

const TYPE_COLORS: Record<EventType | string, string> = {
  Hackathon: '#f59e0b',
  Workshop: '#a855f7',
  Talk: '#3b82f6',
  Others: '#6b7280',
};

export default function EventsScreen() {
  const [events, setEvents] = useState<TalentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('startAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<TalentEvent, 'id'>),
      }));
      setEvents(data);
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

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/event/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.emoji}>{item.emoji || '📅'}</Text>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: TYPE_COLORS[item.type] + '22' },
                ]}
              >
                <Text
                  style={[styles.typeText, { color: TYPE_COLORS[item.type] }]}
                >
                  {item.type}
                </Text>
              </View>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.participants}>
              {item.pendingParticipants?.length ?? 0} registered
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  emoji: { fontSize: 24 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typeText: { fontSize: 12, fontWeight: '600' },
  title: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  description: { color: '#888', fontSize: 14, marginBottom: 8 },
  participants: { color: '#555', fontSize: 12 },
});
