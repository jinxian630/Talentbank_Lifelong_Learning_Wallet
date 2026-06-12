import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Colors, FontSize, Radius } from '../../constants/theme';
import type { TalentEvent } from '@talentbank/shared';

function toDate(v: any): Date {
  if (!v) return new Date(0);
  if (typeof v.toDate === 'function') return v.toDate();
  return new Date(v);
}

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  submitted: { label: '⏳ Awaiting Review',  color: Colors.quest,   icon: 'time-outline'      },
  approved:  { label: '🎉 Badge Awarded!',   color: Colors.success, icon: 'ribbon'             },
  rejected:  { label: '❌ Not Approved',     color: Colors.streak,  icon: 'close-circle-outline'},
};

export default function SubmissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const user    = auth.currentUser;

  const [event,   setEvent]   = useState<TalentEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'events', id), snap => {
      if (snap.exists()) setEvent({ id: snap.id, ...snap.data() } as TalentEvent);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const participant = (event?.pendingParticipants ?? []).find((p: any) => p.uid === user?.uid) as any;
  const submission  = participant?.submission;
  const status      = participant?.status ?? 'submitted';
  const meta        = STATUS_META[status] ?? STATUS_META.submitted;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="chevron-back" size={22} color={Colors.text} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Event name */}
        {event?.title && (
          <Text style={styles.eventLabel} numberOfLines={2}>{event.title}</Text>
        )}

        <Text style={styles.pageTitle}>My Submission</Text>

        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: meta.color + '18', borderColor: meta.color + '35' }]}>
          <Ionicons name={meta.icon as any} size={18} color={meta.color} />
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        {/* Submission photo */}
        {submission?.photoUrl ? (
          <Image source={{ uri: submission.photoUrl }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={styles.noPhoto}>
            <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
            <Text style={styles.noPhotoText}>No photo submitted</Text>
          </View>
        )}

        {/* Feedback / reflection */}
        {submission?.feedback ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackLabel}>Your Reflection</Text>
            <Text style={styles.feedbackText}>{submission.feedback}</Text>
          </View>
        ) : (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackLabel}>Your Reflection</Text>
            <Text style={styles.noFeedback}>No reflection submitted.</Text>
          </View>
        )}

        {/* Submission date */}
        {submission?.submittedAt && (
          <Text style={styles.dateText}>
            Submitted on {toDate(submission.submittedAt).toLocaleDateString('en-MY', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  backText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },

  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  eventLabel: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  pageTitle:  { color: Colors.text, fontSize: FontSize.h1, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusText: { fontSize: FontSize.md, fontWeight: '700' },

  photo: {
    width: '100%',
    height: 240,
    borderRadius: Radius.lg,
    backgroundColor: '#1a1a1a',
  },
  noPhoto: {
    width: '100%',
    height: 140,
    borderRadius: Radius.lg,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  noPhotoText: { color: Colors.textMuted, fontSize: FontSize.sm },

  feedbackCard: {
    backgroundColor: '#13161f',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#1c2033',
    padding: 16,
    gap: 8,
  },
  feedbackLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  feedbackText:  { color: Colors.text, fontSize: FontSize.md, lineHeight: 22 },
  noFeedback:    { color: Colors.textMuted, fontSize: FontSize.sm, fontStyle: 'italic' },

  dateText: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center' },
});
