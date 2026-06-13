// firebase.ts must load first so Firebase is initialized before firebase-config reads it
import { auth } from '../../lib/firebase';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, FlatList, SectionList, TouchableOpacity,
  StyleSheet, Dimensions, Modal, TextInput, ActivityIndicator,
  Animated as RNAnimated, Alert, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, runOnJS, Extrapolation,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import {
  getCertExams, registerForExam, getUserExamRegistrations,
  saveCert, unsaveCert, listenSavedCerts,
  updateCertPreferences, getCertPreferences,
} from '@talentbank/firebase-config';
import type { CertExam, ExamRegistration } from '@talentbank/shared';
import { useXPProfile } from '../../lib/use-xp-profile';
import { Colors, Radius, FontSize } from '../../constants/theme';

const { width: W, height: H } = Dimensions.get('window');
const CARD_W = Math.round(W * 0.92);
const CARD_H = Math.round(H * 0.72);
const SWIPE_THRESHOLD = 100;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDate(ts: any): string {
  try {
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function slotsLeft(exam: CertExam): number {
  return Math.max(0, exam.maxSlots - exam.registeredCount);
}

function matchScore(userXP: number, requiredXP: number): number {
  if (requiredXP === 0 || userXP >= requiredXP) return 100;
  return Math.round((userXP / requiredXP) * 100);
}

const DIFFICULTY_CONFIG = {
  beginner:     { label: '⭐ Beginner',       color: '#8FBF8C' },
  intermediate: { label: '⭐⭐ Intermediate',  color: '#6E89B8' },
  advanced:     { label: '⭐⭐⭐ Advanced',    color: '#E8923C' },
} as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  registered: { label: '🎟 Registered',  color: Colors.xp,      bg: Colors.xp      + '15' },
  attended:   { label: '✅ Attended',     color: Colors.success, bg: Colors.success + '15' },
  passed:     { label: '🏅 Passed',       color: Colors.success, bg: Colors.success + '15' },
  failed:     { label: '❌ Failed',       color: Colors.streak,  bg: Colors.streak  + '15' },
};

// ─── EXAM GRID CARD ───────────────────────────────────────────────────────────

function ExamListCard({ exam, userXP, saved, registered, onPress, onSave }: {
  exam: CertExam; userXP: number; saved: boolean; registered: boolean;
  onPress: () => void; onSave: () => void;
}) {
  const unlocked = userXP >= exam.requiredXP;
  const diffCfg = exam.difficulty ? DIFFICULTY_CONFIG[exam.difficulty] : null;
  const accentColor = diffCfg ? diffCfg.color : (unlocked ? Colors.success : Colors.textMuted);
  const slots = slotsLeft(exam);

  return (
    <TouchableOpacity style={listStyles.card} onPress={onPress} activeOpacity={0.82}>
      <View style={[listStyles.accent, { backgroundColor: accentColor }]} />
      <View style={listStyles.body}>
        <View style={listStyles.thumbWrap}>
          {exam.bannerImageUrl
            ? <Image source={{ uri: exam.bannerImageUrl }} style={listStyles.thumb} resizeMode="cover" />
            : <View style={[listStyles.emojiBox, { backgroundColor: accentColor + '18' }]}>
                <Text style={{ fontSize: 30 }}>{unlocked ? '🎓' : '🔒'}</Text>
              </View>}
          <View style={listStyles.thumbFade} />
          {registered && (
            <View style={listStyles.regBadge}>
              <Text style={listStyles.regBadgeText}>Registered</Text>
            </View>
          )}
        </View>

        <View style={listStyles.info}>
          <Text style={listStyles.date}>{formatDate(exam.examDate)}</Text>
          <Text style={listStyles.title} numberOfLines={2}>{exam.title}</Text>
          <View style={listStyles.pillRow}>
            {diffCfg && (
              <View style={[listStyles.pill, { backgroundColor: diffCfg.color + '18', borderColor: diffCfg.color + '40' }]}>
                <Text style={[listStyles.pillText, { color: diffCfg.color }]}>{diffCfg.label}</Text>
              </View>
            )}
            <View style={[listStyles.pill, {
              backgroundColor: unlocked ? Colors.success + '15' : Colors.border,
              borderColor: unlocked ? Colors.success + '40' : Colors.border,
            }]}>
              <Text style={[listStyles.pillText, { color: unlocked ? Colors.success : Colors.textMuted }]}>
                {unlocked ? '✓ Unlocked' : '🔒 Locked'}
              </Text>
            </View>
            <View style={[listStyles.pill, { backgroundColor: Colors.xp + '18', borderColor: Colors.xp + '40' }]}>
              <Text style={[listStyles.pillText, { color: Colors.xp }]}>⚡ {exam.requiredXP} XP</Text>
            </View>
            {registered && (
              <View style={[listStyles.pill, { backgroundColor: Colors.success + '15', borderColor: Colors.success + '50' }]}>
                <Ionicons name="checkmark-circle" size={10} color={Colors.success} />
                <Text style={[listStyles.pillText, { color: Colors.success }]}>Registered</Text>
              </View>
            )}
          </View>
          {slots > 0
            ? <Text style={listStyles.slots}>{slots} slots left</Text>
            : <Text style={[listStyles.slots, { color: Colors.streak }]}>Full</Text>}
        </View>

        <TouchableOpacity style={listStyles.saveBtn} onPress={onSave}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20}
            color={saved ? Colors.streak : Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── SWIPE CARD ───────────────────────────────────────────────────────────────

function SwipeCard({ exam, userXP, saved, translateX, translateY, gesture,
  onTap, onSkip, onSave, onJoin }: {
  exam: CertExam; userXP: number; saved: boolean;
  translateX: any; translateY: any; gesture: any;
  onTap: () => void; onSkip: () => void; onSave: () => void; onJoin: () => void;
}) {
  const unlocked = userXP >= exam.requiredXP;
  const slots = slotsLeft(exam);
  const score = matchScore(userXP, exam.requiredXP);
  const matchColor = score === 100 ? Colors.success : Colors.xp;

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-200, 0, 200], [-15, 0, 15], Extrapolation.CLAMP)}deg` },
    ],
  }));

  const rightOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, 100], [0, 1], Extrapolation.CLAMP),
  }));
  const leftOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-20, -100], [0, 1], Extrapolation.CLAMP),
  }));
  const upOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-20, -100], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[swipeStyles.card, cardStyle]}>
        {/* Direction overlays */}
        <Animated.View style={[swipeStyles.overlayRight, rightOpacity]}>
          <Ionicons name="heart" size={22} color={Colors.success} />
          <Text style={[swipeStyles.overlayText, { color: Colors.success }]}>SAVE</Text>
        </Animated.View>
        <Animated.View style={[swipeStyles.overlayLeft, leftOpacity]}>
          <Ionicons name="close" size={22} color={Colors.streak} />
          <Text style={[swipeStyles.overlayText, { color: Colors.streak }]}>SKIP</Text>
        </Animated.View>
        <Animated.View style={[swipeStyles.overlayUp, upOpacity]}>
          <Ionicons name="flash" size={22} color={Colors.xp} />
          <Text style={[swipeStyles.overlayText, { color: Colors.xp }]}>JOIN</Text>
        </Animated.View>

        {/* ── Image frame — fills all flex space above info ── */}
        <View style={swipeStyles.imageFrame}>
          {exam.bannerImageUrl ? (
            <Image source={{ uri: exam.bannerImageUrl }} style={swipeStyles.bannerImage} resizeMode="cover" />
          ) : (
            <View style={swipeStyles.imageFallback}>
              <Text style={swipeStyles.fallbackEmoji}>{unlocked ? '🎓' : '🔒'}</Text>
            </View>
          )}
          {/* Saved chip top-left */}
          {saved && (
            <View style={swipeStyles.savedChip}>
              <Ionicons name="heart" size={11} color={Colors.streak} />
              <Text style={swipeStyles.savedChipText}>Saved</Text>
            </View>
          )}
          {/* Lock/unlock badge top-right */}
          <View style={[swipeStyles.xpBadge, {
            backgroundColor: unlocked ? Colors.xp + 'dd' : 'rgba(34,34,34,0.85)',
            borderColor: unlocked ? Colors.xp : Colors.borderAlt,
          }]}>
            <Text style={[swipeStyles.xpBadgeText, { color: unlocked ? '#3A332C' : Colors.textMuted }]}>
              {unlocked ? '✓' : '🔒'} {exam.requiredXP} XP
            </Text>
          </View>

          {/* Tantan-style info overlay — pinned to bottom of image */}
          <View style={swipeStyles.infoOverlay}>
            <Text style={swipeStyles.overlayTitle} numberOfLines={2}>{exam.title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={swipeStyles.chipsScroll}>
              <View style={[swipeStyles.chip, { backgroundColor: matchColor + '20', borderColor: matchColor + '55' }]}>
                <Text style={[swipeStyles.chipText, { color: matchColor }]}>🔥 {score}%</Text>
              </View>
              {exam.difficulty && (() => {
                const cfg = DIFFICULTY_CONFIG[exam.difficulty];
                return (
                  <View style={[swipeStyles.chip, { backgroundColor: cfg.color + '20', borderColor: cfg.color + '55' }]}>
                    <Text style={[swipeStyles.chipText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                );
              })()}
              {exam.durationHours ? (
                <View style={[swipeStyles.chip, { backgroundColor: Colors.textMuted + '20', borderColor: Colors.borderAlt }]}>
                  <Text style={[swipeStyles.chipText, { color: Colors.textSub }]}>
                    ⏳ {exam.durationHours === 1 ? '1h' : `${exam.durationHours}h`}
                  </Text>
                </View>
              ) : null}
              <View style={[swipeStyles.chip, { backgroundColor: Colors.skill + '20', borderColor: Colors.skill + '55' }]}>
                <Text style={[swipeStyles.chipText, { color: Colors.skill }]}>📜 PDF Cert</Text>
              </View>
              <View style={[swipeStyles.chip, { backgroundColor: Colors.xp + '20', borderColor: Colors.xp + '55' }]}>
                <Text style={[swipeStyles.chipText, { color: Colors.xp }]}>⚡ {exam.requiredXP} XP</Text>
              </View>
              {exam.issuer ? (
                <View style={[swipeStyles.chip, { backgroundColor: Colors.borderAlt, borderColor: Colors.border }]}>
                  <Ionicons name="business-outline" size={10} color={Colors.textMuted} />
                  <Text style={[swipeStyles.chipText, { color: Colors.textMuted }]}>{exam.issuer}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function BackCard({ stackIndex }: { stackIndex: number }) {
  return (
    <View style={[
      swipeStyles.card, swipeStyles.backCard,
      { transform: [{ scale: 1 - stackIndex * 0.04 }, { translateY: stackIndex * -14 }], zIndex: -stackIndex },
    ]} />
  );
}

// ─── EXAM DETAIL MODAL ────────────────────────────────────────────────────────

function ExamDetailModal({ exam, userXP, saved, registered, onClose, onSave, onRegister }: {
  exam: CertExam | null; userXP: number; saved: boolean; registered: boolean;
  onClose: () => void; onSave: () => void; onRegister: () => void;
}) {
  if (!exam) return null;
  const unlocked = userXP >= exam.requiredXP;
  const slots = slotsLeft(exam);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          {exam.bannerImageUrl
            ? <Image source={{ uri: exam.bannerImageUrl }} style={modalStyles.emojiBox} resizeMode="cover" />
            : <View style={[modalStyles.emojiBox, { backgroundColor: Colors.xp + '18', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 36 }}>{unlocked ? '🎓' : '🔒'}</Text>
              </View>}
          <View style={modalStyles.headerInfo}>
            <View style={[modalStyles.xpPill, {
              backgroundColor: unlocked ? Colors.xp + '20' : Colors.border,
              borderColor: unlocked ? Colors.xp + '50' : Colors.borderAlt,
            }]}>
              <Text style={[modalStyles.xpPillText, { color: unlocked ? Colors.xp : Colors.textMuted }]}>
                ⚡ {exam.requiredXP} XP required
              </Text>
            </View>
            <Text style={modalStyles.unlockStatus}>
              {unlocked ? '✓ Unlocked' : `🔒 Need ${exam.requiredXP - userXP} more XP`}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={18} color={Colors.textSub} />
          </TouchableOpacity>
        </View>

        <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>
          <Text style={modalStyles.title}>{exam.title}</Text>

          <View style={modalStyles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Text style={modalStyles.metaText}>{formatDate(exam.examDate)}</Text>
            <Text style={modalStyles.dot}> · </Text>
            <Ionicons name="link-outline" size={14} color={Colors.textMuted} />
            <Text style={modalStyles.metaText}> Online</Text>
            <Text style={modalStyles.dot}> · </Text>
            <Text style={[modalStyles.metaText, slots === 0 && { color: Colors.streak }]}>
              {slots > 0 ? `${slots}/${exam.maxSlots} slots` : 'Full'}
            </Text>
          </View>

          {exam.description ? (
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>About this Exam</Text>
              <Text style={modalStyles.description}>{exam.description}</Text>
            </View>
          ) : null}

          {exam.steps && exam.steps.length > 0 && (
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>Exam Steps</Text>
              {exam.steps.map((step, i) => (
                <View key={i} style={modalStyles.stepRow}>
                  <View style={modalStyles.stepNum}>
                    <Text style={modalStyles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={modalStyles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={modalStyles.footer}>
          <View style={modalStyles.xpCostRow}>
            <Text style={modalStyles.xpCostLabel}>XP cost</Text>
            <Text style={modalStyles.xpCostValue}>−{exam.requiredXP} XP</Text>
          </View>
          <View style={modalStyles.footerBtns}>
            <TouchableOpacity
              style={[modalStyles.saveBtn, saved && modalStyles.saveBtnActive]}
              onPress={onSave} activeOpacity={0.8}
            >
              <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18}
                color={saved ? Colors.streak : Colors.textSub} />
              <Text style={[modalStyles.saveBtnText, saved && { color: Colors.streak }]}>
                {saved ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                modalStyles.registerBtn,
                registered
                  ? modalStyles.registerBtnRegistered
                  : (!unlocked || slots === 0) && modalStyles.registerBtnDisabled,
              ]}
              onPress={!unlocked || slots === 0 || registered ? undefined : onRegister}
              activeOpacity={0.85}
            >
              {registered ? (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={[modalStyles.registerBtnText, { color: Colors.success }]}>Registered</Text>
                </>
              ) : (
                <Text style={modalStyles.registerBtnText}>
                  {!unlocked ? '🔒 Locked' : slots === 0 ? 'Exam Full' : 'Register Now →'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── REGISTER CONFIRM SHEET ───────────────────────────────────────────────────

function RegisterConfirmSheet({ exam, userXP, onClose, onConfirm, loading }: {
  exam: CertExam | null; userXP: number;
  onClose: () => void; onConfirm: () => void; loading: boolean;
}) {
  if (!exam) return null;
  const afterXP = userXP - exam.requiredXP;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={confirmStyles.container}>
        <View style={confirmStyles.handle} />
        <Text style={confirmStyles.title}>Confirm Registration</Text>
        <Text style={confirmStyles.subtitle}>XP will be deducted from your wallet:</Text>

        <View style={confirmStyles.examRow}>
          {exam.bannerImageUrl
            ? <Image source={{ uri: exam.bannerImageUrl }} style={confirmStyles.examThumb} resizeMode="cover" />
            : <Text style={confirmStyles.examEmoji}>🎓</Text>}
          <View style={{ flex: 1 }}>
            <Text style={confirmStyles.examTitle}>{exam.title}</Text>
            <Text style={confirmStyles.examDate}>{formatDate(exam.examDate)}</Text>
          </View>
        </View>
        <View style={confirmStyles.divider} />

        <View style={confirmStyles.xpCalc}>
          <View style={confirmStyles.xpRow}>
            <Text style={confirmStyles.xpLabel}>Current XP</Text>
            <Text style={[confirmStyles.xpValue, { color: Colors.xp }]}>{userXP} XP</Text>
          </View>
          <View style={confirmStyles.xpRow}>
            <Text style={confirmStyles.xpLabel}>Cost</Text>
            <Text style={[confirmStyles.xpValue, { color: Colors.streak }]}>−{exam.requiredXP} XP</Text>
          </View>
          <View style={[confirmStyles.xpRow, confirmStyles.xpRowTotal]}>
            <Text style={confirmStyles.xpLabelBold}>After registration</Text>
            <Text style={[confirmStyles.xpValue, confirmStyles.xpValueBold, { color: afterXP >= 0 ? Colors.xp : Colors.streak }]}>
              {afterXP} XP
            </Text>
          </View>
        </View>

        <View style={confirmStyles.spacer} />

        <TouchableOpacity
          style={[confirmStyles.confirmBtn, loading && { opacity: 0.5 }]}
          onPress={onConfirm} disabled={loading} activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.bg} size="small" />
            : <Text style={confirmStyles.confirmBtnText}>Confirm Registration 🚀</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={confirmStyles.cancelBtn} onPress={onClose} disabled={loading}>
          <Text style={confirmStyles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      RNAnimated.sequence([
        RNAnimated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: false }),
        RNAnimated.delay(2000),
        RNAnimated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start();
    }
  }, [visible, message]);
  return (
    <RNAnimated.View style={[toastStyles.toast, { opacity }]} pointerEvents="none">
      <Text style={toastStyles.text}>{message}</Text>
    </RNAnimated.View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

type ActiveTab = 'discover' | 'browse' | 'saved' | 'registered';
type BrowseFilter = 'All' | 'Unlocked' | 'Locked';

const TABS: { key: ActiveTab; label: string; icon: string }[] = [
  { key: 'discover',   label: 'Discover',   icon: 'sparkles' },
  { key: 'browse',     label: 'Browse',     icon: 'grid' },
  { key: 'saved',      label: 'Saved',      icon: 'heart' },
  { key: 'registered', label: 'Registered', icon: 'ribbon' },
];

export default function CertMarketScreen() {
  const user = auth.currentUser;
  const { xp: userXP, uid, displayName } = useXPProfile();

  const [activeTab,      setActiveTab]      = useState<ActiveTab>('discover');
  const [exams,          setExams]          = useState<CertExam[]>([]);
  const [savedIds,       setSavedIds]       = useState<string[]>([]);
  const [registrations,  setRegistrations]  = useState<ExamRegistration[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [selectedExam,   setSelectedExam]   = useState<CertExam | null>(null);
  const [registerTarget, setRegisterTarget] = useState<CertExam | null>(null);
  const [registering,    setRegistering]    = useState(false);
  const [swipeIndex,     setSwipeIndex]     = useState(0);
  const [toastMsg,       setToastMsg]       = useState('');
  const [toastVisible,   setToastVisible]   = useState(false);
  const [browseFilter,   setBrowseFilter]   = useState<BrowseFilter>('All');
  const [searchQuery,    setSearchQuery]    = useState('');

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(v => !v);
    setTimeout(() => setToastVisible(false), 3000);
  };

  // Load exams
  useEffect(() => {
    getCertExams().then(data => {
      const sorted = (data as CertExam[]).sort((a, b) => {
        const da = a.examDate?.toDate?.() ?? new Date(0);
        const db2 = b.examDate?.toDate?.() ?? new Date(0);
        return da.getTime() - db2.getTime();
      });
      setExams(sorted);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Real-time saved exams
  useEffect(() => {
    if (!uid) return;
    return listenSavedCerts(uid, setSavedIds);
  }, [uid]);

  // Load registrations on focus
  useFocusEffect(useCallback(() => {
    if (!uid) return;
    getUserExamRegistrations(uid).then(data => setRegistrations(data as ExamRegistration[]));
  }, [uid]));

  const registeredIds = new Set(registrations.map(r => r.examId));
  const savedSet      = new Set(savedIds);

  // ── Swipe handlers ────────────────────────────────────────────────────────

  const handleSwipeRight = useCallback(async () => {
    const exam = exams[swipeIndex];
    if (!exam) return;
    setSwipeIndex(i => i + 1);
    translateX.value = 0;
    translateY.value = 0;
    showToast('Saved ♡');
    if (uid) saveCert(uid, exam.id).catch(() => {});
  }, [exams, swipeIndex, uid]);

  const handleSwipeLeft = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    setSwipeIndex(i => i + 1);
  }, []);

  const handleSwipeUp = useCallback(() => {
    const exam = exams[swipeIndex];
    if (!exam) return;
    setSwipeIndex(i => i + 1);
    translateX.value = 0;
    translateY.value = 0;
    setRegisterTarget(exam);
  }, [exams, swipeIndex]);

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd(e => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(W + 100, { duration: 220 }, () => runOnJS(handleSwipeRight)());
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-(W + 100), { duration: 220 }, () => runOnJS(handleSwipeLeft)());
      } else if (e.translationY < -SWIPE_THRESHOLD) {
        translateY.value = withTiming(-(CARD_H + 100), { duration: 220 }, () => runOnJS(handleSwipeUp)());
      } else {
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
      }
    });

  // ── Register flow ─────────────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!user || !registerTarget || !uid) return;
    setRegistering(true);
    try {
      await registerForExam(
        registerTarget.id,
        { uid, xp: userXP, displayName: displayName || user.displayName || '', email: user.email || '' },
        registerTarget,
      );
      // Optimistic remove from saved list + background Firestore sync
      if (savedSet.has(registerTarget.id)) {
        setSavedIds(prev => prev.filter(id => id !== registerTarget.id));
        unsaveCert(uid, registerTarget.id).catch(() => {});
      }
      setRegisterTarget(null);
      setSelectedExam(null);
      getUserExamRegistrations(uid).then(data => setRegistrations(data as ExamRegistration[]));
      showToast(`Registered! ⚡ −${registerTarget.requiredXP} XP deducted`);
      setActiveTab('registered');
    } catch (e: any) {
      if (e.message === 'INSUFFICIENT_XP') {
        showToast(`Need ${registerTarget.requiredXP - userXP} more XP to register`);
      } else if (e.message === 'EXAM_FULL') {
        showToast('This exam is fully booked');
      } else if (e.message === 'ALREADY_REGISTERED') {
        showToast('Already registered for this exam');
        setActiveTab('registered');
      } else {
        Alert.alert('Registration failed', 'Please try again.');
      }
      setRegisterTarget(null);
    } finally {
      setRegistering(false);
    }
  };

  const handleSaveToggle = async (examId: string) => {
    if (!uid) return;
    if (savedSet.has(examId)) {
      unsaveCert(uid, examId).catch(() => {});
    } else {
      saveCert(uid, examId).catch(() => {});
    }
  };

  // ── Filtered browse list ──────────────────────────────────────────────────

  const browseExams = exams.filter(e => {
    const matchSearch = !searchQuery.trim() ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = browseFilter === 'All'
      ? true
      : browseFilter === 'Unlocked'
      ? userXP >= e.requiredXP
      : userXP < e.requiredXP;
    return matchSearch && matchFilter;
  });

  const browseSections = useMemo(() => {
    const map = new Map<string, CertExam[]>();
    for (const exam of browseExams) {
      const key = formatDate(exam.examDate) || 'No date set';
      const arr = map.get(key) ?? [];
      arr.push(exam);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [browseExams]);

  const savedExams    = exams.filter(e => savedSet.has(e.id));
  const discoverExams = exams.slice(swipeIndex);

  // ── Sub-screens ───────────────────────────────────────────────────────────

  const renderDiscover = () => {
    if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color={Colors.xp} />;

    if (exams.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>🎓</Text>
          <Text style={styles.emptyTitle}>No exams available yet</Text>
          <Text style={styles.emptySub}>Check back soon — new certification exams are being added.</Text>
        </View>
      );
    }

    if (discoverExams.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>🎉</Text>
          <Text style={styles.emptyTitle}>You've seen all exams!</Text>
          <Text style={styles.emptySub}>Switch to Browse to filter by XP status.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setActiveTab('browse')}>
            <Text style={styles.emptyBtnText}>Browse All Exams →</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const currentExam = discoverExams[0];
    const isSaved = savedSet.has(currentExam.id);

    return (
      <View style={styles.swipeArea}>
        {/* Fixed-size card stack container */}
        <View style={styles.cardStack}>
          {discoverExams.slice(1, 3).map((_, i) => (
            <BackCard key={i + 1} stackIndex={i + 1} />
          ))}
          <SwipeCard
            exam={currentExam}
            userXP={userXP}
            saved={isSaved}
            translateX={translateX}
            translateY={translateY}
            gesture={panGesture}
            onTap={() => setSelectedExam(currentExam)}
            onSkip={handleSwipeLeft}
            onSave={handleSwipeRight}
            onJoin={() => setRegisterTarget(currentExam)}
          />
        </View>

        {/* Action bar — Tantan style, outside the card */}
        <View style={styles.discoverActions}>
          <TouchableOpacity style={styles.daSkip} onPress={handleSwipeLeft} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={30} color={Colors.streak} />
            <Text style={[styles.daLabel, { color: Colors.streak }]}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.daJoin} onPress={() => setRegisterTarget(currentExam)} activeOpacity={0.85}>
            <Ionicons name="flash" size={24} color={Colors.bg} />
            <Text style={styles.daJoinLabel}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.daInfo} onPress={() => setSelectedExam(currentExam)} activeOpacity={0.7}>
            <Ionicons name="chevron-up" size={24} color={Colors.textSub} />
            <Text style={[styles.daLabel, { color: Colors.textSub }]}>View detail</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.daSave, isSaved
              ? { borderColor: Colors.streak + '60', backgroundColor: Colors.streak + '15' }
              : { borderColor: Colors.success + '60', backgroundColor: Colors.success + '15' }]}
            onPress={handleSwipeRight} activeOpacity={0.7}>
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={30}
              color={isSaved ? Colors.streak : Colors.success} />
            <Text style={[styles.daLabel, { color: isSaved ? Colors.streak : Colors.success }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.swipeHint}>Swipe ← skip · → save · ↑ join</Text>
        <Text style={styles.deckCounter}>{swipeIndex + 1} / {exams.length}</Text>
      </View>
    );
  };

  const renderBrowse = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search exams…"
          placeholderTextColor={Colors.textMuted}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {(['All', 'Unlocked', 'Locked'] as BrowseFilter[]).map(f => {
          const color = f === 'Unlocked' ? Colors.success : f === 'Locked' ? Colors.streak : Colors.xp;
          const icon = f === 'Unlocked' ? 'lock-open-outline' : f === 'Locked' ? 'lock-closed-outline' : 'grid-outline';
          const active = browseFilter === f;
          return (
            <TouchableOpacity key={f} onPress={() => setBrowseFilter(f)}
              style={[styles.filterPill, {
                backgroundColor: active ? color + '28' : color + '12',
                borderColor: active ? color : color + '50',
              }]}>
              <Ionicons name={icon as any} size={12} color={color} />
              <Text style={[styles.filterPillText, { color, fontWeight: active ? '800' : '600' }]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.xp} />
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={browseSections}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
          renderSectionHeader={({ section }) => (
            <View style={listStyles.sectionHeader}>
              <View style={listStyles.sectionDot} />
              <Text style={listStyles.sectionText}>{section.title}</Text>
              <View style={listStyles.sectionCount}>
                <Text style={listStyles.sectionCountText}>{section.data.length}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 44 }}>🔍</Text>
              <Text style={styles.emptyTitle}>{exams.length === 0 ? 'No exams yet' : 'No results'}</Text>
              <Text style={styles.emptySub}>{exams.length === 0 ? 'Check back soon.' : 'Try a different filter.'}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ExamListCard
              exam={item} userXP={userXP}
              saved={savedSet.has(item.id)}
              registered={registeredIds.has(item.id)}
              onPress={() => setSelectedExam(item)}
              onSave={() => handleSaveToggle(item.id)}
            />
          )}
        />
      )}
    </View>
  );

  const renderSaved = () => (
    <FlatList
      data={savedExams}
      keyExtractor={item => item.id}
      contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 44 }}>💔</Text>
          <Text style={styles.emptyTitle}>No saved exams</Text>
          <Text style={styles.emptySub}>Swipe right or tap ♡ to save exams here.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setActiveTab('discover')}>
            <Text style={styles.emptyBtnText}>Start Discovering →</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => (
        <ExamListCard
          exam={item} userXP={userXP} saved
          registered={registeredIds.has(item.id)}
          onPress={() => setSelectedExam(item)}
          onSave={() => handleSaveToggle(item.id)}
        />
      )}
    />
  );

  const renderRegistered = () => {
    if (registrations.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 44 }}>🎟</Text>
          <Text style={styles.emptyTitle}>No registrations yet</Text>
          <Text style={styles.emptySub}>Register for a cert exam to track it here.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setActiveTab('discover')}>
            <Text style={styles.emptyBtnText}>Discover Exams →</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <FlatList
        data={registrations}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const exam = exams.find(e => e.id === item.examId);
          const cfg  = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.registered;
          return (
            <View style={regStyles.card}>
              {/* Left accent strip — status colour */}
              <View style={[regStyles.accent, { backgroundColor: cfg.color }]} />
              <View style={regStyles.body}>
                {/* Thumbnail — 80×80, same as saved card */}
                {exam?.bannerImageUrl
                  ? <Image source={{ uri: exam.bannerImageUrl }} style={regStyles.thumb} resizeMode="cover" />
                  : <View style={[regStyles.thumbBox, { backgroundColor: cfg.color + '18' }]}>
                      <Text style={{ fontSize: 28 }}>🎓</Text>
                    </View>}
                <View style={regStyles.info}>
                  <Text style={regStyles.date}>{exam ? formatDate(exam.examDate) : ''}</Text>
                  <Text style={regStyles.title} numberOfLines={2}>{exam?.title ?? item.examId}</Text>
                  <View style={[regStyles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.color + '35' }]}>
                    <Text style={[regStyles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <View style={regStyles.infoRow}>
                    <Ionicons name="flash-outline" size={12} color={Colors.xp} />
                    <Text style={regStyles.infoText}>−{exam?.requiredXP ?? '?'} XP spent</Text>
                  </View>
                  {exam?.examUrl ? (
                    <TouchableOpacity style={regStyles.visitBtn} onPress={() => Linking.openURL(exam!.examUrl)}>
                      <Ionicons name="open-outline" size={13} color={Colors.quest} />
                      <Text style={regStyles.visitBtnText}>Visit Exam Portal</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* XP balance chip */}
      <View style={styles.xpChip}>
        <Ionicons name="flash" size={13} color={Colors.xp} />
        <Text style={styles.xpChipText}>{userXP} XP balance</Text>
      </View>

      {/* Top tab nav */}
      <View style={styles.tabRow}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const count = tab.key === 'saved' ? savedIds.length
            : tab.key === 'registered' ? registrations.length : 0;
          return (
            <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => setActiveTab(tab.key)}>
              <View style={styles.tabInner}>
                <Ionicons
                  name={(isActive ? tab.icon : `${tab.icon}-outline`) as any}
                  size={14} color={isActive ? Colors.xp : Colors.textMuted}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                {count > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{count}</Text>
                  </View>
                )}
              </View>
              {isActive && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.tabDivider} />

      {/* Sub-screen */}
      <View style={{ flex: 1 }}>
        {activeTab === 'discover'    && renderDiscover()}
        {activeTab === 'browse'      && renderBrowse()}
        {activeTab === 'saved'       && renderSaved()}
        {activeTab === 'registered'  && renderRegistered()}
      </View>

      {/* Modals */}
      <ExamDetailModal
        exam={selectedExam}
        userXP={userXP}
        saved={selectedExam ? savedSet.has(selectedExam.id) : false}
        registered={selectedExam ? registeredIds.has(selectedExam.id) : false}
        onClose={() => setSelectedExam(null)}
        onSave={() => selectedExam && handleSaveToggle(selectedExam.id)}
        onRegister={() => { setRegisterTarget(selectedExam); setSelectedExam(null); }}
      />
      <RegisterConfirmSheet
        exam={registerTarget}
        userXP={userXP}
        onClose={() => setRegisterTarget(null)}
        onConfirm={handleRegister}
        loading={registering}
      />
      <Toast message={toastMsg} visible={toastVisible} />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  xpChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-end', marginRight: 16, marginTop: 8, marginBottom: 2,
    backgroundColor: Colors.xp + '18', borderWidth: 1, borderColor: Colors.xp + '40',
    borderRadius: Radius.xxl, paddingHorizontal: 10, paddingVertical: 4,
  },
  xpChipText: { color: Colors.xp, fontSize: FontSize.xs, fontWeight: '700' },

  tabRow:          { flexDirection: 'row', paddingHorizontal: 12, gap: 4, paddingTop: 6 },
  tabItem:         { flex: 1, alignItems: 'center', paddingBottom: 8 },
  tabInner:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabLabel:        { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  tabLabelActive:  { color: Colors.text, fontWeight: '700' },
  tabUnderline:    { height: 2, width: '80%', backgroundColor: Colors.xp, borderRadius: 1, marginTop: 4 },
  tabDivider:      { height: 1, backgroundColor: Colors.border, marginBottom: 4 },
  tabBadge:        { backgroundColor: Colors.xp, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText:    { color: Colors.bg, fontSize: 9, fontWeight: '800' },

  swipeArea: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-start',
    paddingTop: 8, paddingBottom: 16,
  },
  cardStack: {
    width: CARD_W, height: CARD_H, alignSelf: 'center',
  },
  discoverActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 14, marginTop: 18, paddingHorizontal: 14,
  },
  daSkip: {
    alignItems: 'center', justifyContent: 'center',
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 1.5, borderColor: Colors.streak + '60',
    backgroundColor: Colors.streak + '15',
  },
  daSave: {
    alignItems: 'center', justifyContent: 'center',
    width: 60, height: 60, borderRadius: 30, borderWidth: 1.5,
  },
  daJoin: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 28, height: 60, borderRadius: 30,
    backgroundColor: Colors.xp,
  },
  daInfo: {
    alignItems: 'center', justifyContent: 'center',
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5, borderColor: Colors.borderAlt,
  },
  daLabel:    { fontSize: 10, fontWeight: '700', marginTop: 2 },
  daJoinLabel:{ color: Colors.bg, fontWeight: '800', fontSize: FontSize.sm },
  swipeHint:  { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 10 },
  deckCounter:{ color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 4 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 8, marginBottom: 2,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xl, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.sm },

  filterRow:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4, gap: 8 },
  filterPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 5 },
  filterPillText: { fontSize: 11, fontWeight: '600' },

  gridRow:    { paddingHorizontal: 16, gap: 12 },
  gridContent:{ paddingTop: 8, paddingBottom: 40 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  emptySub:   { color: Colors.textSub, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  emptyBtn:   { marginTop: 8, backgroundColor: Colors.xp + '18', borderWidth: 1, borderColor: Colors.xp + '40', borderRadius: Radius.xl, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: Colors.xp, fontWeight: '800', fontSize: FontSize.sm },
});

// ─── SWIPE CARD STYLES ────────────────────────────────────────────────────────

const swipeStyles = StyleSheet.create({
  // Card — fixed Tinder-style dimensions
  card: {
    width: CARD_W, height: CARD_H,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', position: 'absolute', zIndex: 10,
    flexDirection: 'column',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 12,
  },
  backCard: { zIndex: 0, shadowOpacity: 0.12, elevation: 3 },

  // Image — fills all flex space above info + action bar
  imageFrame: { flex: 1, overflow: 'hidden' },
  bannerImage: { width: '100%', height: '100%' },
  imageFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.xp + '18',
  },
  fallbackEmoji: { fontSize: 72 },

  // Image overlays
  savedChip: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: Radius.xxl,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.streak + '70',
  },
  savedChipText: { color: Colors.streak, fontSize: 11, fontWeight: '700' },
  xpBadge: {
    position: 'absolute', top: 12, right: 12,
    borderWidth: 1, borderRadius: Radius.xxl, paddingHorizontal: 10, paddingVertical: 5,
  },
  xpBadgeText: { fontSize: FontSize.xs, fontWeight: '800' },

  // Tantan-style info overlay — pinned to bottom of image
  infoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingTop: 40, paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  overlayTitle: { color: '#fff', fontSize: FontSize.md, fontWeight: '800', lineHeight: 22, marginBottom: 6 },
  chipsScroll: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: Radius.xxl, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 },
  chipText: { fontSize: 10, fontWeight: '700' },

  // Swipe direction overlays
  overlayRight: {
    position: 'absolute', top: 20, right: 16, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.success + '20', borderWidth: 2, borderColor: Colors.success,
    borderRadius: Radius.xl, paddingHorizontal: 12, paddingVertical: 8,
  },
  overlayLeft: {
    position: 'absolute', top: 20, left: 16, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.streak + '20', borderWidth: 2, borderColor: Colors.streak,
    borderRadius: Radius.xl, paddingHorizontal: 12, paddingVertical: 8,
  },
  overlayUp: {
    position: 'absolute', top: 20, alignSelf: 'center', zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.xp + '20', borderWidth: 2, borderColor: Colors.xp,
    borderRadius: Radius.xl, paddingHorizontal: 12, paddingVertical: 8,
  },
  overlayText: { fontSize: FontSize.sm, fontWeight: '900', letterSpacing: 1 },
});

// ─── LIST CARD STYLES ─────────────────────────────────────────────────────────

const listStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', marginHorizontal: 16, marginVertical: 5,
  },
  accent:    { width: 3 },
  body:      { flex: 1, flexDirection: 'row', padding: 12, gap: 12, alignItems: 'flex-start' },
  thumbWrap: { position: 'relative' },
  thumb:     { width: 80, height: 80, borderRadius: Radius.md },
  emojiBox:  { width: 80, height: 80, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  thumbFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 30,
               backgroundColor: 'rgba(0,0,0,0.40)', borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md },
  regBadge:  { position: 'absolute', top: 4, left: 4,
               backgroundColor: Colors.success + '20', borderWidth: 1, borderColor: Colors.success + '40',
               borderRadius: Radius.xxl, paddingHorizontal: 5, paddingVertical: 2 },
  regBadgeText: { color: Colors.success, fontSize: 9, fontWeight: '800' },
  info:      { flex: 1, gap: 4 },
  date:      { color: Colors.xp, fontSize: 11, fontWeight: '600' },
  title:     { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700', lineHeight: 18 },
  pillRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  pill:      { borderWidth: 1, borderRadius: Radius.xxl, paddingHorizontal: 7, paddingVertical: 2 },
  pillText:  { fontSize: 10, fontWeight: '700' },
  slots:     { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  saveBtn:   { paddingTop: 2 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 8,
  },
  sectionDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.xp },
  sectionText:      { flex: 1, color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  sectionCount:     { backgroundColor: Colors.xp + '20', borderRadius: Radius.xxl,
                      paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Colors.xp + '40' },
  sectionCountText: { color: Colors.xp, fontSize: 10, fontWeight: '800' },
});

// ─── MODAL STYLES ─────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16,
  },
  emojiBox:     { width: 52, height: 52, borderRadius: Radius.lg, overflow: 'hidden', flexShrink: 0 },
  headerInfo:   { flex: 1, gap: 4 },
  xpPill:       { borderWidth: 1, borderRadius: Radius.xxl, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  xpPillText:   { fontSize: FontSize.xs, fontWeight: '800' },
  unlockStatus: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body:         { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  title:        { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '800', lineHeight: 30, marginBottom: 10 },
  metaRow:      { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  metaText:     { color: Colors.textMuted, fontSize: FontSize.xs },
  dot:          { color: Colors.textMuted, fontSize: FontSize.xs },
  section:      { marginTop: 16 },
  sectionTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', marginBottom: 8 },
  description:  { color: Colors.textSub, fontSize: FontSize.sm, lineHeight: 22 },
  stepRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  stepNum:      { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.xp + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumText:  { color: Colors.xp, fontSize: 11, fontWeight: '800' },
  stepText:     { color: Colors.textSub, fontSize: FontSize.sm, flex: 1, lineHeight: 20 },
  footer: {
    paddingHorizontal: 20, paddingBottom: 40, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: Colors.border, gap: 10,
  },
  xpCostRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpCostLabel:  { color: Colors.textMuted, fontSize: FontSize.sm },
  xpCostValue:  { color: Colors.xp, fontSize: FontSize.lg, fontWeight: '800' },
  footerBtns:   { flexDirection: 'row', gap: 10 },
  saveBtn:      { flex: 0.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, paddingVertical: 14 },
  saveBtnActive:{ borderColor: Colors.streak + '50', backgroundColor: Colors.streak + '12' },
  saveBtnText:  { color: Colors.textSub, fontWeight: '700', fontSize: FontSize.sm },
  registerBtn:           { flex: 0.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.xp, borderWidth: 1, borderColor: 'transparent', borderRadius: Radius.xl, paddingVertical: 14 },
  registerBtnDisabled:   { backgroundColor: Colors.border, borderColor: 'transparent' },
  registerBtnRegistered: { backgroundColor: Colors.success + '12', borderColor: Colors.success + '50' },
  registerBtnText:       { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },
});

// ─── CONFIRM STYLES ───────────────────────────────────────────────────────────

const confirmStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: 24, paddingTop: 20 },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 24 },
  title:     { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800', marginBottom: 4 },
  subtitle:  { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: 20 },
  examRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, borderWidth: 1, borderColor: Colors.border },
  examEmoji: { fontSize: 32, flexShrink: 0 },
  examThumb: { width: 44, height: 44, borderRadius: Radius.md, flexShrink: 0 },
  examTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', lineHeight: 20 },
  examDate:  { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 3 },
  divider:   { height: 1, backgroundColor: Colors.border, marginVertical: 20 },
  xpCalc:    { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  xpRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpRowTotal:{ borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  xpLabel:   { color: Colors.textSub, fontSize: FontSize.sm },
  xpLabelBold:{ color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  xpValue:   { fontSize: FontSize.md, fontWeight: '700' },
  xpValueBold:{ fontSize: FontSize.lg, fontWeight: '800' },
  spacer:    { flex: 1 },
  confirmBtn:    { backgroundColor: Colors.xp, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  confirmBtnText:{ color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },
  cancelBtn:     { alignItems: 'center', paddingVertical: 12, marginBottom: 20 },
  cancelBtnText: { color: Colors.textMuted, fontSize: FontSize.sm },
});

// ─── REGISTRATION CARD STYLES ─────────────────────────────────────────────────

const regStyles = StyleSheet.create({
  card:        { flexDirection: 'row', overflow: 'hidden', marginHorizontal: 16, marginVertical: 5, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  accent:      { width: 3 },
  body:        { flex: 1, flexDirection: 'row', padding: 12, gap: 12, alignItems: 'flex-start' },
  thumb:       { width: 80, height: 80, borderRadius: Radius.md },
  thumbBox:    { width: 80, height: 80, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  info:        { flex: 1, gap: 5 },
  title:       { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700', lineHeight: 20 },
  date:        { color: Colors.xp, fontSize: 11, fontWeight: '600' },
  statusPill:  { borderWidth: 1, borderRadius: Radius.xxl, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusText:  { fontSize: 10, fontWeight: '700' },
  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText:    { color: Colors.textSub, fontSize: 10 },
  visitBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Colors.quest + '12', borderWidth: 1, borderColor: Colors.quest + '35', borderRadius: Radius.lg, alignSelf: 'flex-start', marginTop: 2 },
  visitBtnText:{ color: Colors.quest, fontSize: 10, fontWeight: '700' },
});

// ─── TOAST STYLES ─────────────────────────────────────────────────────────────

const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute', bottom: 30, alignSelf: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xxl, paddingHorizontal: 20, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  text: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
});
