import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import type { TalentEvent } from '@talentbank/shared';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<TalentEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const user = auth.currentUser;

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'events', id), (snap) => {
      if (snap.exists()) {
        setEvent({ id: snap.id, ...(snap.data() as Omit<TalentEvent, 'id'>) });
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [id]);

  const isRegistered = event?.pendingParticipants?.some(
    (p: any) => p.uid === user?.uid
  );

  const handleJoin = async () => {
    if (!user || !id) return;
    await updateDoc(doc(db, 'events', id), {
      pendingParticipants: arrayUnion({
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        status: 'pending',
      }),
    });
    Alert.alert('Registered!', 'Your registration is pending approval.');
  };

  const handleLeave = async () => {
    if (!user || !id || !event) return;
    const participant = event.pendingParticipants?.find((p: any) => p.uid === user.uid);
    if (!participant) return;
    await updateDoc(doc(db, 'events', id), {
      pendingParticipants: arrayRemove(participant),
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Event not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.emoji}>{event.emoji || '📅'}</Text>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.type}>{event.type}</Text>
      <Text style={styles.description}>{event.description}</Text>

      <TouchableOpacity
        style={[styles.button, isRegistered && styles.buttonLeave]}
        onPress={isRegistered ? handleLeave : handleJoin}
      >
        <Text style={styles.buttonText}>
          {isRegistered ? 'Leave Event' : 'Join Event'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  back: { marginBottom: 16 },
  backText: { color: '#6366f1', fontSize: 16 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  type: { color: '#a855f7', fontSize: 14, fontWeight: '600', marginBottom: 16 },
  description: { color: '#aaa', fontSize: 16, lineHeight: 24, marginBottom: 32 },
  errorText: { color: '#ef4444' },
  button: { backgroundColor: '#6366f1', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonLeave: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
