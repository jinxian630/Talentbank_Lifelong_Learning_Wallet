import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, Image, Linking, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import QRCode from 'react-native-qrcode-svg';
import { auth, db } from '../../lib/firebase';
import {
  joinEventWithCode,
  leaveEvent,
} from '@talentbank/firebase-config';
import { useBadge } from '../../lib/badge-context';
import type { TalentEvent, RegistrationFormField } from '@talentbank/shared';
import { Colors, EventTypeColors, Radius, FontSize, FontFamily } from '../../constants/theme';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function toDate(v: any): Date {
  if (!v) return new Date(0);
  if (typeof v.toDate === 'function') return v.toDate();
  return new Date(v);
}

type OnlinePlatform = 'google-meet' | 'teams' | 'zoom';

const PLATFORM_META: Record<OnlinePlatform, { label: string; color: string; icon: string }> = {
  'google-meet': { label: 'Google Meet', color: '#00897B', icon: 'videocam' },
  'teams':       { label: 'Teams',       color: '#6264A7', icon: 'people'   },
  'zoom':        { label: 'Zoom',        color: '#2D8CFF', icon: 'camera'   },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: 'Registered',   color: Colors.xp,      icon: 'time-outline'         },
  registered: { label: 'Registered',   color: Colors.xp,      icon: 'time-outline'         },
  checked_in: { label: 'Checked In ✓', color: Colors.success, icon: 'checkmark-circle'     },
  submitted:  { label: 'Submitted',    color: Colors.quest,   icon: 'cloud-upload-outline' },
  approved:   { label: 'Approved 🎉',  color: Colors.success, icon: 'ribbon'               },
  rejected:   { label: 'Rejected',     color: Colors.streak,  icon: 'close-circle-outline' },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.registered;
  return (
    <View style={[styles.statusChip, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40' }]}>
      <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
      <Text style={[styles.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── REGISTRATION FORM MODAL ──────────────────────────────────────────────────

interface RegFormModalProps {
  visible: boolean;
  fields: RegistrationFormField[];
  onCancel: () => void;
  onSubmit: (data: Record<string, string | boolean>) => Promise<void>;
  submitting: boolean;
}

function RegistrationFormModal({ visible, fields, onCancel, onSubmit, submitting }: RegFormModalProps) {
  const [data,   setData]   = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (id: string, value: string | boolean) => {
    setData(prev => ({ ...prev, [id]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    for (const field of fields) {
      if (!field.required) continue;
      const val = data[field.id];
      if (field.type === 'checkbox') {
        if (!val) errs[field.id] = 'Please check this box to continue';
      } else if (!val || (typeof val === 'string' && !val.trim())) {
        errs[field.id] = 'This field is required';
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    await onSubmit(data);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <View>
            <Text style={modalStyles.title}>Registration Details</Text>
            <Text style={modalStyles.subtitle}>Please fill in the details below.</Text>
          </View>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={modalStyles.closeBtn}>
            <Ionicons name="close" size={18} color="#e879f9" />
          </TouchableOpacity>
        </View>

        <ScrollView style={modalStyles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {fields.map(field => (
            <View key={field.id} style={modalStyles.fieldContainer}>
              <Text style={modalStyles.fieldLabel}>
                {field.label}
                {field.required && <Text style={modalStyles.required}> *</Text>}
              </Text>

              {(field.type === 'text' || field.type === 'email' || field.type === 'number') && (
                <TextInput
                  style={[modalStyles.input, errors[field.id] && modalStyles.inputError]}
                  value={typeof data[field.id] === 'string' ? (data[field.id] as string) : ''}
                  onChangeText={v => set(field.id, v)}
                  placeholder={field.placeholder ?? ''}
                  placeholderTextColor="#a78bfa60"
                  keyboardType={field.type === 'email' ? 'email-address' : field.type === 'number' ? 'numeric' : 'default'}
                  autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
                />
              )}

              {field.type === 'textarea' && (
                <TextInput
                  style={[modalStyles.input, modalStyles.textarea, errors[field.id] && modalStyles.inputError]}
                  value={typeof data[field.id] === 'string' ? (data[field.id] as string) : ''}
                  onChangeText={v => set(field.id, v)}
                  placeholder={field.placeholder ?? ''}
                  placeholderTextColor="#a78bfa60"
                  multiline numberOfLines={4} textAlignVertical="top"
                />
              )}

              {field.type === 'select' && field.options && (
                <View style={modalStyles.optionsRow}>
                  {field.options.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => set(field.id, opt)}
                      style={[
                        modalStyles.optionChip,
                        data[field.id] === opt && modalStyles.optionChipSelected,
                        errors[field.id] && modalStyles.optionChipError,
                      ]}
                    >
                      <Text style={[modalStyles.optionText, data[field.id] === opt && modalStyles.optionTextSelected]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {field.type === 'checkbox' && (
                <TouchableOpacity onPress={() => set(field.id, !data[field.id])} style={modalStyles.checkboxRow}>
                  <View style={[modalStyles.checkbox, data[field.id] && modalStyles.checkboxChecked]}>
                    {data[field.id] && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={modalStyles.checkboxLabel}>Yes</Text>
                </TouchableOpacity>
              )}

              {errors[field.id] && <Text style={modalStyles.errorText}>{errors[field.id]}</Text>}
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={modalStyles.footer}>
          <TouchableOpacity
            style={[modalStyles.submitBtn, submitting && modalStyles.btnDisabled]}
            onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={modalStyles.submitBtnText}>Complete Registration 🎟️</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={modalStyles.cancelBtn}>
            <Text style={modalStyles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const user    = auth.currentUser;
  const { addBadge } = useBadge();

  const [event,          setEvent]          = useState<TalentEvent | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [posterRatio,    setPosterRatio]    = useState<number>(16 / 9);
  const [joining,      setJoining]      = useState(false);
  const [leaving,      setLeaving]      = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);
  const [descExpanded,   setDescExpanded]   = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'events', id), snap => {
      if (snap.exists()) setEvent({ id: snap.id, ...snap.data() } as TalentEvent);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Please log in to view events.</Text>
      </View>
    );
  }

  if (loading || !event) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const ev               = event as any;
  const participants     = (event.pendingParticipants ?? []) as any[];
  const myParticipant    = participants.find(p => p.uid === user.uid);
  const isRegistered     = !!myParticipant;
  const status           = myParticipant?.status ?? null;
  const eventEnded       = new Date() > toDate(event.endAt);
  const eventStarted     = new Date() > toDate(event.startAt);
  const typeColor        = EventTypeColors[event.type] ?? Colors.textMuted;
  const hasRegForm       = (ev.registrationForm ?? []).length > 0;
  const stickyCtaVisible = !isRegistered && !eventEnded;
  const seatsLeft        = event.capacity != null ? event.capacity - participants.length : null;

  // Date / time / duration helpers for summary card
  const startDate      = toDate(event.startAt);
  const endDate        = toDate(event.endAt);
  const isSameDay      = startDate.toDateString() === endDate.toDateString();
  const dateLabel      = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeLabel      = `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const durationHours  = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)));
  const durationLabel  = durationHours >= 24
    ? `${Math.round(durationHours / 24)} Day${Math.round(durationHours / 24) > 1 ? 's' : ''}`
    : `${durationHours} Hour${durationHours > 1 ? 's' : ''}`;
  const fillPct        = event.capacity ? Math.min((participants.length / event.capacity) * 100, 100) : 0;
  const seatsBarColor  = fillPct >= 80 ? Colors.streak : fillPct >= 60 ? Colors.xp : Colors.quest;

  // ── Actions ───────────────────────────────────────────────────────────────

  const doJoin = async (registrationData?: Record<string, string | boolean>) => {
    setJoining(true);
    try {
      await joinEventWithCode(
        id!,
        { uid: user.uid, email: user.email, displayName: user.displayName ?? user.email },
        registrationData,
      );
      setShowRegModal(false);
      addBadge();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to join event.');
    } finally {
      setJoining(false);
    }
  };

  const handleJoin = () => hasRegForm ? setShowRegModal(true) : doJoin();

  const handleLeave = () => {
    Alert.alert('Leave Event', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          setLeaving(true);
          try { await leaveEvent(id!, { uid: user.uid, email: user.email }); }
          catch (e: any) { Alert.alert('Error', e.message); }
          finally { setLeaving(false); }
        },
      },
    ]);
  };

  const openMaps = (address: string) =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`).catch(() =>
      Alert.alert('Cannot open Maps', 'Google Maps could not be opened on this device.'));

  const openWaze = (address: string) =>
    Linking.openURL(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`).catch(() =>
      Alert.alert('Cannot open Waze', 'Waze could not be opened on this device.'));

  const openMeetingUrl = (url: string) =>
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open link', 'The meeting link could not be opened.'));

  // ── Section renderers ─────────────────────────────────────────────────────

  const renderVenueRow = () => {
    if (!ev.locationType) return null;

    if (ev.locationType === 'online' && ev.meetingUrl) {
      const platform = (ev.onlinePlatform ?? 'google-meet') as OnlinePlatform;
      const meta     = PLATFORM_META[platform] ?? PLATFORM_META['google-meet'];
      return (
        <View style={styles.venueSection}>
          <View style={[styles.onlinePlatformCard, { borderColor: meta.color + '40', backgroundColor: meta.color + '0D' }]}>
            <View style={[styles.onlinePlatformIcon, { backgroundColor: meta.color + '20' }]}>
              <Ionicons name={meta.icon as any} size={20} color={meta.color} />
            </View>
            <View style={styles.onlinePlatformInfo}>
              <Text style={[styles.onlinePlatformLabel, { color: meta.color }]}>{meta.label}</Text>
              <Text style={styles.onlineSubtext}>Online Event</Text>
            </View>
            <TouchableOpacity
              style={[styles.joinMeetingBtn, { backgroundColor: meta.color + '20', borderColor: meta.color + '50' }]}
              onPress={() => openMeetingUrl(ev.meetingUrl)} activeOpacity={0.8}
            >
              <Text style={[styles.joinMeetingText, { color: meta.color }]}>Join</Text>
              <Ionicons name="open-outline" size={13} color={meta.color} />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (ev.locationType === 'physical' && ev.venueAddress) {
      return (
        <View style={styles.venueSection}>
          <View style={styles.compactLocationCard}>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={15} color="#ff4757" />
              <Text style={styles.locationText} numberOfLines={2}>{ev.venueAddress}</Text>
            </View>
            <View style={styles.locationChipsRow}>
              <TouchableOpacity
                style={[styles.locationChip, { borderColor: Colors.quest + '30' }]}
                onPress={() => openMaps(ev.venueAddress)} activeOpacity={0.8}
              >
                <Ionicons name="map-outline" size={13} color={Colors.quest} />
                <Text style={[styles.locationChipText, { color: Colors.quest }]}>Google Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.locationChip, { borderColor: '#33ccff30' }]}
                onPress={() => openWaze(ev.venueAddress)} activeOpacity={0.8}
              >
                <Ionicons name="navigate-outline" size={13} color="#33ccff" />
                <Text style={[styles.locationChipText, { color: '#33ccff' }]}>Waze</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  const renderBadgePreview = () => {
    if (!ev.badgeShape && !ev.badgeColor && !ev.badgeEmoji && !ev.badgeImageUrl) return null;
    const isApproved = status === 'approved';
    const color      = ev.badgeColor  ?? '#E8923C';
    const emoji      = ev.badgeEmoji  ?? '🏆';
    const shape      = ev.badgeShape  ?? 'circle';

    const badgeRadius = shape === 'circle'  ? 40
      : shape === 'diamond' || shape === 'star' ? 8
      : shape === 'hexagon' ? 12
      : 10;

    return (
      <View style={[styles.badgeSection, isApproved && { borderColor: '#E8923C40' }]}>
        <View style={styles.badgeSectionHeader}>
          <Text style={styles.badgeSectionTitle}>Completion Badge</Text>
          {isApproved && (
            <View style={styles.badgeEarnedPill}>
              <Text style={styles.badgeEarnedText}>🏅 You earned this!</Text>
            </View>
          )}
        </View>
        <View style={styles.badgePreviewRow}>
          {ev.badgeImageUrl ? (
            <View style={[styles.badgeImageWrap, isApproved && styles.badgeEarnedGlow]}>
              <Image source={{ uri: ev.badgeImageUrl }} style={styles.badgeCustomImg} resizeMode="contain" />
            </View>
          ) : (
            <View style={[
              styles.badgeShapeBox,
              {
                backgroundColor: color,
                borderRadius: badgeRadius,
                shadowColor: color,
              },
              isApproved && styles.badgeEarnedGlow,
            ]}>
              <Text style={{ fontSize: 30 }}>{emoji}</Text>
            </View>
          )}
          <View style={styles.badgeInfo}>
            <Text style={styles.badgeName} numberOfLines={2}>{ev.title}</Text>
            <Text style={styles.badgeTypeLbl}>{ev.type} Badge</Text>
            {!isApproved && (
              <Text style={styles.badgeHint}>Awarded upon approval</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderDescription = () => {
    if (!event.description) return null;
    const isLong = event.description.length > 200;
    return (
      <View style={styles.aboutSection}>
        <View style={styles.aboutHeader}>
          <Ionicons name="document-text-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.aboutTitle}>About this Event</Text>
        </View>
        <Text style={styles.aboutText} numberOfLines={descExpanded ? undefined : 8}>
          {event.description}
        </Text>
        {isLong && (
          <TouchableOpacity onPress={() => setDescExpanded(v => !v)} style={styles.showMoreBtn}>
            <Text style={styles.showMoreText}>{descExpanded ? 'Show less ↑' : 'Show more ↓'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderQRSection = () => (
    <View style={styles.section}>
      <StatusChip status={status} />
      <View style={styles.qrCard}>
        <Text style={styles.qrTitle}>Your Check-in QR</Text>
        <Text style={styles.qrSub}>Show this to the admin at the event entrance</Text>
        <View style={styles.qrBox}>
          {myParticipant?.checkinCode
            ? <QRCode value={myParticipant.checkinCode} size={200} color="#3A332C" backgroundColor="#FFFFFF" />
            : <ActivityIndicator color={Colors.accent} />}
        </View>
        {myParticipant?.shortCode && (
          <View style={styles.shortCodeRow}>
            <Text style={styles.shortCodeLabel}>Manual code</Text>
            <Text style={styles.shortCode}>
              {myParticipant.shortCode.slice(0, 4)} {myParticipant.shortCode.slice(4)}
            </Text>
          </View>
        )}
        {status === 'checked_in' && (
          <View style={styles.checkedInBanner}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.checkedInText}>You've been checked in! ✓</Text>
          </View>
        )}
        {(status === 'registered' || status === 'pending') && (
          <Text style={styles.qrHint}>🕐 Waiting for admin to scan at check-in</Text>
        )}
      </View>

      {status === 'checked_in' && (
        <View style={styles.nudgeCard}>
          <Ionicons name="send-outline" size={16} color={Colors.quest} />
          <Text style={styles.nudgeText}>
            Head to <Text style={styles.nudgeBold}>My Events → Submit Work</Text> to complete your submission.
          </Text>
        </View>
      )}

      {!eventStarted && (
        <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} disabled={leaving}>
          <Text style={styles.leaveBtnText}>{leaving ? 'Leaving…' : 'Leave Event'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSubmittedState = () => {
    const sub = myParticipant?.submission;
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.registered;
    return (
      <View style={styles.section}>
        <StatusChip status={status} />
        <View style={[styles.submittedCard, { borderColor: cfg.color + '30' }]}>
          {sub?.photoUrl && <Image source={{ uri: sub.photoUrl }} style={styles.submittedPhoto} resizeMode="cover" />}
          <View style={styles.submittedBody}>
            <Text style={styles.submittedTitle}>
              {status === 'approved' ? '🎉 Badge Awarded!' : status === 'rejected' ? '❌ Rejected' : '⏳ Awaiting Review'}
            </Text>
            <Text style={styles.submittedMsg}>
              {status === 'approved'
                ? 'The admin approved your submission! Check your Wallet for your new badge.'
                : status === 'rejected'
                  ? 'Your submission was not approved. Try again at the next event!'
                  : 'Your work is being reviewed by the admin. Sit tight!'}
            </Text>
            {sub?.feedback && (
              <View style={styles.feedbackPreview}>
                <Text style={styles.feedbackPreviewLabel}>Your feedback:</Text>
                <Text style={styles.feedbackPreviewText} numberOfLines={3}>{sub.feedback}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Fixed back button — floats over poster or summary card, never scrolls away */}
      <TouchableOpacity style={styles.fixedBackBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={18} color="#fff" />
        <Text style={styles.fixedBackLabel}>Events</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: stickyCtaVisible ? 100 : 0,
          paddingTop: event.imageUrl ? 0 : 96,
        }}
      >

        {/* ── Event Poster ─────────────────────────────────────────────────── */}
        {event.imageUrl && (
          <View style={[styles.posterContainer, { aspectRatio: posterRatio }]}>
            <Image
              source={{ uri: event.imageUrl }}
              style={styles.posterImage}
              resizeMode="cover"
              onLoad={(e) => {
                // Native: e.nativeEvent.source.{width,height}
                // Web (react-native-web): e.nativeEvent.{width,height}
                const ev = e.nativeEvent as any;
                const w = ev?.source?.width  ?? ev?.width;
                const h = ev?.source?.height ?? ev?.height;
                if (w && h) setPosterRatio(w / h);
              }}
            />
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 40, left: 0, right: 0, height: 50, backgroundColor: 'rgba(10,10,10,0.40)' }} />
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, backgroundColor: 'rgba(10,10,10,0.92)' }} />
          </View>
        )}

        {/* ── Event Summary Card (overlaps poster) ─────────────────────────── */}
        <View style={[styles.summaryCard, event.imageUrl && styles.summaryCardOverlap, { borderTopWidth: 2, borderTopColor: typeColor + '60' }]}>

          {/* Emoji + type badge */}
          <View style={styles.summaryTopRow}>
            <View style={[styles.eventEmoji, { backgroundColor: typeColor + '18' }]}>
              <Text style={{ fontSize: 22 }}>{event.emoji ?? '📅'}</Text>
            </View>
            <View style={[styles.typePill, { backgroundColor: typeColor + '18' }]}>
              <Text style={[styles.typeText, { color: typeColor }]}>{event.type}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.eventTitle}>{event.title}</Text>

          {/* Quick info chips */}
          <View style={styles.quickChipsRow}>
            <View style={styles.quickChip}>
              <Text style={styles.quickChipText}>📅 {dateLabel}</Text>
            </View>
            {isSameDay ? (
              <View style={styles.quickChip}>
                <Text style={styles.quickChipText}>🕒 {timeLabel}</Text>
              </View>
            ) : (
              <View style={styles.quickChip}>
                <Text style={styles.quickChipText}>⏱ {durationLabel}</Text>
              </View>
            )}
            {ev.locationType === 'online' && (
              <View style={styles.quickChip}>
                <Text style={styles.quickChipText}>🌐 Online</Text>
              </View>
            )}
            {ev.locationType === 'physical' && (
              <View style={styles.quickChip}>
                <Text style={styles.quickChipText}>📍 In Person</Text>
              </View>
            )}
          </View>

          {/* Address / meeting row */}
          {ev.locationType === 'physical' && ev.venueAddress && (
            <View style={styles.summaryMetaRow}>
              <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.summaryMetaText} numberOfLines={1}>{ev.venueAddress}</Text>
            </View>
          )}
          {ev.locationType === 'online' && (
            <View style={styles.summaryMetaRow}>
              <Ionicons name="globe-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.summaryMetaText}>Online Event</Text>
            </View>
          )}

          {/* Organizer */}
          {ev.organizer && (
            <View style={styles.summaryMetaRow}>
              <Ionicons name="business-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.summaryMetaText}>{ev.organizer}</Text>
            </View>
          )}

          {/* Seats progress bar */}
          {event.capacity != null && (
            <View style={styles.seatsSection}>
              <View style={styles.seatsRow}>
                <Text style={styles.seatsLabel}>🎟 {participants.length} / {event.capacity} Seats Filled</Text>
                {seatsLeft !== null && (
                  <Text style={[styles.seatsLeftText, seatsLeft <= 5 && { color: Colors.streak }]}>
                    {seatsLeft} left
                  </Text>
                )}
              </View>
              <View style={styles.seatsBar}>
                <View style={[styles.seatsBarFill, { width: `${fillPct}%`, backgroundColor: seatsBarColor }]} />
              </View>
            </View>
          )}
        </View>

        {/* ── Badge Preview ────────────────────────────────────────────────── */}
        {renderBadgePreview()}

        {/* ── About ────────────────────────────────────────────────────────── */}
        {renderDescription()}

        {/* ── Venue / Meeting ──────────────────────────────────────────────── */}
        {renderVenueRow()}

        {/* ── Event ended (unregistered) ───────────────────────────────────── */}
        {!isRegistered && eventEnded && (
          <View style={styles.section}>
            <View style={styles.endedBanner}>
              <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.endedText}>This event has ended. Registration is closed.</Text>
            </View>
          </View>
        )}

        {isRegistered && (status === 'registered' || status === 'pending' || status === 'checked_in') && renderQRSection()}
        {isRegistered && (status === 'submitted' || status === 'approved' || status === 'rejected') && renderSubmittedState()}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Sticky Register CTA ──────────────────────────────────────────────── */}
      {stickyCtaVisible && (
        <View style={styles.stickyCtaBar}>
          <TouchableOpacity
            style={[styles.stickyCtaBtn, joining && styles.btnDisabled]}
            onPress={handleJoin} disabled={joining} activeOpacity={0.85}
          >
            {joining ? (
              <ActivityIndicator color={Colors.bg} size="small" />
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sparkles" size={15} color={Colors.bg} />
                  <Text style={styles.stickyCtaBtnText}>Register Now</Text>
                </View>
                {seatsLeft !== null && <Text style={styles.stickyCtaSeats}>{seatsLeft} seats left</Text>}
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {hasRegForm && (
        <RegistrationFormModal
          visible={showRegModal}
          fields={ev.registrationForm}
          onCancel={() => setShowRegModal(false)}
          onSubmit={doJoin}
          submitting={joining}
        />
      )}
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.streak, fontSize: FontSize.md },

  // Fixed back button — absolute over the whole screen, never scrolls
  fixedBackBtn: {
    position: 'absolute', top: 52, left: 16, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10,
    minHeight: 44,
  },
  fixedBackLabel: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },

  // Poster — full width, aspect ratio set dynamically from image dimensions (no crop)
  posterContainer: { width: '100%', backgroundColor: Colors.surface },
  posterImage:     { width: '100%', height: '100%' },

  // Summary card — overlaps poster with negative margin
  summaryCard:        {
    marginHorizontal: 16,
    backgroundColor:  Colors.surface,
    borderRadius:     Radius.xxl,
    borderWidth:      1,
    borderColor:      Colors.border,
    padding:          20,
    gap:              14,
  },
  summaryCardOverlap: { marginTop: -32 },

  summaryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventEmoji:    { width: 40, height: 40, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  typePill:      { borderRadius: Radius.xxl, paddingHorizontal: 12, paddingVertical: 5 },
  typeText:      { fontSize: FontSize.sm, fontWeight: '700' },
  eventTitle:    { color: Colors.text, fontSize: 26, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5, fontFamily: FontFamily.heading },

  // Quick info chips in summary card
  quickChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip:     {
    backgroundColor: Colors.surfaceAlt,
    borderRadius:    Radius.lg,
    borderWidth:     1,
    borderColor:     Colors.borderAlt,
    paddingHorizontal: 11,
    paddingVertical:   6,
  },
  quickChipText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '500' },

  // Address / organizer rows inside summary card
  summaryMetaRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryMetaText: { color: Colors.textSub, fontSize: FontSize.sm, flex: 1 },

  // Seats progress bar
  seatsSection:  { gap: 8, paddingTop: 2 },
  seatsRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seatsLabel:    { color: Colors.textSub, fontSize: FontSize.xs },
  seatsLeftText: { color: Colors.quest, fontSize: FontSize.xs, fontWeight: '700' },
  seatsBar:      { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  seatsBarFill:  { height: 6, backgroundColor: Colors.quest, borderRadius: 3 },

  // Badge preview section
  badgeSection: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 14,
  },
  badgeSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeSectionTitle:  { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  badgeEarnedPill:    { backgroundColor: '#E8923C20', borderRadius: Radius.xxl, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#E8923C50' },
  badgeEarnedText:    { color: '#E8923C', fontSize: 11, fontWeight: '700' },
  badgePreviewRow:    { flexDirection: 'row', alignItems: 'center', gap: 16 },
  badgeShapeBox: {
    width: 72, height: 72, alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 6, flexShrink: 0,
  },
  badgeImageWrap: {
    width: 72, height: 72, borderRadius: Radius.xl, overflow: 'hidden',
    backgroundColor: Colors.surfaceAlt, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeCustomImg:  { width: 72, height: 72 },
  badgeEarnedGlow: { borderWidth: 2, borderColor: '#E8923C', borderRadius: Radius.xl },
  badgeInfo:       { flex: 1, gap: 4 },
  badgeName:       { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700', lineHeight: 20 },
  badgeTypeLbl:    { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  badgeHint:       { color: Colors.textMuted, fontSize: 10, marginTop: 2 },

  // About section
  aboutSection: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 10 },
  aboutHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aboutTitle:   { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  aboutText:    { color: Colors.text, fontSize: FontSize.sm, lineHeight: 22 },
  showMoreBtn:  { alignSelf: 'flex-start', paddingTop: 2 },
  showMoreText: { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '600' },

  // Venue section
  venueSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 12 },

  // Compact physical location card
  compactLocationCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 10 },
  locationRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationText:        { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600', flex: 1 },
  locationChipsRow:    { flexDirection: 'row', gap: 8 },
  locationChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.bg, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, flex: 1, justifyContent: 'center' },
  locationChipText:    { fontSize: FontSize.sm, fontWeight: '700' },

  // Online platform card
  onlinePlatformCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: Radius.xl, padding: 16 },
  onlinePlatformIcon:  { width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  onlinePlatformInfo:  { flex: 1 },
  onlinePlatformLabel: { fontSize: FontSize.md, fontWeight: '700' },
  onlineSubtext:       { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  joinMeetingBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8 },
  joinMeetingText:     { fontSize: FontSize.sm, fontWeight: '700' },

  section: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },

  statusChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.xxl, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
  statusChipText: { fontSize: FontSize.sm, fontWeight: '700' },

  qrCard:          { backgroundColor: Colors.surface, borderRadius: Radius.xxl, borderWidth: 1, borderColor: Colors.border, padding: 24, alignItems: 'center', gap: 10 },
  qrTitle:         { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  qrSub:           { color: Colors.textSub, fontSize: FontSize.sm, textAlign: 'center' },
  qrBox:           { width: 220, height: 220, backgroundColor: Colors.bg, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', padding: 10 },
  checkedInBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.success + '15', borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 10 },
  checkedInText:   { color: Colors.success, fontWeight: '700', fontSize: FontSize.sm },
  qrHint:          { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center' },
  shortCodeRow:    { alignItems: 'center', gap: 4 },
  shortCodeLabel:  { color: Colors.textMuted, fontSize: FontSize.xs, textTransform: 'uppercase', letterSpacing: 1 },
  shortCode:       { color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 4 },

  submissionSection:    { backgroundColor: Colors.surface, borderRadius: Radius.xxl, borderWidth: 1, borderColor: Colors.border, padding: 20, gap: 12 },
  submissionTitle:      { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  submissionSub:        { color: Colors.textSub, fontSize: FontSize.sm, lineHeight: 20 },
  fieldLabel:           { color: Colors.textSub, fontSize: FontSize.sm, fontWeight: '600' },
  photoPicker:          { borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: Radius.xl, overflow: 'hidden', height: 150 },
  photoPlaceholder:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoPlaceholderText: { color: Colors.textMuted, fontSize: FontSize.sm },
  photoPreview:         { width: '100%', height: '100%' },
  removePhotoText:      { color: Colors.streak, fontSize: FontSize.xs, textAlign: 'center' },
  feedbackInput:        { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: 14, color: Colors.text, fontSize: FontSize.sm, minHeight: 110, lineHeight: 22 },
  feedbackCount:        { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'right' },

  nudgeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.quest + '10', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.quest + '25', padding: 14 },
  nudgeText: { color: Colors.textSub, fontSize: FontSize.sm, flex: 1, lineHeight: 20 },
  nudgeBold: { color: Colors.quest, fontWeight: '700' },

  submitBtn:     { backgroundColor: Colors.xp, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  submitBtnRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnText: { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },
  btnDisabled:   { opacity: 0.4 },
  leaveBtn:      { alignItems: 'center', paddingVertical: 8 },
  leaveBtnText:  { color: Colors.streak, fontSize: FontSize.sm },

  submittedCard:        { backgroundColor: Colors.surface, borderRadius: Radius.xxl, borderWidth: 1, overflow: 'hidden' },
  submittedPhoto:       { width: '100%', height: 180 },
  submittedBody:        { padding: 20, gap: 8 },
  submittedTitle:       { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  submittedMsg:         { color: Colors.textSub, fontSize: FontSize.sm, lineHeight: 22 },
  feedbackPreview:      { backgroundColor: Colors.bg, borderRadius: Radius.lg, padding: 12, marginTop: 4 },
  feedbackPreviewLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 4 },
  feedbackPreviewText:  { color: Colors.textSub, fontSize: FontSize.sm, lineHeight: 20, fontStyle: 'italic' },

  endedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  endedText:   { color: Colors.textSub, fontSize: FontSize.sm, flex: 1 },

  // Sticky register CTA
  stickyCtaBar:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 34 },
  stickyCtaBtn:     { backgroundColor: Colors.xp, borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center', gap: 3 },
  stickyCtaBtnText: { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },
  stickyCtaSeats:   { color: Colors.bg + 'BB', fontSize: FontSize.xs, fontWeight: '600' },
});

// ─── MODAL STYLES — warm cream theme ─────────────────────────────────────────

const MODAL_PRIMARY = '#E8923C';
const MODAL_ACCENT  = '#C9A876';

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4EE' },
  header:    {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    backgroundColor: MODAL_PRIMARY, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20,
  },
  title:    { color: '#fff', fontSize: FontSize.xl, fontWeight: '800' },
  subtitle: { color: '#fff', fontSize: FontSize.xs, marginTop: 4, lineHeight: 18, opacity: 0.85 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },

  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  fieldContainer: { marginBottom: 20 },
  fieldLabel:     { color: '#3A332C', fontSize: FontSize.sm, fontWeight: '600', marginBottom: 8 },
  required:       { color: MODAL_PRIMARY },

  input:      { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2DED6', borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, color: '#3A332C', fontSize: FontSize.sm },
  textarea:   { minHeight: 90, textAlignVertical: 'top', lineHeight: 20 },
  inputError: { borderColor: '#f87171' },

  optionsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip:         { borderWidth: 1, borderColor: '#E2DED6', borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8 },
  optionChipSelected: { borderColor: MODAL_PRIMARY, backgroundColor: MODAL_PRIMARY + '20' },
  optionChipError:    { borderColor: '#f87171' },
  optionText:         { color: '#6b6059', fontSize: FontSize.sm },
  optionTextSelected: { color: MODAL_PRIMARY, fontWeight: '700' },

  checkboxRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D4CFC6', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: MODAL_PRIMARY, borderColor: MODAL_PRIMARY },
  checkboxLabel:   { color: '#6b6059', fontSize: FontSize.sm },
  errorText:       { color: '#f87171', fontSize: FontSize.xs, marginTop: 4 },

  footer:        { paddingHorizontal: 20, paddingBottom: 36, paddingTop: 14, gap: 10, borderTopWidth: 1, borderTopColor: '#E2DED6' },
  submitBtn:     { backgroundColor: MODAL_PRIMARY, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
  cancelBtn:     { alignItems: 'center', paddingVertical: 8 },
  cancelBtnText: { color: MODAL_PRIMARY + '80', fontSize: FontSize.sm },
  btnDisabled:   { opacity: 0.45 },
});
