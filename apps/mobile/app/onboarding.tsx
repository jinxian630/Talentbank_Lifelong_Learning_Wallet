import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const INTEREST_TAGS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'React Native',
  'Node.js', 'Machine Learning', 'Data Science', 'Cybersecurity',
  'Cloud Computing', 'DevOps', 'UI/UX Design', 'Blockchain',
  'iOS Development', 'Android Development', 'Game Development',
  'Web Development', 'API Design', 'Databases', 'Algorithms',
];

export default function OnboardingScreen() {
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const router = useRouter();

  const toggleInterest = (tag: string) => {
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (selectedInterests.length < 1) {
      Alert.alert('Select at least one interest to continue.');
      return;
    }
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        interests: selectedInterests,
        skills: [],
        onboarded: true,
      },
      { merge: true }
    );
    router.replace('/(tabs)/events');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What are you interested in?</Text>
      <Text style={styles.subtitle}>Select topics to personalise your experience</Text>
      <ScrollView contentContainerStyle={styles.tags}>
        {INTEREST_TAGS.map((tag) => (
          <TouchableOpacity
            key={tag}
            onPress={() => toggleInterest(tag)}
            style={[
              styles.tag,
              selectedInterests.includes(tag) && styles.tagSelected,
            ]}
          >
            <Text
              style={[
                styles.tagText,
                selectedInterests.includes(tag) && styles.tagTextSelected,
              ]}
            >
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 16 },
  subtitle: { color: '#888', marginTop: 8, marginBottom: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  tagSelected: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  tagText: { color: '#aaa', fontSize: 14 },
  tagTextSelected: { color: '#fff' },
  button: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
