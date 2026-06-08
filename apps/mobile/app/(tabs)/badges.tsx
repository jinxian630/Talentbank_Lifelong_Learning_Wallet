import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Linking, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import type { Badge } from '@talentbank/shared';
import {
  mockBadges, mockUser, truncateTx, truncateWallet,
  getLevelTitle, MockBadge,
} from '../../lib/mock-data';
import { Colors, LevelColors, Radius, FontSize } from '../../constants/theme';

// ─── STAT CARD ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '30', backgroundColor: color + '10' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── BADGE CARD ───────────────────────────────────────────────────────────────

function BadgeCard({ badge }: { badge: MockBadge }) {
  const levelColor = LevelColors[badge.level] ?? Colors.textSub;

  const onViewChain = () => {
    // TODO: BLOCKCHAIN — open Arbitrum Sepolia explorer for this TX
    // Linking.openURL(`https://sepolia.arbiscan.io/tx/${badge.txHash}`);
    console.log('View on chain:', badge.txHash);
  };

  return (
    <View style={styles.badgeCard}>
      {/* Level pill — absolute top right */}
      <View style={[styles.levelPill, { backgroundColor: levelColor + '20' }]}>
        <Text style={[styles.levelPillText, { color: levelColor }]}>{badge.level}</Text>
      </View>

      {/* Badge icon */}
      <View style={[styles.badgeIcon, {
        backgroundColor: badge.color,
        shadowColor: badge.color,
      }]}>
        <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
      </View>

      {/* Info */}
      <Text style={styles.badgeSkill}>{badge.skill}</Text>
      <Text style={styles.badgeEvent} numberOfLines={1}>{badge.eventTitle}</Text>
      <Text style={styles.badgeDate}>{badge.awardedAt}</Text>

      {/* XP value */}
      <View style={styles.xpPill}>
        <Text style={styles.xpPillText}>+{badge.xpValue} XP</Text>
      </View>

      {/* TX hash */}
      <View style={styles.txRow}>
        <Text style={styles.txHash}>{truncateTx(badge.txHash)}</Text>
      </View>

      {/* View on Chain button */}
      <TouchableOpacity style={styles.chainBtn} onPress={onViewChain} activeOpacity={0.7}>
        <Ionicons name="open-outline" size={11} color={Colors.textMuted} />
        <Text style={styles.chainBtnText}>View on Chain</Text>
        {/* TODO: BLOCKCHAIN — enable when real txHash available from SBT mint */}
      </TouchableOpacity>
    </View>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function BadgesScreen() {
  // TODO: FIREBASE — swap mockBadges with real Firestore listener:
  // const [badges, setBadges] = useState<Badge[]>([]);
  // useEffect(() => {
  //   const user = auth.currentUser;
  //   if (!user) return;
  //   const q = query(collection(db, 'badges'), where('userId', '==', user.uid));
  //   return onSnapshot(q, snap => {
  //     setBadges(snap.docs.map(d => ({ id: d.id, ...d.data() } as Badge)));
  //   });
  // }, []);
  const badges = mockBadges;
  const loading = false;

  const totalXP    = badges.reduce((sum, b) => sum + b.xpValue, 0);
  const uniqueSkills = [...new Set(badges.map(b => b.skill))];

  const skillTagColors = [
    Colors.xp, Colors.skill, Colors.quest, Colors.success, Colors.streak, Colors.accent,
  ];

  if (loading) {
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
        <View>
          <Text style={styles.headerTitle}>Identity Wallet</Text>
          <Text style={styles.headerSub}>Your on-chain proof of grind 💎</Text>
        </View>
        {/* TODO: BLOCKCHAIN — replace with useAccount().address from RainbowKit */}
        <View style={styles.walletChip}>
          <Text style={styles.walletChipText}>{truncateWallet(mockUser.walletAddress)}</Text>
        </View>
      </View>

      {/* ── Stats Row ── */}
      <View style={styles.statsRow}>
        <StatCard label="Total XP"     value={`${totalXP} XP`} color={Colors.xp}      />
        <StatCard label="Badges"       value={badges.length}   color={Colors.skill}   />
        <StatCard label="Level"        value={`Lv.${mockUser.level}`} color={Colors.quest} />
      </View>

      {/* ── Level title ── */}
      <View style={styles.levelRow}>
        <Text style={styles.levelTitle}>
          {getLevelTitle(mockUser.level)}
        </Text>
      </View>

      {/* ── Skill Tags ── */}
      {uniqueSkills.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills Unlocked</Text>
          <View style={styles.skillTagsRow}>
            {uniqueSkills.map((skill, i) => {
              const color = skillTagColors[i % skillTagColors.length];
              return (
                <View key={skill} style={[styles.skillTag, { backgroundColor: color + '18', borderColor: color + '40' }]}>
                  <Text style={[styles.skillTagText, { color }]}>{skill}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Badge Grid ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {badges.length} Badge{badges.length !== 1 ? 's' : ''} Earned
        </Text>

        {badges.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyOwl}>🦉😴</Text>
            <Text style={styles.emptyTitle}>No badges yet!</Text>
            <Text style={styles.emptyText}>
              Your wallet is emptier than my motivation on Mondays 😭{'\n'}
              Go complete some quests, warrior.
            </Text>
            <TouchableOpacity style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Find Quests ⚔️</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.badgeGrid}>
            {badges.map(badge => (
              <BadgeCard key={badge.id} badge={badge} />
            ))}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  headerTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800' },
  headerSub:   { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  walletChip: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xxl, paddingHorizontal: 12, paddingVertical: 6,
  },
  walletChipText: { color: Colors.textSub, fontSize: FontSize.xs, fontFamily: 'monospace' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 10 },
  statCard: {
    flex: 1, borderRadius: Radius.lg, borderWidth: 1,
    paddingVertical: 14, alignItems: 'center',
  },
  statValue: { fontSize: FontSize.lg, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 3 },

  // Level row
  levelRow: { paddingHorizontal: 20, marginBottom: 16 },
  levelTitle: { color: Colors.textSub, fontSize: FontSize.sm, fontStyle: 'italic' },

  // Sections
  section:      { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: 12 },

  // Skill tags
  skillTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillTag: {
    borderRadius: Radius.xxl, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  skillTagText: { fontSize: FontSize.xs, fontWeight: '600' },

  // Badge grid
  badgeGrid: { gap: 14 },
  badgeCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, alignItems: 'center', position: 'relative',
  },
  levelPill: {
    position: 'absolute', top: 12, right: 12,
    borderRadius: Radius.xxl, paddingHorizontal: 8, paddingVertical: 3,
  },
  levelPillText: { fontSize: FontSize.xs, fontWeight: '700' },
  badgeIcon: {
    width: 72, height: 72, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 10,
  },
  badgeEmoji: { fontSize: 34 },
  badgeSkill: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', marginBottom: 2 },
  badgeEvent: { color: Colors.textSub, fontSize: FontSize.sm, marginBottom: 2 },
  badgeDate:  { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 8 },
  xpPill: {
    backgroundColor: Colors.xp + '20', borderRadius: Radius.xxl,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  xpPillText: { color: Colors.xp, fontSize: FontSize.sm, fontWeight: '700' },
  txRow:   { marginBottom: 8 },
  txHash:  { color: Colors.textMuted, fontSize: 11, fontFamily: 'monospace' },
  chainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5,
  },
  chainBtnText: { color: Colors.textMuted, fontSize: FontSize.xs },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyOwl:   { fontSize: 52, marginBottom: 12 },
  emptyTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: 8 },
  emptyText:  { color: Colors.textSub, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  emptyBtn: {
    backgroundColor: Colors.xp, borderRadius: Radius.xl,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },
});
