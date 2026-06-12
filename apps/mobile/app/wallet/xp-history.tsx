import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import type { XPLog } from '@talentbank/shared';
import { auth, db } from '../../lib/firebase';
import { Colors, Radius, FontSize } from '../../constants/theme';

function formatDate(ts: any): string {
  try {
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

const SOURCE_LABELS: Record<string, string> = {
  register: 'Registered for event',
  checkin:  'Checked in at event',
  submit:   'Submitted event work',
  approve:  'Submission approved',
};

export default function XPHistoryScreen() {
  const [logs, setLogs] = useState<XPLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { setLogs([]); setLoading(false); return; }
      const q = query(
        collection(db, 'users', user.uid, 'xpLogs'),
        orderBy('createdAt', 'desc'),
      );
      const unsubLogs = onSnapshot(q, (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as XPLog)));
        setLoading(false);
      });
      return unsubLogs;
    });
    return () => unsubAuth();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (logs.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>⚡</Text>
        <Text style={styles.emptyTitle}>No XP activity yet</Text>
        <Text style={styles.emptyText}>Attend events to start earning XP.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={logs}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={[styles.xpPill, item.amount < 0 && styles.xpPillNeg]}>
            <Text style={[styles.xpPillText, item.amount < 0 && styles.xpPillTextNeg]}>
              {item.amount > 0 ? '+' : ''}{item.amount} XP
            </Text>
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowLabel} numberOfLines={2}>{item.label || SOURCE_LABELS[item.source] || item.source}</Text>
            <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list:      { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },
  center:    { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 32 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  xpPill: {
    backgroundColor: Colors.xp + '20', borderRadius: Radius.xxl,
    paddingHorizontal: 10, paddingVertical: 5, minWidth: 72, alignItems: 'center',
  },
  xpPillNeg:     { backgroundColor: Colors.streak + '20' },
  xpPillText:    { color: Colors.xp, fontSize: FontSize.sm, fontWeight: '700' },
  xpPillTextNeg: { color: Colors.streak },
  rowInfo:    { flex: 1 },
  rowLabel:   { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600', lineHeight: 20 },
  rowDate:    { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  separator:  { height: 8 },

  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: 8 },
  emptyText:  { color: Colors.textSub, fontSize: FontSize.sm, textAlign: 'center' },
});
