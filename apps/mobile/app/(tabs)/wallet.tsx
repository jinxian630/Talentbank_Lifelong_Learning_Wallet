import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, Dimensions, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { computeLevel, XP_REWARDS, LEVEL_NAMES } from '@talentbank/shared';
import type { Badge, CertExam, XPLog } from '@talentbank/shared';
import { auth, db } from '../../lib/firebase';
import { useXPProfile, useRecentBadges } from '../../lib/use-xp-profile';
import { Colors, Radius, FontSize, FontFamily } from '../../constants/theme';

const SCREEN_W = Dimensions.get('window').width;

// ─── XP PROGRESS BAR ─────────────────────────────────────────────────────────

function XPProgressBar({ xp, xpToNext }: { xp: number; xpToNext: number }) {
  const pct = xpToNext > 0 ? Math.min((xp / xpToNext) * 100, 100) : 100;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 1000, useNativeDriver: false }).start();
  }, [pct]);

  const barWidth = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.xpBarWrap}>
      <View style={styles.xpBarTrack}>
        <Animated.View style={[styles.xpBarFill, { width: barWidth }]} />
      </View>
      <View style={styles.xpBarLabels}>
        <Text style={styles.xpBarLabel}>{xp} XP</Text>
        <Text style={styles.xpBarLabel}>{xpToNext} XP</Text>
      </View>
    </View>
  );
}

// ─── EXAM CARD PREVIEW ────────────────────────────────────────────────────────

