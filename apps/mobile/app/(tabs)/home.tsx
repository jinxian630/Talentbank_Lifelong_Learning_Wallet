import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, getDocs, collection } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import type { UserProfile, TalentEvent } from '@talentbank/shared';
import {
  mockUser, MOTIVATIONAL_QUOTES, STUDY_GOALS,
  getLevelTitle, truncateWallet, StudyGoal,
} from '../../lib/mock-data';
import { Colors, SkillColors, LevelColors, Radius, FontSize } from '../../constants/theme';

interface RagRec {
  id: string;
  title: string;
  emoji: string;
  type: string;
  reason: string;
  matchScore: number;
}

function computeRecommendations(
  interests: string[],
  allEvents: TalentEvent[],
): TalentEvent[] {
  if (!interests.length || !allEvents.length) return [];
  const normalize = (s: string) => s.toLowerCase();
  const tokens = interests.map(normalize);
  const now = new Date();
  const upcoming = allEvents.filter(e => {
    const end = (e.endAt as any)?.toDate?.() ?? new Date(0);
    return end >= now;
  });
  const scored = upcoming.map(event => {
    const haystack = normalize(`${event.title} ${event.description} ${event.type}`);
    const score = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
    return { event, score };
  });
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.event);
}

const { width: SCREEN_W } = Dimensions.get('window');
const STORAGE_KEY = 'tb-study-goals';

// ─── MASCOT ───────────────────────────────────────────────────────────────────

