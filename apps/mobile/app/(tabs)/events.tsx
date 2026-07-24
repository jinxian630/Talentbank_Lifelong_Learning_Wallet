import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  Animated, TextInput, Image, ScrollView, Modal, Pressable,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { getCertExams } from '@talentbank/firebase-config';
import type { TalentEvent, CertExam } from '@talentbank/shared';
import { Colors, EventTypeColors, LevelColors, Radius, FontSize, FontFamily } from '../../constants/theme';
import { useXPProfile } from '../../lib/use-xp-profile';

// ─── LOCAL PALETTE ────────────────────────────────────────────────────────────
const P = {
  bg:        Colors.bg,
  card:      Colors.surface,
  border:    Colors.border,
  borderAlt: Colors.borderAlt,
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const EVENT_FILTERS = ['All', 'Hackathon', 'Workshop', 'Talk', 'Others', 'Seminar', 'Bootcamp'];
const DIFF_FILTERS  = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const DATE_RANGES   = ['All Time', 'Today', 'This Week', 'This Month'] as const;
const STATUS_OPTS   = ['All', 'Open', 'Full'] as const;

type DateRange = typeof DATE_RANGES[number];
type StatusOpt = typeof STATUS_OPTS[number];

const SUGGESTED_PROMPTS = [
  'What events match my interests?',
  "What's coming up this week?",
  'Which event should I attend first?',
];

const FILTER_COLORS: Record<string, string> = {
  All:       Colors.xp,
  Hackathon: EventTypeColors.Hackathon,
  Workshop:  EventTypeColors.Workshop,
  Talk:      EventTypeColors.Talk,
  Others:    '#6b7280',
  Seminar:   EventTypeColors.Seminar,
  Bootcamp:  EventTypeColors.Bootcamp,
};

const DIFF_COLORS: Record<string, string> = {
  All:          Colors.textMuted,
  Beginner:     LevelColors.beginner,
  Intermediate: LevelColors.intermediate,
  Advanced:     LevelColors.advanced,
};

const CATEGORY_EMOJIS: Record<string, string> = {
  Hackathon: '⚡',
  Workshop:  '🛠️',
  Seminar:   '🎓',
  Bootcamp:  '🚀',
  Talk:      '🎤',
  Others:    '📅',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function toDate(v: any): Date {
  if (!v) return new Date(0);
  if (typeof v.toDate === 'function') return v.toDate();
  return new Date(v);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function formatTime(v: any): string {
  const d = toDate(v);
  return d.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateShort(v: any): string {
  const d = toDate(v);
  if (d.getTime() === 0) return '—';
  return d.toLocaleDateString('en-MY', { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupEventsByDate(events: TalentEvent[]): { title: string; data: TalentEvent[] }[] {
  const today    = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const groups   = new Map<string, TalentEvent[]>();

  events.forEach(event => {
    const d = toDate(event.startAt);
    let label: string;
    if      (isSameDay(d, today))    label = `Today  ${today.toLocaleDateString('en-MY', { weekday: 'long' })}`;
    else if (isSameDay(d, tomorrow)) label = `Tomorrow  ${tomorrow.toLocaleDateString('en-MY', { weekday: 'long' })}`;
    else     label = d.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const existing = groups.get(label) ?? [];
    groups.set(label, [...existing, event]);
  });

  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

// ─── SKELETON CARD ────────────────────────────────────────────────────────────

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.card, { opacity, marginVertical: 5 }]}>
      <View style={[styles.accentBar, { backgroundColor: P.border }]} />
      <View style={styles.cardInner}>
        <View style={{ flex: 1, gap: 10 }}>
          <View style={{ width: 80,  height: 10, borderRadius: 6, backgroundColor: P.border }} />
          <View style={{ width: '90%', height: 14, borderRadius: 6, backgroundColor: P.border }} />
          <View style={{ width: '60%', height: 14, borderRadius: 6, backgroundColor: P.border }} />
          <View style={{ width: 60,  height: 20, borderRadius: 10, backgroundColor: P.border }} />
        </View>
        <View style={[styles.cardEmojiBox, { backgroundColor: P.border }]} />
      </View>
    </Animated.View>
  );
}

function ExamSkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[examStyles.card, { opacity }]}>
      <View style={[examStyles.thumbnail, { backgroundColor: P.border }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ width: 70, height: 10, borderRadius: 6, backgroundColor: P.border }} />
        <View style={{ width: '85%', height: 14, borderRadius: 6, backgroundColor: P.border }} />
        <View style={{ width: '55%', height: 11, borderRadius: 6, backgroundColor: P.border }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ width: 60, height: 20, borderRadius: 10, backgroundColor: P.border }} />
          <View style={{ width: 50, height: 20, borderRadius: 10, backgroundColor: P.border }} />
        </View>
      </View>
    </Animated.View>
  );
}