function ExamCardPreview({ exam, userXP, onPress }: { exam: CertExam; userXP: number; onPress: () => void }) {
  const unlocked = userXP >= exam.requiredXP;
  const examDate = typeof (exam.examDate as any)?.toDate === 'function'
    ? (exam.examDate as any).toDate()
    : new Date(exam.examDate);

  return (
    <TouchableOpacity style={styles.examCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.examCardLeft}>
        <Text style={styles.examTitle} numberOfLines={1}>{exam.title}</Text>
        <Text style={styles.examMeta}>
          {examDate.toLocaleDateString()} · Online
        </Text>
      </View>
      <View style={styles.examCardRight}>
        <View style={[styles.xpBadge, unlocked ? styles.xpBadgeUnlocked : styles.xpBadgeLocked]}>
          <Text style={[styles.xpBadgeText, unlocked ? styles.xpBadgeTextUnlocked : styles.xpBadgeTextLocked]}>
            {unlocked ? '✅' : '🔒'} {exam.requiredXP} XP
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const router = useRouter();
  const { uid, xp: userXp, xpToNext, level, loading: profileLoading } = useXPProfile();
  const recentBadges = useRecentBadges(8);
  const [badgeCount, setBadgeCount] = useState(0);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [examPreview, setExamPreview] = useState<CertExam[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [xpLogs, setXpLogs] = useState<XPLog[]>([]);
  const [xpLogsLoading, setXpLogsLoading] = useState(true);
  const [suiAddress, setSuiAddress] = useState('');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const unsubDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        const addr = snap.data()?.suiAddress as string | undefined;
        if (addr) setSuiAddress(addr);
      });
      return unsubDoc;
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { setBadgeCount(0); setBadgesLoading(false); return; }
      const q = query(collection(db, 'badges'), where('userId', '==', user.uid));
      const unsub = onSnapshot(q, (snap) => {
        setBadgeCount(snap.size);
        setBadgesLoading(false);
      });
      return unsub;
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'certExams'), orderBy('examDate', 'asc'), limit(3));
    getDocs(q).then((snap) => {
      setExamPreview(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CertExam)));
      setExamsLoading(false);
    }).catch(() => setExamsLoading(false));
  }, []);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'xpLogs'), orderBy('createdAt', 'desc'), limit(5));
    getDocs(q)
      .then((snap) => {
        setXpLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as XPLog)));
        setXpLogsLoading(false);
      })
      .catch(() => setXpLogsLoading(false));
  }, [uid]);


  // Backfill XP when stored XP is below what badges imply
  useEffect(() => {
    if (profileLoading || !uid || recentBadges.length === 0) return;
    const expectedMinXP = recentBadges.reduce((sum: number, b: Badge) => sum + (b.xpValue ?? XP_REWARDS.approve), 0);
    if (userXp < expectedMinXP) {
      const newXp = expectedMinXP;
      setDoc(doc(db, 'users', uid), { xp: newXp, level: computeLevel(newXp) }, { merge: true });
    }
  }, [profileLoading, uid, recentBadges.length, userXp]);

  const EXPLORER_BASE = 'https://suiscan.xyz/testnet/account/';
  const shortAddress = suiAddress
    ? `${suiAddress.slice(0, 8)}...${suiAddress.slice(-6)}`
    : '—';
  const openExplorer = () => {
    if (!suiAddress) return;
    Linking.openURL(EXPLORER_BASE + suiAddress);
  };

  if (profileLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>XP Career Wallet</Text>
          </View>
          <TouchableOpacity
            style={styles.walletChip}
            onPress={openExplorer}
            activeOpacity={suiAddress ? 0.7 : 1}
          >
            <Text style={styles.walletChipPrefix}>◎ </Text>
            <View>
              <Text style={styles.walletChipText}>{shortAddress}</Text>
              <Text style={styles.walletChipSub}>
                {suiAddress ? 'Testnet · View Explorer ↗' : 'Testnet'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── CARD 1: XP ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>⚡ XP &amp; Level</Text>
        </View>

        <Text style={styles.xpNumber}>{userXp.toLocaleString()} XP</Text>
        <Text style={styles.levelLabel}>
          Level {level} — {LEVEL_NAMES[level] ?? 'Expert'}
        </Text>

        <XPProgressBar xp={userXp} xpToNext={xpToNext} />

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/wallet/xp-history')}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={14} color={Colors.xp} />
            <Text style={styles.actionBtnText}>XP History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/wallet/earn-xp')}
            activeOpacity={0.8}
          >
            <Ionicons name="flash-outline" size={14} color={Colors.quest} />
            <Text style={[styles.actionBtnText, { color: Colors.quest }]}>Earn More XP</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── CARD 2: Badges ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🏅 Badges</Text>
          <TouchableOpacity onPress={() => router.push('/wallet/badges-list')} activeOpacity={0.7}>
            <Text style={styles.viewAllLink}>View All →</Text>
          </TouchableOpacity>
        </View>

        {badgesLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginVertical: 8 }} />
        ) : badgeCount === 0 ? (
          <Text style={styles.emptyCardText}>No badges yet — complete events to earn your first badge.</Text>
        ) : (
          <View>
            <View style={styles.badgeGrid}>
              {recentBadges.map((badge: Badge) => {
                const claimed = Boolean(badge.onChain?.txHash);
                const thumb = (
                  <View style={styles.badgeGridCell}>
                    <View style={[styles.badgeThumb, { backgroundColor: badge.color, shadowColor: badge.color }]}>
                      <Text style={styles.badgeThumbEmoji}>{badge.emoji}</Text>
                      {claimed && (
                        <View style={styles.chainBadge}>
                          <Ionicons name="wallet-outline" size={9} color="#fff" />
                        </View>
                      )}
                    </View>
                    {claimed && (
                      <Text style={styles.viewAssetLabel}>View Asset</Text>
                    )}
                  </View>
                );
                return claimed ? (
                  <TouchableOpacity
                    key={badge.id}
                    activeOpacity={0.7}
                    onPress={() =>
                      Linking.openURL(
                        suiAddress
                          ? `https://suiscan.xyz/testnet/account/${suiAddress}`
                          : `https://suiscan.xyz/testnet/object/${badge.onChain!.objectId}`,
                      )
                    }
                  >
                    {thumb}
                  </TouchableOpacity>
                ) : <View key={badge.id}>{thumb}</View>;
              })}
            </View>
            <Text style={styles.badgeCountLabel}>
              {badgeCount} badge{badgeCount !== 1 ? 's' : ''} earned
            </Text>
          </View>
        )}
      </View>

      {/* ── CARD 3: Certificate Market ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🎓 Certificate Exams</Text>
          <TouchableOpacity onPress={() => router.push('/wallet/cert-market')} activeOpacity={0.7}>
            <Text style={styles.viewAllLink}>Browse All →</Text>
          </TouchableOpacity>
        </View>

        {examsLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginVertical: 12 }} />
        ) : examPreview.length === 0 ? (
          <View style={styles.comingSoonBox}>
            <Text style={styles.comingSoonEmoji}>🎓</Text>
            <Text style={styles.comingSoonTitle}>Certificate Courses</Text>
            <Text style={styles.comingSoonSub}>Coming Soon</Text>
            <Text style={styles.comingSoonHint}>Unlock certifications by earning XP through events</Text>
          </View>
        ) : (
          <View style={styles.examList}>
            {examPreview.map((exam) => (
              <ExamCardPreview
                key={exam.id}
                exam={exam}
                userXP={userXp}
                onPress={() => router.push(`/wallet/exam/${exam.id}`)}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── CARD 4: Next Level Milestone ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🎯 Next Milestone</Text>
        </View>
        {level >= 5 ? (
          <Text style={styles.maxLevelText}>Max Level Reached 🏆</Text>
        ) : (
          <View>
            <View style={styles.milestonePills}>
              <View style={styles.milestonePill}>
                <Text style={styles.milestonePillLevel}>Lv {level}</Text>
                <Text style={styles.milestonePillName}>{LEVEL_NAMES[level] ?? 'Expert'}</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={Colors.textMuted} />
              <View style={[styles.milestonePill, styles.milestonePillNext]}>
                <Text style={[styles.milestonePillLevel, { color: Colors.quest }]}>Lv {level + 1}</Text>
                <Text style={styles.milestonePillName}>{LEVEL_NAMES[(level + 1) as keyof typeof LEVEL_NAMES] ?? 'Expert'}</Text>
              </View>
            </View>
            <Text style={styles.milestoneXpLabel}>
              {(xpToNext - userXp).toLocaleString()} XP to go
            </Text>
          </View>
        )}
      </View>

      {/* ── CARD 5: Recent XP Activity ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>⚡ XP Activity</Text>
          <TouchableOpacity onPress={() => router.push('/wallet/xp-history')} activeOpacity={0.7}>
            <Text style={styles.viewAllLink}>View All →</Text>
          </TouchableOpacity>
        </View>
        {xpLogsLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginVertical: 8 }} />
        ) : xpLogs.length === 0 ? (
          <View style={styles.examCard}>
            <Text style={styles.emptyCardText}>No XP earned yet — attend an event.</Text>
          </View>
        ) : (
          <View style={styles.examList}>
            {xpLogs.map((log) => {
              const date = typeof log.createdAt?.toDate === 'function'
                ? log.createdAt.toDate()
                : new Date(log.createdAt);
              return (
                <View key={log.id} style={styles.examCard}>
                  <View style={styles.xpLogPill}>
                    <Text style={styles.xpLogPillText}>
                      {log.amount > 0 ? '+' : ''}{log.amount} XP
                    </Text>
                  </View>
                  <View style={styles.xpLogInfo}>
                    <Text style={styles.examTitle}>{log.label}</Text>
                    <Text style={styles.examMeta}>{date.toLocaleDateString()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { color: Colors.text, fontSize: FontSize.h1, fontWeight: '800', letterSpacing: -0.5, fontFamily: FontFamily.heading },
  walletChip: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderLeftColor: Colors.xp,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  walletChipPrefix: { color: Colors.xp, fontSize: FontSize.md, fontWeight: '700' },
  walletChipText: { color: Colors.text, fontSize: FontSize.xs, fontFamily: 'monospace', fontWeight: '600' },
  walletChipSub:  { color: Colors.textMuted, fontSize: 10, marginTop: 1 },

  // Cards
  card: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl, borderWidth: 1, borderColor: Colors.border,
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle:   { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  viewAllLink: { color: Colors.xp, fontSize: FontSize.sm, fontWeight: '600' },

  // XP card
  xpNumber: {
    color: Colors.xp, fontSize: 40, fontWeight: '900',
    letterSpacing: -1, marginBottom: 4,
  },
  levelLabel: { color: Colors.textSub, fontSize: FontSize.sm, marginBottom: 14 },

  xpBarWrap:   { marginBottom: 16 },
  xpBarTrack:  { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  xpBarFill:   { height: 8, backgroundColor: Colors.xp, borderRadius: 4 },
  xpBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xpBarLabel:  { color: Colors.textMuted, fontSize: FontSize.xs },

  cardActions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bg, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  actionBtnText: { color: Colors.xp, fontSize: FontSize.sm, fontWeight: '600' },

  // Badges card
  badgeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10,
  },
  badgeGridCell: {
    width: Math.floor((SCREEN_W - 32 - 36 - 30) / 4),
    alignItems: 'center',
  },
  badgeThumb: {
    width: 52, height: 52, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 6,
  },
  badgeThumbEmoji:  { fontSize: 24 },
  badgeCountLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  chainBadge: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: Colors.accent,
    borderRadius: 6, padding: 2,
  },
  viewAssetLabel: {
    color: Colors.accent, fontSize: 8, fontWeight: '700',
    marginTop: 3, textAlign: 'center',
  },
  emptyCardText:   { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },

  // Exams card
  examList: { gap: 10 },
  examCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bg, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  examCardLeft:  { flex: 1, marginRight: 10 },
  examCardRight: { alignItems: 'flex-end' },
  examTitle: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700', marginBottom: 3 },
  examMeta:  { color: Colors.textMuted, fontSize: FontSize.xs },
  xpBadge: {
    borderRadius: Radius.xxl, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  xpBadgeUnlocked: { backgroundColor: '#8FBF8C20', borderColor: '#8FBF8C40' },
  xpBadgeLocked:   { backgroundColor: Colors.border + '50', borderColor: Colors.border },
  xpBadgeText:     { fontSize: FontSize.xs, fontWeight: '700' },
  xpBadgeTextUnlocked: { color: '#8FBF8C' },
  xpBadgeTextLocked:   { color: Colors.textMuted },

  // XP log rows
  xpLogPill: {
    backgroundColor: Colors.xp + '20', borderRadius: Radius.xxl,
    borderWidth: 1, borderColor: Colors.xp + '40',
    paddingHorizontal: 10, paddingVertical: 4, minWidth: 72, alignItems: 'center',
  },
  xpLogPillText: { color: Colors.xp, fontSize: FontSize.xs, fontWeight: '700' },
  xpLogInfo:     { flex: 1, marginLeft: 10 },

  // Next milestone
  milestonePills: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 12,
  },
  milestonePill: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: Colors.xp + '18', borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.xp + '40',
  },
  milestonePillNext: {
    backgroundColor: Colors.quest + '18', borderColor: Colors.quest + '40',
  },
  milestonePillLevel: { color: Colors.xp, fontSize: FontSize.lg, fontWeight: '800' },
  milestonePillName:  { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  milestoneXpLabel:   { textAlign: 'center', color: Colors.textSub, fontSize: FontSize.sm },
  maxLevelText: {
    textAlign: 'center', color: Colors.xp, fontSize: FontSize.md, fontWeight: '800', paddingVertical: 12,
  },

  // Coming soon state
  comingSoonBox:  { alignItems: 'center', paddingVertical: 16 },
  comingSoonEmoji:{ fontSize: 36, marginBottom: 8 },
  comingSoonTitle:{ color: Colors.text, fontSize: FontSize.md, fontWeight: '700', marginBottom: 2 },
  comingSoonSub:  { color: Colors.xp, fontSize: FontSize.sm, fontWeight: '700', marginBottom: 6 },
  comingSoonHint: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center', lineHeight: 18 },
});
