import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, Alert, Linking, Modal, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { registerForExam, getUserExamRegistrations } from '@talentbank/firebase-config';
import type { CertExam, ExamRegistration } from '@talentbank/shared';
import { auth, db } from '../../../lib/firebase';
import { useXPProfile } from '../../../lib/use-xp-profile';
import { Colors, Radius, FontSize, FontFamily } from '../../../constants/theme';

function formatDate(ts: any): string {
  try {
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function XPProgressBar({ xp, required }: { xp: number; required: number }) {
  const pct = required > 0 ? Math.min((xp / required) * 100, 100) : 100;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 900, useNativeDriver: false }).start();
  }, [pct]);

  const barWidth = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View>
      <View style={styles.xpBarTrack}>
        <Animated.View style={[styles.xpBarFill, { width: barWidth }]} />
      </View>
      <View style={styles.xpBarLabels}>
        <Text style={styles.xpBarLabel}>{xp} / {required} XP</Text>
        <Text style={[styles.xpBarLabel, { color: pct >= 100 ? '#8FBF8C' : Colors.textMuted }]}>
          {pct >= 100 ? '✅ Unlocked' : `${Math.round(pct)}%`}
        </Text>
      </View>
    </View>
  );
}

export default function ExamDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, xp: userXP, displayName, loading: profileLoading } = useXPProfile();
  const [exam, setExam] = useState<CertExam | null>(null);
  const [examLoading, setExamLoading] = useState(true);
  const [registration, setRegistration] = useState<ExamRegistration | null>(null);
  const [registering, setRegistering] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'certExams', id), (snap) => {
      if (snap.exists()) setExam({ id: snap.id, ...snap.data() } as CertExam);
      setExamLoading(false);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user || !id) { setRegistration(null); return; }
      const regs = await getUserExamRegistrations(user.uid);
      const existing = (regs as ExamRegistration[]).find((r) => r.examId === id);
      setRegistration(existing ?? null);
    });
    return () => unsubAuth();
  }, [id]);

  const handleRegister = async () => {
    if (!exam || !uid) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setRegistering(true);
    try {
      await registerForExam(
        exam.id,
        { uid, xp: userXP, displayName: displayName || currentUser.displayName || '', email: currentUser.email || '' },
        exam,
      );
      const regs = await getUserExamRegistrations(uid);
      const existing = (regs as ExamRegistration[]).find((r) => r.examId === exam.id);
      setRegistration(existing ?? null);
      Alert.alert('Registered! 🎓', `You've successfully registered for ${exam.title}. ${exam.requiredXP} XP has been spent.`);
    } catch (err: any) {
      const msg = err.message;
      if (msg === 'INSUFFICIENT_XP')
        Alert.alert('Not Enough XP', `You need ${exam.requiredXP} XP to redeem. You currently have ${userXP} XP.`);
      else if (msg === 'EXAM_FULL')
        Alert.alert('Exam Full', 'All slots have been taken for this exam.');
      else if (msg === 'ALREADY_REGISTERED')
        Alert.alert('Already Registered', 'You are already registered for this exam.');
      else
        Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  if (examLoading || profileLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!exam) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Exam not found.</Text>
      </View>
    );
  }

  const unlocked   = userXP >= exam.requiredXP;
  const isFull     = exam.registeredCount >= exam.maxSlots;
  const slotsLeft  = exam.maxSlots - exam.registeredCount;
  const slotsPct   = exam.maxSlots > 0 ? Math.min((exam.registeredCount / exam.maxSlots) * 100, 100) : 0;
  const slotsColor = slotsPct >= 80 ? Colors.streak : slotsPct >= 60 ? Colors.xp : Colors.quest;

  const btnDisabled = !unlocked || isFull || !!registration || registering;
  const btnLabel = registering
    ? 'Registering…'
    : registration
    ? '✅ Registered'
    : isFull
    ? 'Exam Full'
    : !unlocked
    ? `🔒 ${exam.requiredXP} XP Required`
    : `Spend ${exam.requiredXP} XP — Register`;

  return (
    <View style={styles.container}>
      {/* Fixed back button */}
      <TouchableOpacity style={styles.fixedBackBtn} onPress={() => router.back()} activeOpacity={0.8}>
        <Text style={styles.fixedBackLabel}>← Back</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner image or spacer */}
        {(exam as any).bannerImageUrl ? (
          <Image
            source={{ uri: (exam as any).bannerImageUrl }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        ) : (
          <View style={{ height: 100 }} />
        )}

        {/* Title section */}
        <View style={styles.titleSection}>
          <Text style={styles.examEmoji}>🎓</Text>
          <Text style={styles.examTitle}>{exam.title}</Text>
          {exam.description ? (
            <Text style={styles.examDescription}>{exam.description}</Text>
          ) : null}
        </View>

        {/* Info chips */}
        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>📅 {formatDate(exam.examDate)}</Text>
          </View>
          <TouchableOpacity
            style={styles.chip}
            onPress={() => exam.examUrl && Linking.openURL(exam.examUrl)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, { color: Colors.quest }]}>🔗 Online — Join</Text>
          </TouchableOpacity>
        </View>

        {/* Preparation checklist */}
        {(exam as any).steps && (exam as any).steps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preparation Checklist</Text>
            {(exam as any).steps.map((step: string, i: number) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {/* XP requirement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>XP Requirement</Text>
          <XPProgressBar xp={userXP} required={exam.requiredXP} />
          {!unlocked && (
            <TouchableOpacity
              style={styles.earnXpLink}
              onPress={() => router.push('/wallet/earn-xp')}
              activeOpacity={0.8}
            >
              <Text style={styles.earnXpLinkText}>⚡ Earn more XP →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Slots */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <View style={styles.seatsBar}>
            <View style={[styles.seatsBarFill, { width: `${slotsPct}%`, backgroundColor: slotsColor }]} />
          </View>
          <Text style={styles.slotsLabel}>
            {isFull ? 'No slots remaining' : `${slotsLeft} of ${exam.maxSlots} slots remaining`}
          </Text>
        </View>

        {/* Register button */}
        <View style={styles.registerSection}>
          <TouchableOpacity
            style={[styles.registerBtn, btnDisabled && styles.registerBtnDisabled]}
            onPress={() => {
              if (!btnDisabled) setShowConfirm(true);
            }}
            disabled={btnDisabled}
            activeOpacity={0.85}
          >
            <Text style={[styles.registerBtnText, btnDisabled && styles.registerBtnTextDisabled]}>
              {btnLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Certificate download */}
        {registration?.status === 'passed' && (registration as any)?.certPdfUrl ? (
          <View style={[styles.registerSection, { marginTop: 12 }]}>
            <TouchableOpacity
              style={styles.certBtn}
              onPress={() => Linking.openURL((registration as any).certPdfUrl)}
              activeOpacity={0.85}
            >
              <Text style={styles.certBtnText}>📄 Download Certificate</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* XP Spend Confirmation Modal */}
      <Modal visible={showConfirm} transparent animationType="slide" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Redeem XP to Register?</Text>
            <Text style={styles.confirmBody}>
              This will spend {exam.requiredXP} XP from your balance to register for this exam.
            </Text>

            <View style={styles.confirmTable}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Your XP</Text>
                <Text style={styles.confirmValue}>{userXP} XP</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Cost</Text>
                <Text style={[styles.confirmValue, { color: Colors.streak }]}>−{exam.requiredXP} XP</Text>
              </View>
              <View style={[styles.confirmRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.confirmLabel}>After</Text>
                <Text style={[styles.confirmValue, { color: Colors.xp }]}>{userXP - exam.requiredXP} XP</Text>
              </View>
            </View>

            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowConfirm(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => { setShowConfirm(false); handleRegister(); }}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnText}>Confirm & Spend</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.streak, fontSize: FontSize.md },

  fixedBackBtn: {
    position: 'absolute', top: 52, left: 16, zIndex: 10,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10,
    minHeight: 44,
  },
  fixedBackLabel: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },

  bannerImage: { width: '100%', height: 220, backgroundColor: Colors.surface },

  titleSection:    { paddingHorizontal: 20, marginBottom: 16, paddingTop: 16 },
  examEmoji:       { fontSize: 48, marginBottom: 10 },
  examTitle:       { color: Colors.text, fontSize: 26, fontWeight: '800', lineHeight: 34, marginBottom: 8, fontFamily: FontFamily.heading },
  examDescription: { color: Colors.textSub, fontSize: FontSize.sm, lineHeight: 22 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 20 },
  chip: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipText: { color: Colors.text, fontSize: FontSize.sm },

  section:      { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', marginBottom: 10 },

  xpBarTrack:  { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  xpBarFill:   { height: 8, backgroundColor: Colors.xp, borderRadius: 4 },
  xpBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xpBarLabel:  { color: Colors.textMuted, fontSize: FontSize.xs },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.xp + '20', alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { color: Colors.xp, fontSize: FontSize.xs, fontWeight: '700' },
  stepText:    { flex: 1, color: Colors.textSub, fontSize: FontSize.sm, lineHeight: 22 },

  earnXpLink:     { marginTop: 10 },
  earnXpLinkText: { color: Colors.xp, fontSize: FontSize.sm, fontWeight: '600' },

  seatsBar:     { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  seatsBarFill: { height: 6, borderRadius: 3 },
  slotsLabel:   { color: Colors.textMuted, fontSize: FontSize.xs },

  registerSection: { paddingHorizontal: 20 },
  registerBtn: {
    backgroundColor: Colors.xp, borderRadius: Radius.xl,
    paddingVertical: 16, alignItems: 'center',
  },
  registerBtnDisabled:     { backgroundColor: Colors.border },
  registerBtnText:         { color: Colors.bg, fontSize: FontSize.md, fontWeight: '800' },
  registerBtnTextDisabled: { color: Colors.textMuted },

  certBtn: {
    backgroundColor: '#8FBF8C20', borderRadius: Radius.xl,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#8FBF8C40',
  },
  certBtnText: { color: '#8FBF8C', fontSize: FontSize.md, fontWeight: '700' },

  // Confirmation modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  confirmCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    padding: 28, gap: 16,
  },
  confirmTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800', textAlign: 'center' },
  confirmBody:  { color: Colors.textSub, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
  confirmTable: {
    backgroundColor: Colors.bg, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  confirmRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  confirmLabel: { color: Colors.textMuted, fontSize: FontSize.sm },
  confirmValue: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  confirmBtns:  { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, backgroundColor: Colors.border,
    borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { color: Colors.textSub, fontSize: FontSize.md, fontWeight: '700' },
  confirmBtn: {
    flex: 1, backgroundColor: Colors.xp,
    borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center',
  },
  confirmBtnText: { color: Colors.bg, fontSize: FontSize.md, fontWeight: '800' },
});
