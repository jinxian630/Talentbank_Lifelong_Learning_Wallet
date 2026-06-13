import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { XP_REWARDS } from '@talentbank/shared';
import type { TalentEvent } from '@talentbank/shared';
import { db } from '../../lib/firebase';
import { Colors, Radius, FontSize } from '../../constants/theme';

const XP_BREAKDOWN = [
  { label: 'Register for event', amount: XP_REWARDS.register, icon: '📝' },
  { label: 'Check in at event',  amount: XP_REWARDS.checkin,  icon: '✅' },
  { label: 'Submit event work',  amount: XP_REWARDS.submit,   icon: '📤' },
  { label: 'Admin approval',     amount: XP_REWARDS.approve,  icon: '🏅' },
];

function formatDate(ts: any): string {
  try {
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

export default function EarnXPScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<TalentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'events'),
      where('endAt', '>=', now),
      orderBy('endAt', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TalentEvent)));
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          {/* XP breakdown card */}
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>How to Earn XP</Text>
            {XP_BREAKDOWN.map((item) => (
              <View key={item.label} style={styles.breakdownRow}>
                <Text style={styles.breakdownIcon}>{item.icon}</Text>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <View style={styles.xpPill}>
                  <Text style={styles.xpPillText}>+{item.amount} XP</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Upcoming Events</Text>
        </View>
      }
      data={events}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.eventCard}
          onPress={() => router.push(`/event/${item.id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.eventCardLeft}>
            <Text style={styles.eventEmoji}>{item.emoji ?? '🎉'}</Text>
          </View>
          <View style={styles.eventCardInfo}>
            <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.eventMeta}>
              {formatDate(item.startAt)} · {item.locationType === 'online' ? 'Online' : item.venueAddress ?? 'TBC'}
            </Text>
          </View>
          <View style={styles.eventCardRight}>
            <View style={styles.xpSmallPill}>
              <Text style={styles.xpSmallText}>+{XP_REWARDS.checkin} XP</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 32 }} />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptyText}>Check back soon for new learning opportunities.</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list:      { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },

  breakdownCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 20,
  },
  breakdownTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', marginBottom: 12 },
  breakdownRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7,
  },
  breakdownIcon:  { fontSize: 18, width: 26 },
  breakdownLabel: { flex: 1, color: Colors.textSub, fontSize: FontSize.sm },
  xpPill: {
    backgroundColor: Colors.xp + '20', borderRadius: Radius.xxl,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  xpPillText: { color: Colors.xp, fontSize: FontSize.sm, fontWeight: '700' },

  sectionTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: 12 },

  eventCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14,
  },
  eventCardLeft:  { },
  eventEmoji:     { fontSize: 30 },
  eventCardInfo:  { flex: 1 },
  eventTitle:     { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700', lineHeight: 20, marginBottom: 4 },
  eventMeta:      { color: Colors.textMuted, fontSize: FontSize.xs },
  eventCardRight: { },
  xpSmallPill: {
    backgroundColor: Colors.quest + '20', borderRadius: Radius.xxl,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  xpSmallText: { color: Colors.quest, fontSize: FontSize.xs, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: 6 },
  emptyText:  { color: Colors.textSub, fontSize: FontSize.sm, textAlign: 'center' },
});
