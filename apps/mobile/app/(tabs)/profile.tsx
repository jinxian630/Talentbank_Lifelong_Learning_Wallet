import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import type { UserProfile } from '@talentbank/shared';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeDoc?.();
      if (!user) {
        setLoading(false);
        return;
      }
      unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
        setLoading(false);
      });
    });
    return () => {
      unsubscribeAuth();
      unsubscribeDoc?.();
    };
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {profile?.photoURL ? (
        <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder} />
      )}
      <Text style={styles.name}>{profile?.name}</Text>
      <Text style={styles.email}>{profile?.email}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interests</Text>
        <View style={styles.tags}>
          {(profile?.interests ?? []).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Skills</Text>
        <View style={styles.tags}>
          {(profile?.skills ?? []).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {(profile?.skills ?? []).length === 0 && (
            <Text style={styles.emptyText}>No skills added yet.</Text>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, alignItems: 'center' },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#333', marginBottom: 12 },
  name: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  email: { color: '#888', fontSize: 14, marginBottom: 24 },
  section: { width: '100%', marginBottom: 24 },
  sectionTitle: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#333' },
  tagText: { color: '#aaa', fontSize: 13 },
  emptyText: { color: '#555', fontSize: 14 },
  signOutButton: { marginTop: 16, width: '100%', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center' },
  signOutText: { color: '#ef4444', fontWeight: '600' },
});