// ─── FILTER DROPDOWNS ─────────────────────────────────────────────────────────

function FilterDropdowns({
  dateFilter, setDateFilter, statusFilter, setStatusFilter,
}: {
  dateFilter: DateRange; setDateFilter: (v: DateRange) => void;
  statusFilter: StatusOpt; setStatusFilter: (v: StatusOpt) => void;
}) {
  const [openDate,   setOpenDate]   = useState(false);
  const [openStatus, setOpenStatus] = useState(false);

  const dateChevron   = useRef(new Animated.Value(0)).current;
  const statusChevron = useRef(new Animated.Value(0)).current;

  const toggle = (which: 'date' | 'status') => {
    if (which === 'date') {
      const next = !openDate;
      setOpenDate(next);
      setOpenStatus(false);
      Animated.timing(dateChevron,   { toValue: next ? 1 : 0, duration: 180, useNativeDriver: true }).start();
      Animated.timing(statusChevron, { toValue: 0,            duration: 180, useNativeDriver: true }).start();
    } else {
      const next = !openStatus;
      setOpenStatus(next);
      setOpenDate(false);
      Animated.timing(statusChevron, { toValue: next ? 1 : 0, duration: 180, useNativeDriver: true }).start();
      Animated.timing(dateChevron,   { toValue: 0,            duration: 180, useNativeDriver: true }).start();
    }
  };

  const dateActive   = dateFilter   !== 'All Time';
  const statusActive = statusFilter !== 'All';

  const renderPill = (
    label: string,
    active: boolean,
    chevronAnim: Animated.Value,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        ddStyles.pill,
        active && { backgroundColor: Colors.quest + '20', borderColor: Colors.quest + '60' },
      ]}
    >
      <Text style={[ddStyles.pillText, active && { color: Colors.quest }]}>{label}</Text>
      <Animated.View style={{ transform: [{ rotate: chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
        <Ionicons name="chevron-down" size={12} color={active ? Colors.quest : Colors.textMuted} />
      </Animated.View>
    </TouchableOpacity>
  );

  const renderModal = (
    visible: boolean,
    options: readonly string[],
    selected: string,
    onSelect: (v: any) => void,
    onClose: () => void,
  ) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ddStyles.overlay} onPress={onClose}>
        <View style={ddStyles.sheet}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              onPress={() => { onSelect(opt); onClose(); }}
              style={[ddStyles.option, selected === opt && ddStyles.optionActive]}
            >
              <Text style={[ddStyles.optionText, selected === opt && ddStyles.optionTextActive]}>{opt}</Text>
              {selected === opt && <Ionicons name="checkmark" size={14} color={Colors.quest} />}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <>
      <View style={ddStyles.row}>
        {renderPill(`Date: ${dateFilter}`,     dateActive,   dateChevron,   () => toggle('date'))}
        {renderPill(`Status: ${statusFilter}`, statusActive, statusChevron, () => toggle('status'))}
      </View>
      {renderModal(openDate,   DATE_RANGES, dateFilter,   setDateFilter,   () => { setOpenDate(false);   Animated.timing(dateChevron,   { toValue: 0, duration: 180, useNativeDriver: true }).start(); })}
      {renderModal(openStatus, STATUS_OPTS, statusFilter, setStatusFilter, () => { setOpenStatus(false); Animated.timing(statusChevron, { toValue: 0, duration: 180, useNativeDriver: true }).start(); })}
    </>
  );
}

// ─── ATTENDEE ROW ─────────────────────────────────────────────────────────────

function AttendeeRow({ count }: { count: number }) {
  if (count === 0) return null;
  const shown = Math.min(count, 3);
  return (
    <View style={styles.attendeeRow}>
      {Array.from({ length: shown }).map((_, i) => (
        <View
          key={i}
          style={[styles.attendeeCircle, { marginLeft: i === 0 ? 0 : -8, zIndex: shown - i }]}
        >
          <Text style={{ fontSize: 9 }}>👤</Text>
        </View>
      ))}
      <Text style={styles.attendeeCount}>
        {count === 1 ? '1 attending' : `${count} attending`}
      </Text>
    </View>
  );
}

