import { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TalentEvent, EventType } from '@talentbank/shared';
import {
  mockEvents, mockUser, MockEvent, CheckinResult,
  getLevelTitle,
} from '../../lib/mock-data';
import { Colors, EventTypeColors, LevelColors, Radius, FontSize } from '../../constants/theme';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type CheckinStep = 'idle' | 'checking_in' | 'ai_evaluating' | 'minting_sbt' | 'complete' | 'error';

const CHECKIN_STEPS: { id: CheckinStep; label: string; icon: string }[] = [
  { id: 'checking_in',   label: 'Checking in...',   icon: '🎟️' },
  { id: 'ai_evaluating', label: 'AI Evaluating...', icon: '🤖' },
  { id: 'minting_sbt',   label: 'Minting SBT...',   icon: '⛓️' },
  { id: 'complete',      label: 'Complete!',         icon: '🎉' },
];

const FILTERS = ['All', 'Workshop', 'Hackathon', 'Seminar', 'Bootcamp', 'Talk'];

// ─── EVENT CARD ───────────────────────────────────────────────────────────────

function EventCard({ event, onJoin }: { event: MockEvent; onJoin: () => void }) {
  const typeColor = EventTypeColors[event.type] ?? Colors.textMuted;

  return (
    <View style={[styles.card, { borderColor: typeColor + '20' }]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardEmoji, { backgroundColor: typeColor + '18' }]}>
          <Text style={styles.cardEmojiText}>{event.emoji}</Text>
        </View>
        <View style={styles.cardTopRight}>
          <View style={[styles.typePill, { backgroundColor: typeColor + '18' }]}>
            <Text style={[styles.typeText, { color: typeColor }]}>{event.type}</Text>
          </View>
          <View style={styles.xpPill}>
            <Text style={styles.xpPillText}>+{event.xpReward} XP</Text>
          </View>
        </View>
      </View>

      <Text style={styles.cardTitle}>{event.title}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>{event.description}</Text>
      <Text style={styles.cardDate}>📅 {event.date}</Text>

      <View style={styles.skillsRow}>
        {event.skills.map(skill => (
          <View key={skill} style={styles.skillTag}>
            <Text style={styles.skillTagText}>{skill}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.joinBtn} onPress={onJoin} activeOpacity={0.8}>
        <Text style={styles.joinBtnText}>Join Quest ⚔️</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── CHECKIN STEP ROW ─────────────────────────────────────────────────────────

function StepRow({
  step, activeStep, isDone,
}: { step: typeof CHECKIN_STEPS[0]; activeStep: CheckinStep; isDone: boolean }) {
  const spin = useRef(new Animated.Value(0)).current;
  const isActive = activeStep === step.id && !isDone;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 1200, useNativeDriver: true })
      ).start();
    } else {
      spin.stopAnimation();
    }
  }, [isActive]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const isPast   = CHECKIN_STEPS.findIndex(s => s.id === activeStep) > CHECKIN_STEPS.findIndex(s => s.id === step.id);
  const isFuture = CHECKIN_STEPS.findIndex(s => s.id === activeStep) < CHECKIN_STEPS.findIndex(s => s.id === step.id);

  return (
    <View style={[styles.stepRow, isActive && styles.stepRowActive]}>
      <Animated.Text style={{ fontSize: 20, transform: isActive ? [{ rotate }] : [] }}>
        {isPast || isDone ? '✅' : step.icon}
      </Animated.Text>
      <Text style={[
        styles.stepLabel,
        isPast   && styles.stepLabelDone,
        isActive && styles.stepLabelActive,
        isFuture && styles.stepLabelFuture,
      ]}>
        {step.label}
      </Text>
      {isActive && (
        <View style={styles.stepActiveDot} />
      )}
    </View>
  );
}

// ─── CHECKIN MODAL ────────────────────────────────────────────────────────────

