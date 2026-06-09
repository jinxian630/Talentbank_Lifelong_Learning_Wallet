import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  Animated, TextInput, Image, ScrollView, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TalentEvent } from '@talentbank/shared';
import { Colors, EventTypeColors, Radius, FontSize } from '../../constants/theme';

// ─── LOCAL PALETTE (charcoal-blue dark mode) ──────────────────────────────────
const P = {
  bg:       Colors.bg,
  card:     Colors.surface,
  border:   '#1c1f2f',
  borderAlt:'#252840',
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const FILTERS     = ['All', 'Hackathon', 'Workshop', 'Talk', 'Others', 'Seminar', 'Bootcamp'];
const DATE_RANGES = ['All Time', 'Today', 'This Week', 'This Month'] as const;
const STATUS_OPTS = ['All', 'Open', 'Full'] as const;

type DateRange = typeof DATE_RANGES[number];
type StatusOpt = typeof STATUS_OPTS[number];

const FILTER_COLORS: Record<string, string> = {
  All:       Colors.xp,
  Hackathon: EventTypeColors.Hackathon,
  Workshop:  EventTypeColors.Workshop,
  Talk:      EventTypeColors.Talk,
  Others:    '#6b7280',
  Seminar:   EventTypeColors.Seminar,
  Bootcamp:  EventTypeColors.Bootcamp,
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
        {renderPill(`Date: ${dateFilter}`,   dateActive,   dateChevron,   () => toggle('date'))}
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
        {/* Thumbnail / emoji side */}
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

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const router = useRouter();
  const [events,          setEvents]       = useState<TalentEvent[]>([]);
  const [loading,         setLoading]      = useState(true);
  const [activeFilter,    setFilter]       = useState('All');
  const [search,          setSearch]       = useState('');
  const [debouncedSearch, setDebounced]    = useState('');
  const [dateFilter,      setDateFilter]   = useState<DateRange>('All Time');
  const [statusFilter,    setStatusFilter] = useState<StatusOpt>('All');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebounced(text), 300);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('startAt', 'asc'));
    return onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as TalentEvent)));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const sections = useMemo(() => {
    const now       = new Date();
    const todayEnd  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const weekEnd   = new Date(now.getTime() + 7 * 86400000);
    const monthEnd  = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let filtered = events;
    if (activeFilter !== 'All')       filtered = filtered.filter(e => e.type === activeFilter);
    if (debouncedSearch.trim())       filtered = filtered.filter(e =>
      e.title.toLowerCase().includes(debouncedSearch.toLowerCase()));
    if (dateFilter !== 'All Time')    filtered = filtered.filter(e => {
      const d = toDate(e.startAt);
      if (dateFilter === 'Today')      return d <= todayEnd;
      if (dateFilter === 'This Week')  return d <= weekEnd;
      if (dateFilter === 'This Month') return d <= monthEnd;
      return true;
    });
    if (statusFilter !== 'All')       filtered = filtered.filter(e => {
      const isFull = !!(e.capacity && (e.pendingParticipants ?? []).length >= e.capacity);
      return statusFilter === 'Full' ? isFull : !isFull;
    });
    return groupEventsByDate(filtered);
  }, [events, activeFilter, debouncedSearch, dateFilter, statusFilter]);

  const totalCount = events.length;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Explore Events</Text>
            {!loading && totalCount > 0 && (
              <Text style={styles.headerSub}>{totalCount} upcoming event{totalCount !== 1 ? 's' : ''}</Text>
            )}
          </View>
          {!loading && totalCount > 0 && (
            <View style={styles.newBadge}>
              <Ionicons name="sparkles" size={11} color={Colors.xp} />
              <Text style={styles.newBadgeText}>{totalCount} New</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); setDebounced(''); }}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter pills + list ── */}
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
              {FILTERS.map(f => {
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
                    <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <FilterDropdowns
              dateFilter={dateFilter}   setDateFilter={setDateFilter}
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
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 62, paddingBottom: 14 },
  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  headerTitle: { color: Colors.text, fontSize: FontSize.h1, fontWeight: '800', letterSpacing: -0.5 },
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

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: P.card, borderRadius: Radius.xl,
    paddingHorizontal: 14, height: 44,
    borderWidth: 1, borderColor: P.border,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.sm },

  // Filters
  filterRow: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
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
  sectionDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.xp },
  sectionMain: { color: Colors.text, fontSize: FontSize.md, fontWeight: '800' },
  sectionSub:  { color: Colors.textMuted, fontSize: FontSize.md },
  sectionLine:       { flex: 1, height: 1, backgroundColor: P.border },
  sectionCountBadge: { backgroundColor: P.borderAlt, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  sectionCountText:  { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  sectionGap:        { height: 4 },

  // List
  listContent: { paddingBottom: 30, paddingHorizontal: 16 },

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
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  attendeeCircle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: P.border,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: P.card,
  },
  attendeeCount: { color: Colors.textMuted, fontSize: FontSize.xs },

  // Right column
  cardRight:   { alignItems: 'center', position: 'relative' },
  cardThumb:   { width: 82, height: 82, borderRadius: Radius.md },
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
  option:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14 },
  optionActive:    { backgroundColor: Colors.quest + '10' },
  optionText:      { color: Colors.textSub, fontSize: FontSize.md, fontWeight: '500' },
  optionTextActive:{ color: Colors.quest,   fontSize: FontSize.md, fontWeight: '700' },
});