// ─── EVENT CARD ───────────────────────────────────────────────────────────────

function EventCard({ event, onPress }: { event: TalentEvent; onPress: () => void }) {
  const typeColor     = EventTypeColors[event.type] ?? '#6b7280';
  const count         = (event.pendingParticipants ?? []).length;
  const isFull        = !!(event.capacity && count >= event.capacity);
  const fallbackEmoji = event.emoji ?? CATEGORY_EMOJIS[event.type] ?? '📅';

  return (
    <TouchableOpacity
      style={[styles.card, isFull && styles.cardFull]}
      onPress={onPress}
      activeOpacity={0.78}
      disabled={isFull}
    >
      {/* Left accent strip */}
      <View style={[styles.accentBar, { backgroundColor: typeColor }]} />

      {/* Card body */}
      <View style={styles.cardInner}>
        {/* Thumbnail side */}
        <View style={styles.cardRight}>
          {event.imageUrl ? (
            <Image source={{ uri: event.imageUrl }} style={styles.cardThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.cardEmojiBox, { backgroundColor: typeColor + '18' }]}>
              <Text style={styles.cardEmoji}>{fallbackEmoji}</Text>
            </View>
          )}
          {event.badgeEmoji && (
            <View style={[styles.badgeDot, { backgroundColor: event.badgeColor ?? Colors.xp }]}>
              <Text style={{ fontSize: 10 }}>{event.badgeEmoji}</Text>
            </View>
          )}
        </View>

        {/* Text side */}
        <View style={styles.cardLeft}>
          <Text style={styles.cardTime}>{formatTime(event.startAt)}</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>

          <View style={styles.cardMeta}>
            <View style={[styles.typePill, { backgroundColor: typeColor + '20', borderColor: typeColor + '55' }]}>
              <Text style={[styles.typeText, { color: typeColor }]}>{event.type}</Text>
            </View>
            {isFull && (
              <View style={styles.fullPill}>
                <Text style={styles.fullText}>Full</Text>
              </View>
            )}
          </View>

          <AttendeeRow count={count} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  const parts = title.split('  ');
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionDotRing}>
        <View style={styles.sectionDot} />
      </View>
      <Text style={styles.sectionMain}>{parts[0]}</Text>
      {parts[1] && <Text style={styles.sectionSub}>{parts[1]}</Text>}
      <View style={styles.sectionLine} />
      <View style={styles.sectionCountBadge}>
        <Text style={styles.sectionCountText}>{count}</Text>
      </View>
    </View>
  );
}

// ─── CERT EXAM CARD ───────────────────────────────────────────────────────────