function CheckinModal({
  event, visible, onClose,
}: { event: MockEvent | null; visible: boolean; onClose: () => void }) {
  const [step, setStep]         = useState<CheckinStep>('idle');
  const [walletInput, setWallet] = useState(mockUser.walletAddress);
  const [result, setResult]     = useState<CheckinResult | null>(null);

  // Reset on open
  useEffect(() => {
    if (visible) { setStep('idle'); setResult(null); setWallet(mockUser.walletAddress); }
  }, [visible]);

  // Step machine
  useEffect(() => {
    if (step === 'checking_in') {
      // TODO: BLOCKCHAIN — Call POST /api/v1/checkin { event_id: event.id, wallet_address: walletInput }
      const t = setTimeout(() => setStep('ai_evaluating'), 2000);
      return () => clearTimeout(t);
    }
    if (step === 'ai_evaluating') {
      // TODO: AI — Poll GET /checkin/{id}/status until ai_assessment is returned
      // TODO: AI — Extract skill_name, skill_level, xp_earned, badge_tier from response
      const t = setTimeout(() => setStep('minting_sbt'), 3000);
      return () => clearTimeout(t);
    }
    if (step === 'minting_sbt') {
      // TODO: BLOCKCHAIN — Wait for SBT mintSBT() tx to be mined on Arbitrum Sepolia
      // TODO: BLOCKCHAIN — Store returned txHash and tokenId in Firestore
      const t = setTimeout(() => {
        setResult({
          skill_name:  event?.skills[0] ?? 'Blockchain',
          skill_level: 'intermediate',
          xp_earned:   event?.xpReward ?? 100,
          badge_tier:  'silver',
          txHash:      '0xmock1234567890abcdef1234567890abcdef1234',
        });
        setStep('complete');
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [step, event]);

  const startCheckin = () => {
    if (!walletInput.trim()) return;
    setStep('checking_in');
  };

  const handleClose = () => {
    setStep('idle'); setResult(null);
    onClose();
  };

  if (!event) return null;

  const typeColor = EventTypeColors[event.type] ?? Colors.textMuted;
  const isProcessing = step === 'checking_in' || step === 'ai_evaluating' || step === 'minting_sbt';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.modal}>
        {/* Handle bar */}
        <View style={styles.modalHandle} />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Close button */}
          {!isProcessing && (
            <TouchableOpacity style={styles.modalClose} onPress={handleClose}>
              <Ionicons name="close" size={22} color={Colors.textSub} />
            </TouchableOpacity>
          )}

          {/* Event info header */}
          <View style={styles.modalHeader}>
            <View style={[styles.modalEmoji, { backgroundColor: typeColor + '18' }]}>
              <Text style={{ fontSize: 36 }}>{event.emoji}</Text>
            </View>
            <View style={[styles.modalTypePill, { backgroundColor: typeColor + '18' }]}>
              <Text style={[styles.modalTypeText, { color: typeColor }]}>{event.type}</Text>
            </View>
            <Text style={styles.modalTitle}>{event.title}</Text>
            <Text style={styles.modalDate}>📅 {event.date}</Text>
          </View>

          {/* ── IDLE: wallet input + start ── */}
          {step === 'idle' && (
            <View style={styles.modalBody}>
              <Text style={styles.modalDesc}>{event.description}</Text>

              <View style={styles.xpRewardRow}>
                <Text style={styles.xpRewardLabel}>XP Reward</Text>
                <Text style={styles.xpRewardValue}>+{event.xpReward} XP ⚡</Text>
              </View>

              <Text style={styles.inputLabel}>Your Wallet Address</Text>
              <TextInput
                style={styles.walletInput}
                value={walletInput}
                onChangeText={setWallet}
                placeholder="0x..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                // TODO: BLOCKCHAIN — auto-fill with useAccount().address from WalletConnect
              />
              <Text style={styles.inputHint}>
                {/* TODO: BLOCKCHAIN — replace with "Connected: {address}" when wallet is linked */}
                💡 Connect your wallet to auto-fill this
              </Text>

              <TouchableOpacity
                style={[styles.startBtn, !walletInput.trim() && styles.startBtnDisabled]}
                onPress={startCheckin}
                disabled={!walletInput.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.startBtnText}>Start Check-In 🎟️</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── PROCESSING: step progress ── */}
          {(isProcessing || step === 'complete') && (
            <View style={styles.modalBody}>
              <Text style={styles.processingTitle}>
                {step === 'complete' ? 'All done! 🎉' : 'Processing...'}
              </Text>
              <Text style={styles.processingSubtitle}>
                {step === 'complete'
                  ? 'Your SBT badge is minted on-chain!'
                  : 'Sit tight, this takes a few seconds ☕'}
              </Text>

              <View style={styles.stepsCard}>
                {CHECKIN_STEPS.map(s => (
                  <StepRow
                    key={s.id}
                    step={s}
                    activeStep={step}
                    isDone={step === 'complete'}
                  />
                ))}
              </View>

              {/* Result card after complete */}
              {step === 'complete' && result && (
                <View style={styles.resultCard}>
                  <View style={[styles.resultBadge, { backgroundColor: event.badgeColor }]}>
                    <Text style={{ fontSize: 38 }}>{event.badgeEmoji}</Text>
                  </View>

                  <Text style={styles.resultSkill}>{result.skill_name}</Text>

                  <View style={styles.resultRow}>
                    <View style={[styles.resultLevelPill, { backgroundColor: LevelColors[result.skill_level] + '20' }]}>
                      <Text style={[styles.resultLevelText, { color: LevelColors[result.skill_level] }]}>
                        {result.skill_level}
                      </Text>
                    </View>
                    <View style={styles.resultXpPill}>
                      <Text style={styles.resultXpText}>+{result.xp_earned} XP ⚡</Text>
                    </View>
                    <View style={styles.resultTierPill}>
                      <Text style={styles.resultTierText}>{result.badge_tier.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.txRow}>
                    <Text style={styles.txLabel}>TX Hash</Text>
                    <Text style={styles.txHash}>{result.txHash.slice(0, 10)}...{result.txHash.slice(-6)}</Text>
                    {/* TODO: BLOCKCHAIN — add "View on Arbiscan" link using Linking.openURL */}
                  </View>
                </View>
              )}

              {step === 'complete' && (
                <TouchableOpacity style={styles.doneBtn} onPress={handleClose} activeOpacity={0.8}>
                  <Text style={styles.doneBtnText}>View in Wallet 💎</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <View style={styles.modalBody}>
              <Text style={styles.errorText}>Something went wrong 😬</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => setStep('idle')}>
                <Text style={styles.retryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const [activeFilter, setFilter] = useState('All');
  const [selectedEvent, setSelected] = useState<MockEvent | null>(null);
  const [modalVisible, setModal] = useState(false);

  // TODO: FIREBASE — replace mockEvents with real Firestore listener:
  // const [events, setEvents] = useState<TalentEvent[]>([]);
  // useEffect(() => {
  //   const q = query(collection(db, 'events'), orderBy('startAt', 'asc'));
  //   return onSnapshot(q, snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as TalentEvent))));
  // }, []);
  const allEvents = mockEvents;
  const filtered  = activeFilter === 'All' ? allEvents : allEvents.filter(e => e.type === activeFilter);

  const openModal = (event: MockEvent) => { setSelected(event); setModal(true); };
  const closeModal = () => { setModal(false); setSelected(null); };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quest Hall ⚔️</Text>
        <Text style={styles.headerSub}>Complete quests to earn XP & SBT badges</Text>
      </View>

      {/* ── Filter tabs ── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterBar} contentContainerStyle={styles.filterBarContent}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterPill, activeFilter === f && styles.filterPillActive]}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Events list ── */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40 }}>🫙</Text>
            <Text style={styles.emptyText}>No quests here yet.</Text>
            <Text style={styles.emptySubText}>Check back soon, adventurer!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <EventCard event={item} onJoin={() => openModal(item)} />
        )}
      />

      {/* ── Check-in Modal ── */}
      <CheckinModal event={selectedEvent} visible={modalVisible} onClose={closeModal} />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  headerTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800' },
  headerSub:   { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 3 },

  // Filter bar
  filterBar:        { flexGrow: 0 },
  filterBarContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.xxl, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterPillActive: { backgroundColor: Colors.xp + '18', borderColor: Colors.xp + '50' },
  filterText:       { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  filterTextActive: { color: Colors.xp },

  // Event card
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, padding: 16, gap: 10,
  },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardEmoji:    { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardEmojiText:{ fontSize: 26 },
  cardTopRight: { alignItems: 'flex-end', gap: 6 },
  typePill:     { borderRadius: Radius.xxl, paddingHorizontal: 10, paddingVertical: 4 },
  typeText:     { fontSize: FontSize.xs, fontWeight: '700' },
  xpPill:       { backgroundColor: Colors.xp + '18', borderRadius: Radius.xxl, paddingHorizontal: 10, paddingVertical: 4 },
  xpPillText:   { color: Colors.xp, fontSize: FontSize.xs, fontWeight: '700' },
  cardTitle:    { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', lineHeight: 22 },
  cardDesc:     { color: Colors.textSub, fontSize: FontSize.sm, lineHeight: 20 },
  cardDate:     { color: Colors.textMuted, fontSize: FontSize.xs },
  skillsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillTag: {
    backgroundColor: Colors.skill + '15', borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  skillTagText: { color: Colors.skill, fontSize: FontSize.xs, fontWeight: '600' },
  joinBtn: {
    backgroundColor: Colors.quest + '18', borderWidth: 1, borderColor: Colors.quest + '40',
    borderRadius: Radius.xl, paddingVertical: 12, alignItems: 'center',
  },
  joinBtnText: { color: Colors.quest, fontWeight: '800', fontSize: FontSize.sm },

  // Empty state
  emptyState:   { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText:    { color: Colors.text, fontSize: FontSize.lg, fontWeight: '600' },
  emptySubText: { color: Colors.textSub, fontSize: FontSize.sm },

  // Modal
  modal: {
    flex: 1, backgroundColor: Colors.surfaceAlt,
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
  },
  modalHandle: {
    width: 36, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  modalClose: { alignSelf: 'flex-end', padding: 16 },
  modalHeader: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20, gap: 10 },
  modalEmoji:  { width: 80, height: 80, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center' },
  modalTypePill: { borderRadius: Radius.xxl, paddingHorizontal: 12, paddingVertical: 5 },
  modalTypeText: { fontSize: FontSize.sm, fontWeight: '700' },
  modalTitle:    { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800', textAlign: 'center' },
  modalDate:     { color: Colors.textMuted, fontSize: FontSize.sm },

  modalBody: { paddingHorizontal: 24, paddingBottom: 40 },
  modalDesc: { color: Colors.textSub, fontSize: FontSize.sm, lineHeight: 22, marginBottom: 16 },

  xpRewardRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.xp + '12', borderRadius: Radius.lg, padding: 14, marginBottom: 20,
  },
  xpRewardLabel: { color: Colors.textSub, fontSize: FontSize.sm, fontWeight: '600' },
  xpRewardValue: { color: Colors.xp, fontSize: FontSize.lg, fontWeight: '800' },

  inputLabel: { color: Colors.textSub, fontSize: FontSize.sm, fontWeight: '600', marginBottom: 8 },
  walletInput: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: 14, color: Colors.text,
    fontSize: FontSize.sm, fontFamily: 'monospace', marginBottom: 6,
  },
  inputHint: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 20 },
  startBtn: {
    backgroundColor: Colors.quest, borderRadius: Radius.xl,
    paddingVertical: 16, alignItems: 'center',
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },

  // Steps
  processingTitle:    { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  processingSubtitle: { color: Colors.textSub, fontSize: FontSize.sm, textAlign: 'center', marginBottom: 20 },
  stepsCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 20,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  stepRowActive: { borderLeftWidth: 3, borderLeftColor: Colors.xp, paddingLeft: 10 },
  stepLabel:       { color: Colors.textMuted, fontSize: FontSize.sm, flex: 1 },
  stepLabelActive: { color: Colors.xp, fontWeight: '700' },
  stepLabelDone:   { color: Colors.success },
  stepLabelFuture: { color: Colors.textMuted },
  stepActiveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.xp,
  },

  // Result card
  resultCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20, alignItems: 'center', gap: 12, marginBottom: 20,
  },
  resultBadge: {
    width: 80, height: 80, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5,
    shadowRadius: 10, elevation: 10,
  },
  resultSkill: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800' },
  resultRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  resultLevelPill: { borderRadius: Radius.xxl, paddingHorizontal: 10, paddingVertical: 5 },
  resultLevelText: { fontSize: FontSize.xs, fontWeight: '700' },
  resultXpPill: {
    backgroundColor: Colors.xp + '20', borderRadius: Radius.xxl,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  resultXpText: { color: Colors.xp, fontSize: FontSize.xs, fontWeight: '700' },
  resultTierPill: {
    backgroundColor: Colors.success + '20', borderRadius: Radius.xxl,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  resultTierText: { color: Colors.success, fontSize: FontSize.xs, fontWeight: '700' },
  txRow:   { alignItems: 'center', gap: 4 },
  txLabel: { color: Colors.textMuted, fontSize: FontSize.xs },
  txHash:  { color: Colors.textSub, fontSize: 11, fontFamily: 'monospace' },

  doneBtn: {
    backgroundColor: Colors.xp, borderRadius: Radius.xl,
    paddingVertical: 16, alignItems: 'center',
  },
  doneBtnText: { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },

  // Error
  errorText: { color: Colors.streak, fontSize: FontSize.md, textAlign: 'center', marginBottom: 16 },
  retryBtn:  { backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingVertical: 12, alignItems: 'center' },
  retryBtnText: { color: Colors.text, fontWeight: '700' },
});
