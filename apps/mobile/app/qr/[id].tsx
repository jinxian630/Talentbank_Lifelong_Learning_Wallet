import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import QRCode from 'react-native-qrcode-svg';
import { auth, db } from '../../lib/firebase';
import { Colors, FontSize, Radius } from '../../constants/theme';
import type { TalentEvent } from '@talentbank/shared';

export default function QRScreen() {
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

  const participant  = (event?.pendingParticipants ?? []).find((p: any) => p.uid === user?.uid) as any;
  const checkinCode  = participant?.checkinCode;
  const shortCode    = participant?.shortCode;
  const status       = participant?.status ?? 'registered';
  const isCheckedIn  = status === 'checked_in';

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

      <View style={styles.content}>
        {/* Event name */}
        {event?.title && (
          <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
        )}

        {/* Subtitle */}
        <Text style={styles.subtitle}>Show this to the admin at the event entrance</Text>

        {/* QR code */}
        <View style={styles.qrBox}>
          {checkinCode
            ? <QRCode value={checkinCode} size={220} color="#ffffff" backgroundColor="#0a0a0a" />
            : <ActivityIndicator color={Colors.accent} size="large" />}
        </View>

        {/* Manual short code */}
        {shortCode && (
          <View style={styles.shortCodeWrap}>
            <Text style={styles.shortCodeLabel}>Manual code</Text>
            <Text style={styles.shortCode}>
              {shortCode.slice(0, 4)} {shortCode.slice(4)}
            </Text>
          </View>
        )}

        {/* Checked-in banner */}
        {isCheckedIn && (
          <View style={styles.checkedInBanner}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.checkedInText}>You've been checked in!</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
  },
  backText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  eventTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  qrBox: {
    padding: 20,
    backgroundColor: '#0a0a0a',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortCodeWrap: {
    alignItems: 'center',
    gap: 4,
  },
  shortCodeLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  shortCode: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 4,
  },
  checkedInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.success + '18',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.success + '35',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  checkedInText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