function ExamCard({
  exam,
  userXP,
  onPress,
}: {
  exam: CertExam;
  userXP: number;
  onPress: () => void;
}) {
  const difficulty  = exam.difficulty ?? 'Beginner';
  const diffColor   = LevelColors[difficulty.toLowerCase()] ?? Colors.skill;
  const slots       = (exam.maxSlots ?? 0) > 0 ? (exam.maxSlots ?? 0) - (exam.registeredCount ?? 0) : null;
  const isUnlocked  = userXP >= (exam.requiredXP ?? 0);
  const isFull      = slots !== null && slots <= 0;

  return (
    <TouchableOpacity
      style={[examStyles.card, isFull && { opacity: 0.55 }]}
      onPress={onPress}
      activeOpacity={0.78}
      disabled={isFull}
    >
      {/* Thumbnail */}
      <View style={[examStyles.thumbnail, { backgroundColor: diffColor + '18' }]}>
        {exam.bannerImageUrl ? (
          <Image source={{ uri: exam.bannerImageUrl }} style={examStyles.thumbnailImg} resizeMode="cover" />
        ) : (
          <Ionicons name="school-outline" size={30} color={diffColor} />
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, gap: 5 }}>
        {/* Difficulty + unlocked row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <View style={[examStyles.diffPill, { backgroundColor: diffColor + '20', borderColor: diffColor + '55' }]}>
            <Text style={[examStyles.diffText, { color: diffColor }]}>{difficulty}</Text>
          </View>
          {isUnlocked ? (
            <View style={examStyles.unlockedPill}>
              <Ionicons name="lock-open-outline" size={10} color={Colors.success} />
              <Text style={examStyles.unlockedText}>Unlocked</Text>
            </View>
          ) : (
            <View style={examStyles.lockedPill}>
              <Ionicons name="lock-closed-outline" size={10} color={Colors.streak} />
              <Text style={examStyles.lockedText}>Locked</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={examStyles.title} numberOfLines={2}>{exam.title}</Text>

        {/* Issuer + date */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {exam.issuer ? (
            <Text style={examStyles.meta} numberOfLines={1}>{exam.issuer}</Text>
          ) : null}
          <Text style={examStyles.meta}>
            <Ionicons name="calendar-outline" size={10} color={Colors.textMuted} />{' '}
            {formatDateShort(exam.examDate)}
          </Text>
        </View>

        {/* XP + slots */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={examStyles.xpBadge}>
            <Text style={examStyles.xpText}>🔑 {exam.requiredXP ?? 0} XP</Text>
          </View>
          {slots !== null && (
            <Text style={[examStyles.slotsText, slots <= 5 && { color: Colors.xp }]}>
              {isFull ? 'Full' : `${slots} slot${slots === 1 ? '' : 's'} left`}
            </Text>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.borderAlt} style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const router = useRouter();
  const { xp: userXP } = useXPProfile();

  // ── Main tab: events or exams ──
  const [mainTab, setMainTab] = useState<'events' | 'exams'>('events');

  // ── Events state ──
  const [events,          setEvents]       = useState<TalentEvent[]>([]);
  const [loading,         setLoading]      = useState(true);
  const [activeFilter,    setFilter]       = useState('All');
  const [search,          setSearch]       = useState('');
  const [debouncedSearch, setDebounced]    = useState('');
  const [dateFilter,      setDateFilter]   = useState<DateRange>('All Time');
  const [statusFilter,    setStatusFilter] = useState<StatusOpt>('All');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Exams state ──
  const [exams,       setExams]       = useState<CertExam[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [diffFilter,  setDiffFilter]  = useState('All');
  const [examSearch,  setExamSearch]  = useState('');

  // ── Chat state ──
  const [chatOpen,    setChatOpen]    = useState(false);
  const [messages,    setMessages]    = useState<{ role: 'user' | 'bot'; text: string }[]>([]);
  const [inputText,   setInputText]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatUid,     setChatUid]     = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, u => setChatUid(u?.uid ?? null));
  }, []);

  // ── Fetch events (realtime) ──
  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('startAt', 'asc'));
    return onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as TalentEvent)));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  // ── Fetch cert exams (one-shot, load when first switching to exams tab) ──
  useEffect(() => {
    if (mainTab !== 'exams' || exams.length > 0) return;
    setExamsLoading(true);
    getCertExams()
      .then((data: any[]) => {
        const now = new Date();
        const upcoming = (data as CertExam[])
          .filter(e => toDate(e.examDate) > now)
          .sort((a, b) => toDate(a.examDate).getTime() - toDate(b.examDate).getTime());
        setExams(upcoming);
      })
      .finally(() => setExamsLoading(false));
  }, [mainTab]);

  const openChat = async () => {
    setChatOpen(true);
    const uid = chatUid;
    if (!uid) return;
    const aiUrl = process.env.EXPO_PUBLIC_AI_SERVICE_URL;
    if (!aiUrl) return;
    try {
      const res = await fetch(`${aiUrl}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (data.recommendations?.length) {
        await setDoc(doc(db, 'users', uid), { aiSuggestions: data.recommendations }, { merge: true });
      }
    } catch {}
  };

  const sendMessage = async (text: string) => {
    const msg = text.trim();
    if (!msg || chatLoading) return;
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInputText('');
    setChatLoading(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    const aiUrl = process.env.EXPO_PUBLIC_AI_SERVICE_URL;
    if (!aiUrl) {
      setMessages(prev => [...prev, { role: 'bot', text: 'AI_SERVICE_URL not configured.' }]);
      setChatLoading(false);
      return;
    }
    try {
      const res = await fetch(`${aiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          user_name: auth.currentUser?.displayName ?? 'Student',
          user_interests: [],
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.reply ?? 'No reply.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'AI service unavailable. Make sure it is running.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebounced(text), 300);
  }, []);

  // ── Computed: filtered events ──
  const sections = useMemo(() => {
    const now       = new Date();
    const todayEnd  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const weekEnd   = new Date(now.getTime() + 7 * 86400000);
    const monthEnd  = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let filtered = events;
    if (activeFilter !== 'All')      filtered = filtered.filter(e => e.type === activeFilter);
    if (debouncedSearch.trim())      filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(debouncedSearch.toLowerCase()));
    if (dateFilter !== 'All Time')   filtered = filtered.filter(e => {
      const d = toDate(e.startAt);
      if (dateFilter === 'Today')      return d <= todayEnd;
      if (dateFilter === 'This Week')  return d <= weekEnd;
      if (dateFilter === 'This Month') return d <= monthEnd;
      return true;
    });
    if (statusFilter !== 'All')      filtered = filtered.filter(e => {
      const isFull = !!(e.capacity && (e.pendingParticipants ?? []).length >= e.capacity);
      return statusFilter === 'Full' ? isFull : !isFull;
    });
    return groupEventsByDate(filtered);
  }, [events, activeFilter, debouncedSearch, dateFilter, statusFilter]);

  // ── Computed: filtered exams ──
  const filteredExams = useMemo(() => {
    const q = examSearch.toLowerCase();
    return exams.filter(e => {
      const matchSearch = !q || (e.title ?? '').toLowerCase().includes(q)
        || (e.issuer ?? '').toLowerCase().includes(q)
        || (e.tags ?? []).some(t => t.toLowerCase().includes(q));
      const matchDiff = diffFilter === 'All' || e.difficulty === diffFilter;
      return matchSearch && matchDiff;
    });
  }, [exams, examSearch, diffFilter]);

  const totalEventCount = events.length;

  return (
    <View style={styles.container}>

      {/* ── Chat overlay ── */}
      {chatOpen && (
        <View style={chatStyles.overlay}>
          <View style={chatStyles.header}>
            <View style={chatStyles.headerLeft}>
              <View style={chatStyles.botAvatar}>
                <Text style={{ fontSize: 20 }}>🤖</Text>
              </View>
              <View>
                <Text style={chatStyles.botName}>XP Career Wallet</Text>
                <Text style={chatStyles.botSub}>AI Event Advisor</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setChatOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color={Colors.textSub} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            style={{ flex: 1 }}
            contentContainerStyle={chatStyles.messageList}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              messages.length === 0 ? (
                <View style={chatStyles.emptyChat}>
                  <Text style={chatStyles.emptyChatText}>
                    {"Hi! I'm your XP Career Wallet advisor.\nAsk me anything about events!"}
                  </Text>
                  <View style={chatStyles.suggestRow}>
                    {SUGGESTED_PROMPTS.map(s => (
                      <TouchableOpacity key={s} style={chatStyles.suggestChip} onPress={() => sendMessage(s)} activeOpacity={0.75}>
                        <Text style={chatStyles.suggestText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={item.role === 'user' ? chatStyles.bubbleUser : chatStyles.bubbleBot}>
                <Text style={item.role === 'user' ? chatStyles.textUser : chatStyles.textBot}>{item.text}</Text>
              </View>
            )}
            ListFooterComponent={
              chatLoading ? (
                <View style={chatStyles.bubbleBot}>
                  <Text style={chatStyles.textBot}>●●●</Text>
                </View>
              ) : null
            }
          />

          <View style={chatStyles.inputRow}>
            <TextInput
              style={chatStyles.input}
              placeholder="Ask about events…"
              placeholderTextColor={Colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => sendMessage(inputText)}
              returnKeyType="send"
              editable={!chatLoading}
            />
            <TouchableOpacity
              style={[chatStyles.sendBtn, (!inputText.trim() || chatLoading) && { opacity: 0.4 }]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || chatLoading}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Events &amp; Certs</Text>
            <Text style={styles.headerSub}>
              {mainTab === 'events'
                ? (loading ? 'Loading…' : `${totalEventCount} upcoming event${totalEventCount !== 1 ? 's' : ''}`)
                : `${exams.length} cert exam${exams.length !== 1 ? 's' : ''} available`}
            </Text>
          </View>
          <View style={styles.newBadge}>
            <Ionicons name="sparkles" size={11} color={Colors.xp} />
            <Text style={styles.newBadgeText}>Discover</Text>
          </View>
        </View>

        {/* ── Main tab switcher ── */}
        <View style={styles.mainTabRow}>
          <TouchableOpacity
            style={[styles.mainTabPill, mainTab === 'events' && styles.mainTabPillActive]}
            onPress={() => setMainTab('events')}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={14} color={mainTab === 'events' ? '#fff' : Colors.textMuted} />
            <Text style={[styles.mainTabText, mainTab === 'events' && styles.mainTabTextActive]}>Events</Text>
            {!loading && totalEventCount > 0 && (
              <View style={[styles.mainTabBadge, mainTab === 'events' && styles.mainTabBadgeActive]}>
                <Text style={[styles.mainTabBadgeText, mainTab === 'events' && { color: '#fff' }]}>{totalEventCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainTabPill, mainTab === 'exams' && styles.mainTabPillActive]}
            onPress={() => setMainTab('exams')}
            activeOpacity={0.8}
          >
            <Ionicons name="school-outline" size={14} color={mainTab === 'exams' ? '#fff' : Colors.textMuted} />
            <Text style={[styles.mainTabText, mainTab === 'exams' && styles.mainTabTextActive]}>Cert Exams</Text>
            {exams.length > 0 && (
              <View style={[styles.mainTabBadge, mainTab === 'exams' && styles.mainTabBadgeActive]}>
                <Text style={[styles.mainTabBadgeText, mainTab === 'exams' && { color: '#fff' }]}>{exams.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={mainTab === 'events' ? 'Search events…' : 'Search exams, tags, or issuers…'}
          placeholderTextColor={Colors.textMuted}
          value={mainTab === 'events' ? search : examSearch}
          onChangeText={mainTab === 'events' ? handleSearchChange : setExamSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {(mainTab === 'events' ? search : examSearch).length > 0 && (
          <TouchableOpacity onPress={() => mainTab === 'events' ? (setSearch(''), setDebounced('')) : setExamSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ══════════════════════ EVENTS TAB ══════════════════════ */}
      {mainTab === 'events' && (
        <SectionList
          sections={loading ? [] : sections}
          keyExtractor={item => item.id}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {EVENT_FILTERS.map(f => {
                  const isActive = activeFilter === f;
                  const fc       = FILTER_COLORS[f] ?? Colors.xp;
                  return (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setFilter(f)}
                      style={[
                        styles.filterPill,
                        isActive
                          ? { backgroundColor: fc, borderColor: fc }
                          : { borderColor: P.borderAlt },
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{f}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <FilterDropdowns
                dateFilter={dateFilter}     setDateFilter={setDateFilter}
                statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              />
              {loading && [0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </>
          }
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 44 }}>🫙</Text>
                <Text style={styles.emptyTitle}>
                  {search
                    ? `No results for "${search}"`
                    : activeFilter !== 'All'
                    ? `No ${activeFilter} events`
                    : 'No events yet'}
                </Text>
                <Text style={styles.emptyText}>Check back soon!</Text>
              </View>
            )
          }
          renderSectionHeader={({ section }) => <SectionHeader title={section.title} count={section.data.length} />}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
          )}
          SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
        />
      )}

      {/* ══════════════════════ CERT EXAMS TAB ══════════════════════ */}
      {mainTab === 'exams' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={examStyles.listContent}
        >
          {/* Difficulty filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {DIFF_FILTERS.map(d => {
              const isActive = diffFilter === d;
              const dc       = DIFF_COLORS[d] ?? Colors.textMuted;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDiffFilter(d)}
                  style={[
                    styles.filterPill,
                    isActive
                      ? { backgroundColor: dc, borderColor: dc }
                      : { borderColor: P.borderAlt },
                  ]}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Skeleton */}
          {examsLoading && [0, 1, 2].map(i => <ExamSkeletonCard key={i} />)}

          {/* Empty state */}
          {!examsLoading && filteredExams.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 44 }}>🎓</Text>
              <Text style={styles.emptyTitle}>
                {examSearch ? `No results for "${examSearch}"` : 'No upcoming exams'}
              </Text>
              <Text style={styles.emptyText}>Check back soon for new cert exams.</Text>
            </View>
          )}

          {/* Exam cards */}
          {!examsLoading && filteredExams.map(exam => (
            <ExamCard
              key={exam.id}
              exam={exam}
              userXP={userXP}
              onPress={() => router.push(`/wallet/exam/${exam.id}`)}
            />
          ))}

          {/* Wallet connector nudge */}
          {!examsLoading && exams.length > 0 && (
            <TouchableOpacity
              style={examStyles.walletNudge}
              onPress={() => setMainTab('events')}
              activeOpacity={0.85}
            >
              <View style={examStyles.walletNudgeLeft}>
                <Text style={examStyles.walletNudgeTitle}>Need more XP?</Text>
                <Text style={examStyles.walletNudgeSub}>Attend events to earn XP and unlock cert exams</Text>
              </View>
              <View style={examStyles.walletNudgeArrow}>
                <Ionicons name="flash" size={16} color={Colors.xp} />
                <Text style={examStyles.walletNudgeArrowText}>Events</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.xp} />
              </View>
            </TouchableOpacity>
          )}

          {/* Browse full market link */}
          {!examsLoading && (
            <TouchableOpacity
              style={examStyles.browseLink}
              onPress={() => router.push('/wallet/cert-market')}
              activeOpacity={0.75}
            >
              <Ionicons name="storefront-outline" size={15} color={Colors.skill} />
              <Text style={examStyles.browseLinkText}>Browse Full Cert Market</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.skill} />
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* ── AI Chat FAB ── */}
      <TouchableOpacity style={styles.chatFab} onPress={openChat} activeOpacity={0.85}>
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 62, paddingBottom: 14 },
  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14,
  },
  headerTitle: { color: Colors.text, fontSize: FontSize.h1, fontWeight: '800', letterSpacing: -0.5, fontFamily: FontFamily.heading },
  headerSub:   { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 3 },
  newBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.xp + '18',
    borderWidth: 1, borderColor: Colors.xp + '45',
    borderRadius: Radius.xxl,
    paddingHorizontal: 10, paddingVertical: 5,
    marginTop: 4,
  },
  newBadgeText: { color: Colors.xp, fontSize: FontSize.xs, fontWeight: '700' },

  // Main tab switcher
  mainTabRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: P.card,
    borderRadius: Radius.xxl,
    borderWidth: 1, borderColor: P.border,
    padding: 4,
    alignSelf: 'flex-start',
  },
  mainTabPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.xl,
  },
  mainTabPillActive: { backgroundColor: Colors.xp },
  mainTabText:       { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  mainTabTextActive: { color: '#fff', fontWeight: '700' },
  mainTabBadge: {
    backgroundColor: P.borderAlt, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  mainTabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  mainTabBadgeText:   { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 6, marginTop: 10,
    backgroundColor: P.card, borderRadius: Radius.xl,
    paddingHorizontal: 14, height: 44,
    borderWidth: 1, borderColor: P.border,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.sm },

  // Filters
  filterRow:        { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 8 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.xxl, borderWidth: 1,
    backgroundColor: P.card,
  },
  filterText:       { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  filterTextActive: { color: '#fff', fontWeight: '700' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  sectionDotRing: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.xp + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionDot:        { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.xp },
  sectionMain:       { color: Colors.text, fontSize: FontSize.md, fontWeight: '800' },
  sectionSub:        { color: Colors.textMuted, fontSize: FontSize.md },
  sectionLine:       { flex: 1, height: 1, backgroundColor: P.border },
  sectionCountBadge: { backgroundColor: P.borderAlt, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  sectionCountText:  { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  sectionGap:        { height: 4 },

  // List
  listContent: { paddingBottom: 100, paddingHorizontal: 16 },

  // Event card
  card: {
    flexDirection: 'row',
    backgroundColor: P.card,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: P.border,
    overflow: 'hidden',
    marginVertical: 5,
  },
  cardFull:  { opacity: 0.55 },
  accentBar: { width: 3 },
  cardInner: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 14, gap: 12,
  },

  cardLeft:  { flex: 1, gap: 5 },
  cardTime:  { color: Colors.quest, fontSize: FontSize.sm, fontWeight: '700' },
  cardTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', lineHeight: 22 },

  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  typePill: {
    borderRadius: Radius.xxl, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  typeText: { fontSize: FontSize.xs, fontWeight: '700' },
  fullPill: {
    backgroundColor: Colors.streak + '18', borderRadius: Radius.xxl,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  fullText: { color: Colors.streak, fontSize: FontSize.xs, fontWeight: '700' },

  // Attendees
  attendeeRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  attendeeCircle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: P.border,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: P.card,
  },
  attendeeCount: { color: Colors.textMuted, fontSize: FontSize.xs },

  // Card right (thumbnail)
  cardRight:    { alignItems: 'center', position: 'relative' },
  cardThumb:    { width: 82, height: 82, borderRadius: Radius.md },
  cardEmojiBox: {
    width: 82, height: 82, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cardEmoji: { fontSize: 34 },
  badgeDot: {
    position: 'absolute', bottom: -6, left: -4,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: P.card,
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8, paddingHorizontal: 40 },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  emptyText:  { color: Colors.textSub, fontSize: FontSize.sm },

  // Chat FAB
  chatFab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: Colors.xp,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.xp, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
});

// ─── EXAM STYLES ──────────────────────────────────────────────────────────────

const examStyles = StyleSheet.create({
  listContent: { paddingBottom: 100, paddingTop: 4 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: P.card,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: P.border,
    marginHorizontal: 16, marginVertical: 5,
    padding: 14,
  },
  thumbnail: {
    width: 72, height: 72, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  thumbnailImg: { width: 72, height: 72 },

  diffPill: {
    borderRadius: Radius.xxl, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  diffText: { fontSize: FontSize.xs, fontWeight: '700' },

  unlockedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.success + '18', borderRadius: Radius.xxl,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  unlockedText: { color: Colors.success, fontSize: FontSize.xs, fontWeight: '700' },

  lockedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.streak + '12', borderRadius: Radius.xxl,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  lockedText: { color: Colors.streak, fontSize: FontSize.xs, fontWeight: '700' },

  title: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', lineHeight: 21 },
  meta:  { color: Colors.textMuted, fontSize: FontSize.xs },

  xpBadge: {
    backgroundColor: Colors.skill + '15', borderRadius: Radius.xxl,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  xpText:    { color: Colors.skill, fontSize: FontSize.xs, fontWeight: '700' },
  slotsText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },

  // Wallet nudge banner
  walletNudge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    padding: 16, borderRadius: Radius.xl,
    backgroundColor: Colors.xp + '12',
    borderWidth: 1, borderColor: Colors.xp + '25',
  },
  walletNudgeLeft:      { flex: 1, gap: 3 },
  walletNudgeTitle:     { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  walletNudgeSub:       { color: Colors.textSub, fontSize: FontSize.xs, lineHeight: 17 },
  walletNudgeArrow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 12 },
  walletNudgeArrowText: { color: Colors.xp, fontSize: FontSize.sm, fontWeight: '700' },

  // Browse all link
  browseLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginVertical: 10,
    padding: 14, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.skill + '35',
    backgroundColor: Colors.skill + '08',
  },
  browseLinkText: { color: Colors.skill, fontSize: FontSize.sm, fontWeight: '700' },
});

// ─── CHAT STYLES ──────────────────────────────────────────────────────────────

const chatStyles = StyleSheet.create({
  overlay:        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: Colors.bg, flex: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  botAvatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.xp + '20', alignItems: 'center', justifyContent: 'center' },
  botName:        { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  botSub:         { color: Colors.textMuted, fontSize: FontSize.xs },
  messageList:    { padding: 16, paddingBottom: 8, flexGrow: 1 },
  emptyChat:      { alignItems: 'center', paddingVertical: 32, gap: 16 },
  emptyChatText:  { color: Colors.textSub, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
  suggestRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  suggestChip:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.xxl, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.borderAlt },
  suggestText:    { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '600' },
  bubbleUser:     { alignSelf: 'flex-end', backgroundColor: Colors.xp, borderRadius: Radius.lg, borderBottomRightRadius: 4, padding: 12, marginVertical: 4, maxWidth: '78%' },
  bubbleBot:      { alignSelf: 'flex-start', backgroundColor: Colors.surface, borderRadius: Radius.lg, borderBottomLeftRadius: 4, padding: 12, marginVertical: 4, maxWidth: '78%', borderWidth: 1, borderColor: Colors.border },
  textUser:       { color: '#fff', fontSize: FontSize.sm, lineHeight: 20 },
  textBot:        { color: Colors.text, fontSize: FontSize.sm, lineHeight: 20 },
  inputRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  input:          { flex: 1, color: Colors.text, fontSize: FontSize.sm, backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  sendBtn:        { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.xp, alignItems: 'center', justifyContent: 'center' },
});

// ─── FILTER DROPDOWN STYLES ───────────────────────────────────────────────────

const ddStyles = StyleSheet.create({
  row:     { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  pill:    {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: P.card, borderWidth: 1, borderColor: P.borderAlt,
    borderRadius: Radius.xxl, paddingHorizontal: 12, paddingVertical: 7,
  },
  pillText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:   {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    borderWidth: 1, borderColor: P.border,
    paddingTop: 8, paddingBottom: 36,
  },
  option:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14 },
  optionActive:     { backgroundColor: Colors.quest + '10' },
  optionText:       { color: Colors.textSub, fontSize: FontSize.md, fontWeight: '500' },
  optionTextActive: { color: Colors.quest,   fontSize: FontSize.md, fontWeight: '700' },
});