function OwlMascot({ excited }: { excited: boolean }) {
  const bounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (excited) {
      Animated.sequence([
        Animated.spring(bounce, { toValue: 1.2, useNativeDriver: true, speed: 20 }),
        Animated.spring(bounce, { toValue: 1,   useNativeDriver: true, speed: 20 }),
      ]).start();
    }
  }, [excited]);

  return (
    <Animated.View style={[styles.mascotContainer, { transform: [{ scale: bounce }] }]}>
      <Text style={styles.mascotEmoji}>🦉</Text>
      {excited && (
        <View style={styles.mascotSparkles}>
          <Text style={styles.sparkle}>✨</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─── XP BAR ───────────────────────────────────────────────────────────────────

function XPBar({ xp, xpToNext, level }: { xp: number; xpToNext: number; level: number }) {
  const pct = Math.min((xp / xpToNext) * 100, 100);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const barWidth = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.xpBarWrap}>
      <View style={styles.xpBarRow}>
        <Text style={styles.xpLabel}>⚡ {xp} XP</Text>
        <Text style={styles.xpLabel}>{xpToNext} XP</Text>
      </View>
      <View style={styles.xpBarTrack}>
        <Animated.View style={[styles.xpBarFill, { width: barWidth }]} />
      </View>
      <Text style={styles.xpSub}>to Level {level + 1}</Text>
    </View>
  );
}

// ─── SKILL BAR ────────────────────────────────────────────────────────────────

function SkillBar({ label, value, color }: { label: string; value: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 900,
      delay: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const barWidth = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.skillRow}>
      <Text style={styles.skillLabel}>{label}</Text>
      <View style={styles.skillTrack}>
        <Animated.View style={[styles.skillFill, { width: barWidth, backgroundColor: color }]} />
      </View>
      <Text style={[styles.skillPct, { color }]}>{value}%</Text>
    </View>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [quoteIndex, setQuoteIndex]     = useState(0);
  const [checkedGoals, setCheckedGoals] = useState<Record<string, boolean>>({});
  const [goalsLoaded, setGoalsLoaded]   = useState(false);
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [allEvents, setAllEvents]       = useState<TalentEvent[]>([]);
  const [recommended, setRecommended]   = useState<TalentEvent[]>([]);
  const [uid, setUid]                   = useState<string | null>(null);
  const [ragRecs, setRagRecs]           = useState<RagRec[]>([]);

  const doneCount = STUDY_GOALS.filter(g => checkedGoals[g.id]).length;

  // Load goals from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setCheckedGoals(JSON.parse(raw));
      setGoalsLoaded(true);
    });
  }, []);

  // Rotate motivational quote every 30s
  useEffect(() => {
    const t = setInterval(() => setQuoteIndex(i => (i + 1) % MOTIVATIONAL_QUOTES.length), 30000);
    return () => clearInterval(t);
  }, []);

  // Real profile from Firestore
  useEffect(() => {
    let unsubDoc: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, user => {
      unsubDoc?.();
      if (!user) { setUid(null); return; }
      setUid(user.uid);
      unsubDoc = onSnapshot(doc(db, 'users', user.uid), snap => {
        if (snap.exists()) setProfile(snap.data() as UserProfile);
      });
    });
    return () => { unsubAuth(); unsubDoc?.(); };
  }, []);

  // RAG recommendations from Python service (via Next.js proxy)
  useEffect(() => {
    if (!uid) return;
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) return;
    fetch(`${apiUrl}/api/ai/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    })
      .then(r => r.json())
      .then(data => { if (data.recommendations?.length) setRagRecs(data.recommendations); })
      .catch(() => {});
  }, [uid]);

  // Fetch events once for recommendations
  useEffect(() => {
    getDocs(collection(db, 'events')).then(snap => {
      setAllEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as TalentEvent)));
    });
  }, []);

  // Compute skill gap recommendations
  useEffect(() => {
    if (profile && allEvents.length) {
      setRecommended(computeRecommendations(profile.interests ?? [], allEvents));
    }
  }, [profile, allEvents]);

  const toggleGoal = async (id: string) => {
    const updated = { ...checkedGoals, [id]: !checkedGoals[id] };
    setCheckedGoals(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Career OS</Text>
          <Text style={styles.headerSub}>Your lifelong learning wallet</Text>
        </View>
        {/* TODO: BLOCKCHAIN — replace with connected wallet chip from WalletConnect */}
        <View style={styles.walletChip}>
          <Text style={styles.walletChipText}>{truncateWallet(mockUser.walletAddress)}</Text>
        </View>
      </View>

      {/* ── Character Card ── */}
      <View style={styles.characterCard}>
        <View style={styles.characterTop}>
          <OwlMascot excited={mockUser.streak >= 5} />
          <View style={styles.characterInfo}>
            <Text style={styles.characterName}>{profile?.name ?? mockUser.displayName}</Text>
            <View style={styles.levelRow}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>Lv.{mockUser.level}</Text>
              </View>
              <Text style={styles.levelTitle}>{getLevelTitle(mockUser.level)}</Text>
            </View>
          </View>
        </View>

        <XPBar xp={mockUser.xp} xpToNext={mockUser.xpToNext} level={mockUser.level} />

        {/* Streak */}
        <View style={styles.streakCard}>
          <Text style={styles.streakFire}>🔥</Text>
          <View style={styles.streakInfo}>
            <Text style={styles.streakCount}>
              Day {mockUser.streak} Streak
            </Text>
            <Text style={styles.streakSub}>
              {mockUser.streak >= 5
                ? "You're basically a genius now 😤"
                : "Keep it going, future legend!"}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Motivational Quote ── */}
      <View style={styles.quoteCard}>
        <Text style={styles.quoteLabel}>TODAY'S TRUTH 💬</Text>
        <Text key={quoteIndex} style={styles.quoteText}>
          "{MOTIVATIONAL_QUOTES[quoteIndex]}"
        </Text>
      </View>

      {/* ── Skill Progress ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Skills Radar</Text>
        <View style={styles.card}>
          <SkillBar label="Backend"    value={mockUser.skills.backend}    color={SkillColors.backend}    />
          <SkillBar label="Frontend"   value={mockUser.skills.frontend}   color={SkillColors.frontend}   />
          <SkillBar label="AI/ML"      value={mockUser.skills.aiml}       color={SkillColors.aiml}       />
          <SkillBar label="Blockchain" value={mockUser.skills.blockchain} color={SkillColors.blockchain} />
          <SkillBar label="DevOps"     value={mockUser.skills.devops}     color={SkillColors.devops}     />
        </View>
      </View>

      {/* ── Daily Study Goals ── */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Daily Goals</Text>
          <Text style={styles.goalProgress}>
            {doneCount}/{STUDY_GOALS.length} done
          </Text>
        </View>

        {/* Goal progress bar */}
        <View style={styles.goalBarTrack}>
          <View
            style={[
              styles.goalBarFill,
              { width: `${(doneCount / STUDY_GOALS.length) * 100}%` as any },
            ]}
          />
        </View>
        {doneCount === STUDY_GOALS.length && (
          <Text style={styles.goalCheer}>LET'S GOOO! 🎉 All done, absolute legend!</Text>
        )}

        <View style={styles.card}>
          {STUDY_GOALS.map((goal: StudyGoal, idx: number) => {
            const done = !!checkedGoals[goal.id];
            return (
              <TouchableOpacity
                key={goal.id}
                onPress={() => toggleGoal(goal.id)}
                style={[styles.goalRow, idx < STUDY_GOALS.length - 1 && styles.goalBorder]}
                activeOpacity={0.7}
              >
                <View style={[styles.goalCheck, done && styles.goalCheckDone]}>
                  {done && <Ionicons name="checkmark" size={12} color={Colors.bg} />}
                </View>
                <Text style={[styles.goalText, done && styles.goalTextDone]}>
                  {goal.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Recommended for You (RAG or local fallback) ── */}
      {(ragRecs.length > 0 || recommended.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended for You ✨</Text>
          {ragRecs.length > 0
            ? ragRecs.map(rec => (
                <TouchableOpacity
                  key={rec.id}
                  style={styles.recommendedCard}
                  onPress={() => router.push('/(tabs)/events')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.recommendedEmoji}>{rec.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recommendedTitle} numberOfLines={1}>{rec.title}</Text>
                    <Text style={styles.recommendedType}>{rec.type}</Text>
                    {rec.reason ? (
                      <Text style={styles.recommendedReason} numberOfLines={2}>{rec.reason}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))
            : recommended.map(event => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.recommendedCard}
                  onPress={() => router.push('/(tabs)/events')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.recommendedEmoji}>{event.emoji ?? '🎯'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recommendedTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.recommendedType}>{event.type}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))
          }
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  headerTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800' },
  headerSub:   { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  walletChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xxl, paddingHorizontal: 12, paddingVertical: 6,
  },
  walletChipText: { color: Colors.textSub, fontSize: FontSize.xs, fontFamily: 'monospace' },

  // Character card
  characterCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  characterTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  mascotContainer: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  mascotEmoji:    { fontSize: 52 },
  mascotSparkles: { position: 'absolute', top: -4, right: -4 },
  sparkle:        { fontSize: 16 },
  characterInfo:  { marginLeft: 16, flex: 1 },
  characterName:  { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  levelRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  levelBadge: {
    backgroundColor: Colors.xp + '20',
    borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3,
  },
  levelText:  { color: Colors.xp, fontSize: FontSize.xs, fontWeight: '700' },
  levelTitle: { color: Colors.textSub, fontSize: FontSize.sm },

  // XP bar
  xpBarWrap:  { marginBottom: 14 },
  xpBarRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xpLabel:    { color: Colors.textSub, fontSize: FontSize.xs },
  xpBarTrack: {
    height: 10, backgroundColor: Colors.border,
    borderRadius: 5, overflow: 'hidden',
  },
  xpBarFill:  { height: '100%', backgroundColor: Colors.xp, borderRadius: 5 },
  xpSub:      { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 4 },

  // Streak
  streakCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.streak + '15',
    borderRadius: Radius.lg, padding: 12,
    borderWidth: 1, borderColor: Colors.streak + '30',
  },
  streakFire:  { fontSize: 28, marginRight: 10 },
  streakInfo:  { flex: 1 },
  streakCount: { color: Colors.streak, fontSize: FontSize.md, fontWeight: '700' },
  streakSub:   { color: Colors.textSub, fontSize: FontSize.xs, marginTop: 2 },

  // Quote card
  quoteCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.xl, padding: 16,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  quoteLabel: { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '700', marginBottom: 6, letterSpacing: 1 },
  quoteText:  { color: Colors.textSub, fontSize: FontSize.sm, fontStyle: 'italic', lineHeight: 20 },

  // Sections
  section:     { marginHorizontal: 20, marginBottom: 20 },
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:{ color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  viewAll:     { color: Colors.xp, fontSize: FontSize.sm, fontWeight: '600' },

  // Card container
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },

  // Skill bars
  skillRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  skillLabel: { color: Colors.textSub, fontSize: FontSize.xs, width: 84, fontWeight: '600' },
  skillTrack: {
    flex: 1, height: 8, backgroundColor: Colors.border,
    borderRadius: 4, overflow: 'hidden', marginHorizontal: 10,
  },
  skillFill:  { height: '100%', borderRadius: 4 },
  skillPct:   { fontSize: FontSize.xs, fontWeight: '700', width: 32, textAlign: 'right' },

  // Goals
  goalProgress:    { color: Colors.success, fontSize: FontSize.sm, fontWeight: '600' },
  goalBarTrack: {
    height: 6, backgroundColor: Colors.border, borderRadius: 3,
    marginBottom: 6, overflow: 'hidden',
  },
  goalBarFill:  { height: '100%', backgroundColor: Colors.success, borderRadius: 3 },
  goalCheer:    { color: Colors.success, fontSize: FontSize.sm, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  goalRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  goalBorder:   { borderBottomWidth: 1, borderBottomColor: Colors.border },
  goalCheck: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.borderAlt,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, flexShrink: 0,
  },
  goalCheckDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  goalText:      { color: Colors.textSub, fontSize: FontSize.sm, flex: 1, lineHeight: 18 },
  goalTextDone:  { textDecorationLine: 'line-through', color: Colors.textMuted },

  // Badge grid
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeCard: {
    width: (SCREEN_W - 40 - 36) / 4,
    alignItems: 'center', gap: 6,
  },
  badgeIcon: {
    width: 54, height: 54, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 8, elevation: 8,
  },
  badgeEmoji:     { fontSize: 26 },
  badgeSkill:     { color: Colors.textSub, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  levelPill:      { borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  levelPillText:  { fontSize: 9, fontWeight: '700' },

  bottomPad: { height: 30 },

  // Recommended for You
  recommendedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 8,
  },
  recommendedEmoji:  { fontSize: 24 },
  recommendedTitle:  { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  recommendedType:   { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  recommendedReason: { color: Colors.textSub, fontSize: FontSize.xs, marginTop: 4, fontStyle: 'italic' },
});
