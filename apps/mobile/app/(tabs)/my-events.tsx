import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Animated, ActivityIndicator, Image,
  Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from '../../lib/firebase';
import { submitEventWork } from '@talentbank/firebase-config';
import type { TalentEvent, FeedbackFormConfig } from '@talentbank/shared';
import { Colors, EventTypeColors, Radius, FontSize } from '../../constants/theme';
import { useBadge } from '../../lib/badge-context';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function toDate(v: any): Date {
  if (!v) return new Date(0);
  if (typeof v.toDate === 'function') return v.toDate();
  return new Date(v);
}

function isEventPast(event: TalentEvent): boolean {
  const endMs = event.endAt ? toDate(event.endAt).getTime() : toDate(event.startAt).getTime();
  return endMs < Date.now();
}

function formatTime(v: any): string {
  return toDate(v).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(v: any): string {
  return toDate(v).toLocaleDateString('en-MY', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: '🎟️ Registered',    color: Colors.xp,      bg: 'rgba(251,191,36,0.1)'   },
  registered: { label: '🎟️ Registered',    color: Colors.xp,      bg: 'rgba(251,191,36,0.1)'   },
  checked_in: { label: '✅ Checked In',    color: Colors.success, bg: 'rgba(52,211,153,0.1)'   },
  submitted:  { label: '📤 Submitted',     color: Colors.quest,   bg: 'rgba(96,165,250,0.1)'   },
  approved:   { label: '🏅 Badge Awarded', color: Colors.success, bg: 'rgba(52,211,153,0.1)'   },
  rejected:   { label: '❌ Not Approved',  color: Colors.streak,  bg: 'rgba(251,113,133,0.1)'  },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.registered;
  return (
    <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.color + '35' }]}>
      <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── SKELETON CARD ────────────────────────────────────────────────────────────

function MyEventSkeleton({ variant }: { variant: 'featured' | 'compact' }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  if (variant === 'compact') {
    return (
      <Animated.View style={[skStyles.compactCard, { opacity }]}>
        <View style={skStyles.compactThumb} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={skStyles.barWide} />
          <View style={skStyles.barMid} />
        </View>
        <View style={skStyles.barPill} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[skStyles.featuredCard, { opacity }]}>
      <View style={skStyles.accentStrip} />
      <View style={{ flexDirection: 'row', flex: 1, padding: 14, gap: 12 }}>
        <View style={skStyles.featuredThumb} />
        <View style={{ flex: 1, gap: 10 }}>
          <View style={skStyles.barShort} />
          <View style={skStyles.barFull} />
          <View style={skStyles.barMedium} />
          <View style={skStyles.barPill} />
        </View>
      </View>
    </Animated.View>
  );
}

const SK = Colors.border;
const skStyles = StyleSheet.create({
  featuredCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#1c2033',
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 5,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13161f',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#1c2033',
    marginHorizontal: 16,
    marginVertical: 4,
    gap: 12,
  },
  accentStrip:  { width: 3, backgroundColor: SK },
  featuredThumb:{ width: 100, height: 100, borderRadius: Radius.md, backgroundColor: SK },
  compactThumb: { width: 44,  height: 44,  borderRadius: Radius.sm, backgroundColor: SK, flexShrink: 0 },
  barShort:  { width: '40%', height: 11, borderRadius: 6, backgroundColor: SK },
  barMid:    { width: '55%', height: 11, borderRadius: 6, backgroundColor: SK },
  barMedium: { width: '70%', height: 14, borderRadius: 6, backgroundColor: SK },
  barWide:   { width: '85%', height: 13, borderRadius: 6, backgroundColor: SK },
  barFull:   { width: '90%', height: 14, borderRadius: 6, backgroundColor: SK },
  barPill:   { width: 60, height: 22, borderRadius: 10, backgroundColor: SK },
});

// ─── FUTURE EVENT CARD ────────────────────────────────────────────────────────

function FutureEventCard({ event, myStatus, onPress, onShowQR }: {
  event: TalentEvent; myStatus: string; onPress: () => void; onShowQR?: () => void;
}) {
  const typeColor    = EventTypeColors[event.type] ?? Colors.textMuted;
  const showQRAction = (myStatus === 'registered' || myStatus === 'pending' || myStatus === 'checked_in') && !!onShowQR;

  const statusHint = myStatus === 'submitted' ? (
    <View style={styles.statusHint}>
      <Ionicons name="time-outline" size={12} color={Colors.quest} />
      <Text style={[styles.statusHintText, { color: Colors.quest }]}>Awaiting review…</Text>
    </View>
  ) : myStatus === 'approved' ? (
    <View style={styles.statusHint}>
      <Ionicons name="ribbon-outline" size={12} color={Colors.success} />
      <Text style={[styles.statusHintText, { color: Colors.success }]}>Badge earned — check Wallet!</Text>
    </View>
  ) : myStatus === 'rejected' ? (
    <View style={styles.statusHint}>
      <Ionicons name="information-circle-outline" size={12} color={Colors.streak} />
      <Text style={[styles.statusHintText, { color: Colors.streak }]}>Contact the organiser.</Text>
    </View>
  ) : null;

  const cardInner = (
    <>
      {/* Top row: accent strip + content */}
      <View style={styles.featuredTopRow}>
        <View style={[styles.featuredAccent, { backgroundColor: typeColor }]} />

        {/* Card body */}
        <View style={styles.featuredBody}>
          {/* Thumbnail */}
          <View style={styles.featuredThumbWrap}>
            {event.imageUrl
              ? <Image source={{ uri: event.imageUrl }} style={styles.featuredThumb} resizeMode="cover" />
              : <View style={[styles.featuredEmojiBox, { backgroundColor: typeColor + '18' }]}>
                  <Text style={{ fontSize: 32 }}>{(event as any).emoji ?? '📅'}</Text>
                </View>}
            <View style={styles.featuredThumbFade} />
          </View>

          {/* Info */}
          <View style={styles.featuredInfo}>
            <Text style={styles.cardTime}>{formatTime(event.startAt)}</Text>
            <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
            <View style={styles.cardMetaRow}>
              <View style={[styles.typePill, { backgroundColor: typeColor + '18' }]}>
                <Text style={[styles.typeText, { color: typeColor }]}>{event.type}</Text>
              </View>
            </View>
            <StatusPill status={myStatus} />
            {!showQRAction && statusHint}
          </View>
        </View>
      </View>

      {/* Action buttons for registered/pending/checked_in */}
      {showQRAction && (
        <View style={styles.cardActionRow}>
          <TouchableOpacity style={styles.qrBtn} onPress={onShowQR} activeOpacity={0.8}>
            <Ionicons name="qr-code" size={13} color={Colors.bg} />
            <Text style={styles.qrBtnText}>Show QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.detailsBtn} onPress={onPress} activeOpacity={0.8}>
            <Ionicons name="information-circle-outline" size={13} color={Colors.quest} />
            <Text style={styles.detailsBtnText}>View Details</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  if (showQRAction) {
    return <View style={[styles.featuredCard, { borderColor: '#1c2033' }]}>{cardInner}</View>;
  }

  return (
    <TouchableOpacity
      style={[styles.featuredCard, { borderColor: '#1c2033' }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {cardInner}
    </TouchableOpacity>
  );
}

// ─── PAST EVENT CARD ──────────────────────────────────────────────────────────

function PastEventCard({ event, myStatus, onPress, onViewSubmission }: {
  event: TalentEvent; myStatus: string; onPress: () => void; onViewSubmission?: () => void;
}) {
  const typeColor      = EventTypeColors[event.type] ?? Colors.textMuted;
  const hasSubmission  = (myStatus === 'submitted' || myStatus === 'approved' || myStatus === 'rejected') && !!onViewSubmission;
  const subBtnColor    = myStatus === 'approved' ? Colors.success
    : myStatus === 'rejected' ? Colors.streak
    : Colors.quest;

  const thumb = event.imageUrl
    ? <Image source={{ uri: event.imageUrl }} style={styles.pastThumb} resizeMode="cover" />
    : <View style={[styles.pastEmoji, { backgroundColor: typeColor + '18' }]}>
        <Text style={{ fontSize: 20 }}>{(event as any).emoji ?? '📅'}</Text>
      </View>;

  if (hasSubmission) {
    // Layout: accent | thumb | [title / date / status pill] | [action col]
    return (
      <View style={[styles.compactCard, styles.pastTopRow]}>
        <View style={[styles.compactAccent, { backgroundColor: typeColor }]} />
        <View style={styles.compactInner}>
          {thumb}
          <View style={styles.cardLeft}>
            <Text style={styles.pastTitle} numberOfLines={1}>{event.title}</Text>
            <Text style={styles.pastDate}>{formatDate(event.startAt)}</Text>
            <StatusPill status={myStatus} />
          </View>
          {/* Right column: stacked action buttons */}
          <View style={styles.pastActionCol}>
            <TouchableOpacity
              style={[styles.pastActionBtn, { backgroundColor: subBtnColor + '15', borderColor: subBtnColor + '45' }]}
              onPress={onViewSubmission}
              activeOpacity={0.8}
              accessibilityLabel="View Submission"
            >
              <Ionicons name="document-text-outline" size={12} color={subBtnColor} />
              <Text style={[styles.pastActionBtnText, { color: subBtnColor }]}>Submission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pastActionBtn, { backgroundColor: Colors.quest + '15', borderColor: Colors.quest + '45' }]}
              onPress={onPress}
              activeOpacity={0.8}
              accessibilityLabel="View Details"
            >
              <Ionicons name="information-circle-outline" size={12} color={Colors.quest} />
              <Text style={[styles.pastActionBtnText, { color: Colors.quest }]}>Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // No submission: fully tappable card with chevron
  return (
    <TouchableOpacity style={[styles.compactCard, styles.pastTopRow]} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.compactAccent, { backgroundColor: typeColor }]} />
      <View style={styles.compactInner}>
        {thumb}
        <View style={styles.cardLeft}>
          <Text style={styles.pastTitle} numberOfLines={1}>{event.title}</Text>
          <Text style={styles.pastDate}>{formatDate(event.startAt)}</Text>
          <StatusPill status={myStatus} />
        </View>
        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

// ─── SUBMIT WORK CARD ─────────────────────────────────────────────────────────

function SubmitWorkCard({ event, onPress }: { event: TalentEvent; onPress: () => void }) {
  const ev          = event as any;
  const typeColor   = EventTypeColors[event.type] ?? Colors.textMuted;
  const feedbackForm = (ev.feedbackForm ?? null) as FeedbackFormConfig | null;
  const taskCount   = feedbackForm?.tasks?.length ?? 0;
  const startDate   = toDate(event.startAt);

  return (
    <TouchableOpacity style={styles.submitCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.submitCardBody}>
        {/* Thumbnail */}
        {event.imageUrl
          ? <Image source={{ uri: event.imageUrl }} style={styles.submitCardThumb} resizeMode="cover" />
          : <View style={[styles.submitCardEmoji, { backgroundColor: typeColor + '18' }]}>
              <Text style={{ fontSize: 28 }}>{ev.emoji ?? '📅'}</Text>
            </View>}

        {/* Info */}
        <View style={styles.submitCardInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={[styles.typePill, { backgroundColor: typeColor + '18' }]}>
              <Text style={[styles.typeText, { color: typeColor }]}>{event.type}</Text>
            </View>
            <View style={styles.actionNeededBadge}>
              <Text style={styles.actionNeededText}>ACTION NEEDED</Text>
            </View>
          </View>
          <Text style={styles.submitCardTitle} numberOfLines={2}>{event.title}</Text>
          <Text style={styles.submitCardDate}>
            {startDate.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' })}
            {' · '}{formatTime(event.startAt)}
          </Text>
        </View>
      </View>

      {/* Footer row */}
      <View style={styles.submitCardFooter}>
        <View style={styles.taskCountPill}>
          <Ionicons name="list-outline" size={12} color={Colors.xp} />
          <Text style={styles.taskCountText}>
            {taskCount > 0 ? `${taskCount} task${taskCount > 1 ? 's' : ''}` : 'Photo + Reflection'}
          </Text>
        </View>
        <View style={styles.submitWorkBtn}>
          <Text style={styles.submitWorkBtnText}>Submit Work</Text>
          <Ionicons name="arrow-forward" size={13} color={Colors.bg} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── SUBMISSION MODAL ─────────────────────────────────────────────────────────

interface SubmissionModalProps {
  event: TalentEvent | null;
  userId: string;
  onClose: () => void;
}

function SubmissionModal({ event, userId, onClose }: SubmissionModalProps) {
  const ev           = event as any;
  const feedbackForm = (ev?.feedbackForm ?? null) as FeedbackFormConfig | null;
  const hasTasks     = (feedbackForm?.tasks?.length ?? 0) > 0;

  const [formResponses,  setFormResponses]  = useState<Record<string, string>>({});
  const [formErrors,     setFormErrors]     = useState<Record<string, string>>({});
  const [submitting,     setSubmitting]     = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [submitSuccess,  setSubmitSuccess]  = useState(false);

  useEffect(() => {
    setFormResponses({});
    setFormErrors({});
    setSubmitting(false);
    setPhotoUploading(false);
    setSubmitSuccess(false);
  }, [event?.id]);

  const pickPhoto = async (taskId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission required', 'Allow photo library access to continue.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
    if (!result.canceled) {
      setFormResponses(p => ({ ...p, [taskId]: result.assets[0].uri }));
      setFormErrors(p => { const n = { ...p }; delete n[taskId]; return n; });
    }
  };

  const handleSubmit = async () => {
    if (!event) return;
    const errors: Record<string, string> = {};

    if (hasTasks) {
      for (const task of feedbackForm!.tasks) {
        const val = (formResponses[task.id] ?? '').trim();
        if (task.required && !val) {
          errors[task.id] = task.type === 'photo' ? 'Please upload a photo.' : 'This field is required.';
        } else if ((task.type === 'textarea' || task.type === 'text') && task.minLength && val.length < task.minLength) {
          errors[task.id] = `Please write at least ${task.minLength} characters (${val.length} so far).`;
        }
      }
    } else {
      if (!formResponses['_photo']) errors['_photo'] = 'Please upload a photo.';
      const fbLen = (formResponses['_feedback'] ?? '').trim().length;
      if (fbLen < 20) errors['_feedback'] = `Please write at least 20 characters (${fbLen} so far).`;
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      let photoUrl = '';

      if (hasTasks) {
        const photoTask = feedbackForm!.tasks.find(t => t.type === 'photo');
        if (photoTask && formResponses[photoTask.id]) {
          setPhotoUploading(true);
          const blob = await (await fetch(formResponses[photoTask.id])).blob();
          const sRef = ref(storage, `submissions/${event.id}/${userId}/photo.jpg`);
          await uploadBytes(sRef, blob);
          photoUrl = await getDownloadURL(sRef);
          setPhotoUploading(false);
        }
        const textTasks  = feedbackForm!.tasks.filter(t => t.type !== 'photo');
        const feedbackText = textTasks
          .map(t => `[${t.title}]\n${(formResponses[t.id] ?? '').trim()}`)
          .join('\n\n');
        await submitEventWork(event.id, userId, photoUrl, feedbackText || '-');
      } else {
        if (formResponses['_photo']) {
          setPhotoUploading(true);
          const blob = await (await fetch(formResponses['_photo'])).blob();
          const sRef = ref(storage, `submissions/${event.id}/${userId}/photo.jpg`);
          await uploadBytes(sRef, blob);
          photoUrl = await getDownloadURL(sRef);
          setPhotoUploading(false);
        }
        await submitEventWork(event.id, userId, photoUrl, (formResponses['_feedback'] ?? '').trim());
      }

      setSubmitSuccess(true);
      setTimeout(onClose, 2200);
    } catch (e: any) {
      Alert.alert('Submission failed', e.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
      setPhotoUploading(false);
    }
  };

  if (!event) return null;

  const typeColor = EventTypeColors[event.type] ?? Colors.textMuted;
  const startDate = toDate(event.startAt);

  // ── Photo picker row ──────────────────────────────────────────────────────
  const renderPhotoPicker = (taskId: string, hasError: boolean) => (
    <>
      <TouchableOpacity
        style={[mStyles.photoPicker, hasError && mStyles.photoPickerError]}
        onPress={() => pickPhoto(taskId)} activeOpacity={0.8} disabled={submitting}
      >
        {formResponses[taskId]
          ? <Image source={{ uri: formResponses[taskId] }} style={mStyles.photoPreview} resizeMode="cover" />
          : <View style={mStyles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={28} color={Colors.textMuted} />
              <Text style={mStyles.photoPlaceholderText}>Tap to choose a photo</Text>
            </View>}
      </TouchableOpacity>
      {formResponses[taskId] ? (
        <TouchableOpacity onPress={() => setFormResponses(p => { const n = { ...p }; delete n[taskId]; return n; })}>
          <Text style={mStyles.removePhoto}>Remove photo</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={mStyles.container}>

        {/* ── Modal Header ── */}
        <View style={mStyles.header}>
          <View style={mStyles.headerRow}>
            <View style={[mStyles.headerEmoji, { backgroundColor: typeColor + '18' }]}>
              <Text style={{ fontSize: 22 }}>{ev.emoji ?? '📅'}</Text>
            </View>
            <View style={mStyles.headerInfo}>
              <Text style={mStyles.headerTitle} numberOfLines={1}>{event.title}</Text>
              <View style={mStyles.headerMetaRow}>
                <View style={[mStyles.headerTypeBadge, { backgroundColor: typeColor + '20' }]}>
                  <Text style={[mStyles.headerTypeBadgeText, { color: typeColor }]}>{event.type}</Text>
                </View>
                <Text style={mStyles.headerDate}>
                  {startDate.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={mStyles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} disabled={submitting}>
              <Ionicons name="close" size={18} color={Colors.textSub} />
            </TouchableOpacity>
          </View>
          {!submitSuccess && (
            <Text style={mStyles.headerSub}>
              {feedbackForm?.instructions ?? 'Complete all tasks below to earn your badge.'}
            </Text>
          )}
        </View>

        {/* ── Success State ── */}
        {submitSuccess ? (
          <View style={mStyles.successContainer}>
            <View style={mStyles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
            </View>
            <Text style={mStyles.successTitle}>Submitted! 🎉</Text>
            <Text style={mStyles.successSub}>
              The admin will review your work and award your badge. Check your Wallet soon!
            </Text>
          </View>
        ) : (
          /* ── Form Body ── */
          <ScrollView style={mStyles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {hasTasks ? (
              feedbackForm!.tasks.map(task => {
                const val = formResponses[task.id] ?? '';
                const err = formErrors[task.id];
                return (
                  <View key={task.id} style={mStyles.taskSection}>
                    <Text style={mStyles.taskLabel}>
                      {task.title}
                      {task.required ? <Text style={mStyles.taskRequired}> *</Text> : null}
                    </Text>
                    {task.description ? <Text style={mStyles.taskHint}>{task.description}</Text> : null}

                    {task.type === 'photo' && renderPhotoPicker(task.id, !!err)}

                    {(task.type === 'textarea' || task.type === 'text') && (
                      <>
                        <TextInput
                          style={[task.type === 'textarea' ? mStyles.textarea : mStyles.input, err && mStyles.inputError]}
                          value={val}
                          onChangeText={text => {
                            setFormResponses(p => ({ ...p, [task.id]: text }));
                            if (err) setFormErrors(p => { const n = { ...p }; delete n[task.id]; return n; });
                          }}
                          placeholder={task.type === 'textarea' ? 'Write your response here…' : 'Your answer…'}
                          placeholderTextColor={Colors.textMuted}
                          multiline={task.type === 'textarea'}
                          numberOfLines={task.type === 'textarea' ? 5 : 1}
                          textAlignVertical={task.type === 'textarea' ? 'top' : 'center'}
                          editable={!submitting}
                        />
                        {task.type === 'textarea' && task.minLength ? (
                          <Text style={mStyles.charCount}>
                            {val.trim().length} / min {task.minLength} chars
                          </Text>
                        ) : null}
                      </>
                    )}

                    {err ? <Text style={mStyles.errorText}>{err}</Text> : null}
                  </View>
                );
              })
            ) : (
              /* ── Legacy fallback form ── */
              <>
                <View style={mStyles.taskSection}>
                  <Text style={mStyles.taskLabel}>Event Photo <Text style={mStyles.taskRequired}>*</Text></Text>
                  <Text style={mStyles.taskHint}>Upload a photo from the event.</Text>
                  {renderPhotoPicker('_photo', !!formErrors['_photo'])}
                  {formErrors['_photo'] ? <Text style={mStyles.errorText}>{formErrors['_photo']}</Text> : null}
                </View>

                <View style={mStyles.taskSection}>
                  <Text style={mStyles.taskLabel}>What did you learn? <Text style={mStyles.taskRequired}>*</Text></Text>
                  <Text style={mStyles.taskHint}>Tell us what you built, learned, or discovered at this event.</Text>
                  <TextInput
                    style={[mStyles.textarea, formErrors['_feedback'] && mStyles.inputError]}
                    value={formResponses['_feedback'] ?? ''}
                    onChangeText={text => {
                      setFormResponses(p => ({ ...p, '_feedback': text }));
                      if (formErrors['_feedback']) setFormErrors(p => { const n = { ...p }; delete n['_feedback']; return n; });
                    }}
                    placeholder="Tell us what you built, learned, or discovered…"
                    placeholderTextColor={Colors.textMuted}
                    multiline numberOfLines={5} textAlignVertical="top"
                    editable={!submitting}
                  />
                  <Text style={mStyles.charCount}>
                    {(formResponses['_feedback'] ?? '').trim().length} / min 20 chars
                  </Text>
                  {formErrors['_feedback'] ? <Text style={mStyles.errorText}>{formErrors['_feedback']}</Text> : null}
                </View>
              </>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        {/* ── Footer ── */}
        {!submitSuccess && (
          <View style={mStyles.footer}>
            <TouchableOpacity
              style={[mStyles.submitBtn, submitting && mStyles.submitBtnDisabled]}
              onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}
            >
              {submitting
                ? <View style={mStyles.submitBtnRow}>
                    <ActivityIndicator color={Colors.bg} size="small" />
                    <Text style={mStyles.submitBtnText}>{photoUploading ? 'Uploading photo…' : 'Submitting…'}</Text>
                  </View>
                : <Text style={mStyles.submitBtnText}>Submit for Badge Review 🏆</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

type ActiveTab = 'future' | 'past' | 'submit';

export default function MyEventsScreen() {
  const router = useRouter();
  const user   = auth.currentUser;
  const { clearBadge } = useBadge();

  const [allEvents,    setAllEvents]    = useState<TalentEvent[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<ActiveTab>('future');
  const [submitEvent,  setSubmitEvent]  = useState<TalentEvent | null>(null);
  const submitPulse = useRef(new Animated.Value(1)).current;

  useFocusEffect(useCallback(() => { clearBadge(); }, []));

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const q = query(
      collection(db, 'events'),
      where('participants', 'array-contains', user.uid),
    );
    return onSnapshot(q, snap => {
      setAllEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as TalentEvent)));
      setLoading(false);
    }, () => setLoading(false));
  }, [user?.uid]);

  const getMyStatus = (event: TalentEvent) => {
    const p = (event.pendingParticipants ?? []).find((x: any) => x.uid === user?.uid);
    return (p as any)?.status ?? 'registered';
  };

  const ATTENDED = new Set(['checked_in', 'submitted', 'approved', 'rejected']);

  const futureEvents = useMemo(() =>
    allEvents
      .filter(e => !isEventPast(e) && !ATTENDED.has(getMyStatus(e)))
      .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime()),
    [allEvents, user?.uid]);

  const pastEvents = useMemo(() =>
    allEvents
      .filter(e => isEventPast(e) || ATTENDED.has(getMyStatus(e)))
      .sort((a, b) => toDate(b.startAt).getTime() - toDate(a.startAt).getTime()),
    [allEvents, user?.uid]);

  const submitEvents = useMemo(() =>
    allEvents.filter(e => {
      const p = (e.pendingParticipants ?? []).find((x: any) => x.uid === user?.uid);
      return (p as any)?.status === 'checked_in';
    }),
    [allEvents, user?.uid]);

  useEffect(() => {
    if (submitEvents.length > 0) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(submitPulse, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(submitPulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      submitPulse.setValue(1);
    }
  }, [submitEvents.length]);

  const TABS: { key: ActiveTab; label: string; count: number }[] = [
    { key: 'future', label: 'Upcoming',    count: futureEvents.length  },
    { key: 'past',   label: 'Past',        count: pastEvents.length    },
    { key: 'submit', label: 'Submit Work', count: submitEvents.length  },
  ];

  const displayList = activeTab === 'future' ? futureEvents
    : activeTab === 'past' ? pastEvents
    : submitEvents;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Events</Text>
      </View>

      {/* 3-tab underline row */}
      <View style={styles.tabRow}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const hasAlert = tab.key === 'submit' && tab.count > 0;
          return (
            <TouchableOpacity key={tab.key} style={styles.tabItem} onPress={() => setActiveTab(tab.key)}>
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  hasAlert ? (
                    <Animated.View style={[styles.tabBadge, { backgroundColor: Colors.xp, transform: [{ scale: submitPulse }] }]}>
                      <Text style={[styles.tabBadgeText, { color: Colors.bg }]}>{tab.count}</Text>
                    </Animated.View>
                  ) : (
                    <View style={[styles.tabBadge, { backgroundColor: Colors.textMuted + '30' }]}>
                      <Text style={[styles.tabBadgeText, { color: Colors.textMuted }]}>{tab.count}</Text>
                    </View>
                  )
                )}
              </View>
              {isActive && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.tabDivider} />

      {/* Submit Work hint banner */}
      {activeTab === 'submit' && submitEvents.length > 0 && (
        <View style={styles.submitBanner}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.xp} />
          <Text style={styles.submitBannerText}>
            Tap a card to open the submission form and earn your badge.
          </Text>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.listContent}>
          {[0, 1, 2, 3].map(i => (
            <MyEventSkeleton key={i} variant={activeTab === 'past' ? 'compact' : 'featured'} />
          ))}
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {(() => {
                const ringColor = activeTab === 'future' ? Colors.quest : activeTab === 'past' ? Colors.textMuted : Colors.xp;
                const emoji     = activeTab === 'future' ? '🎯' : activeTab === 'past' ? '📜' : '📤';
                return (
                  <View style={[styles.emptyIconOuter, { backgroundColor: ringColor + '10' }]}>
                    <View style={[styles.emptyIconInner, { backgroundColor: ringColor + '18' }]}>
                      <Text style={{ fontSize: 36 }}>{emoji}</Text>
                    </View>
                  </View>
                );
              })()}
              <Text style={styles.emptyTitle}>
                {activeTab === 'future' ? 'No upcoming events'
                  : activeTab === 'past' ? 'No past events yet'
                  : 'Nothing to submit'}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'future'
                  ? 'Register for events in the Events tab!'
                  : activeTab === 'past'
                  ? 'Your completed events will appear here.'
                  : 'Events you\'ve checked in to will appear here once they need a submission.'}
              </Text>
              {activeTab === 'future' && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/events')}>
                  <Text style={styles.emptyBtnText}>Browse Events</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const status = getMyStatus(item);
            if (activeTab === 'future') {
              return (
                <FutureEventCard
                  event={item}
                  myStatus={status}
                  onPress={() => router.push(`/event/${item.id}`)}
                  onShowQR={() => router.push(`/qr/${item.id}`)}
                />
              );
            }
            if (activeTab === 'past') {
              return (
                <PastEventCard
                  event={item}
                  myStatus={status}
                  onPress={() => router.push(`/event/${item.id}`)}
                  onViewSubmission={() => router.push(`/submission/${item.id}`)}
                />
              );
            }
            return <SubmitWorkCard event={item} onPress={() => setSubmitEvent(item)} />;
          }}
        />
      )}

      {/* Submission Modal */}
      {submitEvent && (
        <SubmissionModal event={submitEvent} userId={user?.uid ?? ''} onClose={() => setSubmitEvent(null)} />
      )}
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header:      { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  headerTitle: { color: Colors.text, fontSize: FontSize.h1, fontWeight: '800', letterSpacing: -0.5 },

  // Tabs
  tabRow:         { flexDirection: 'row', paddingHorizontal: 20, gap: 20 },
  tabItem:        { alignItems: 'flex-start', paddingBottom: 10 },
  tabLabelRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabLabel:       { color: Colors.textMuted, fontSize: FontSize.md, fontWeight: '600' },
  tabLabelActive: { color: Colors.text, fontWeight: '700' },
  tabUnderline:   { height: 2, backgroundColor: Colors.xp, borderRadius: 1, width: '100%', marginTop: 6 },
  tabDivider:     { height: 1, backgroundColor: Colors.border, marginBottom: 4 },
  tabBadge:       { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  tabBadgeText:   { fontSize: 10, fontWeight: '800' },

  // Submit banner
  submitBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8, marginTop: 4, backgroundColor: Colors.xp + '12', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.xp + '25', paddingHorizontal: 14, paddingVertical: 10 },
  submitBannerText: { color: Colors.xp, fontSize: FontSize.xs, flex: 1, lineHeight: 17, fontWeight: '600' },

  // List / Cards
  listContent: { paddingBottom: 30, paddingTop: 4 },

  // Featured card (upcoming events)
  featuredCard: {
    flexDirection: 'column',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 5,
  },
  featuredTopRow: { flexDirection: 'row' },
  featuredAccent: { width: 3 },
  featuredBody:   { flex: 1, flexDirection: 'row', padding: 14, gap: 12 },
  featuredThumbWrap: { position: 'relative' },
  featuredThumb:  { width: 100, height: 100, borderRadius: Radius.md },
  featuredEmojiBox: { width: 100, height: 100, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  featuredThumbFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, backgroundColor: 'rgba(0,0,0,0.45)', borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md },
  featuredInfo:   { flex: 1, gap: 5 },

  // Compact card (past events)
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13161f',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#1c2033',
    marginHorizontal: 16,
    marginVertical: 4,
    overflow: 'hidden',
    opacity: 0.85,
  },
  compactAccent: { width: 3, alignSelf: 'stretch' },
  compactInner:  { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, gap: 12 },

  cardLeft:   { flex: 1, gap: 5 },
  cardTime:   { color: Colors.quest, fontSize: FontSize.sm, fontWeight: '600' },
  cardTitle:  { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', lineHeight: 22 },
  cardMetaRow:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  typePill:   { borderRadius: Radius.xxl, paddingHorizontal: 8, paddingVertical: 3 },
  typeText:   { fontSize: FontSize.xs, fontWeight: '700' },

  statusPill:     { borderWidth: 1, borderRadius: Radius.xxl, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  qrHint:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  qrHintText:    { color: Colors.xp, fontSize: FontSize.xs, fontWeight: '600' },
  statusHint:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusHintText:{ fontSize: FontSize.xs, fontWeight: '600' },

  cardActionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1c2033', gap: 8 },
  qrBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.xp, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  qrBtnText:     { color: Colors.bg, fontSize: FontSize.xs, fontWeight: '800' },
  detailsBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.quest + '18', borderWidth: 1, borderColor: Colors.quest + '40', borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  detailsBtnText:{ color: Colors.quest, fontSize: FontSize.xs, fontWeight: '800' },

  pastTopRow: { flexDirection: 'row', overflow: 'hidden' },

  pastActionCol: {
    flexDirection: 'column',
    gap: 6,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pastActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  pastActionBtnText: { fontSize: 11, fontWeight: '700' },

  pastEmoji: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pastThumb: { width: 44, height: 44, borderRadius: Radius.sm, flexShrink: 0 },
  pastTitle: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  pastDate:  { color: Colors.textMuted, fontSize: 11 },

  // Submit Work card
  submitCard:       { marginHorizontal: 16, marginVertical: 8, backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.xp + '50', overflow: 'hidden' },
  submitCardBody:   { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  submitCardThumb:  { width: 72, height: 72, borderRadius: Radius.md },
  submitCardEmoji:  { width: 72, height: 72, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  submitCardInfo:   { flex: 1, gap: 4 },
  submitCardTitle:  { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', lineHeight: 21 },
  submitCardDate:   { color: Colors.textMuted, fontSize: FontSize.xs },
  submitCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.xp + '20', backgroundColor: Colors.xp + '06' },
  taskCountPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.xp + '15', borderRadius: Radius.xxl, paddingHorizontal: 10, paddingVertical: 5 },
  taskCountText:    { color: Colors.xp, fontSize: FontSize.xs, fontWeight: '700' },
  submitWorkBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.xp, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8 },
  submitWorkBtnText:{ color: Colors.bg, fontWeight: '800', fontSize: FontSize.sm },

  // ACTION NEEDED badge on SubmitWorkCard
  actionNeededBadge: { backgroundColor: Colors.xp, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  actionNeededText:  { color: Colors.bg, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // Empty state
  emptyState:    { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 40 },
  emptyIconOuter:{ width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  emptyIconInner:{ width: 70,  height: 70,  borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:    { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  emptyText:     { color: Colors.textSub, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  emptyBtn:      { marginTop: 4, backgroundColor: Colors.quest + '18', borderWidth: 1, borderColor: Colors.quest + '40', borderRadius: Radius.xl, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText:  { color: Colors.quest, fontWeight: '800', fontSize: FontSize.sm },
});

// ─── SUBMISSION MODAL STYLES ──────────────────────────────────────────────────

const mStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header:       { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 10 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerEmoji:  { width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerInfo:   { flex: 1, gap: 4 },
  headerTitle:  { color: Colors.text, fontSize: FontSize.lg, fontWeight: '800' },
  headerMetaRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTypeBadge:    { borderRadius: Radius.xxl, paddingHorizontal: 8, paddingVertical: 3 },
  headerTypeBadgeText:{ fontSize: FontSize.xs, fontWeight: '700' },
  headerDate:   { color: Colors.textMuted, fontSize: FontSize.xs },
  headerSub:    { color: Colors.textSub, fontSize: FontSize.sm, lineHeight: 20 },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },

  taskSection: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border + '60' },
  taskLabel:   { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700', marginBottom: 4 },
  taskRequired:{ color: Colors.streak },
  taskHint:    { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18, marginBottom: 10 },
  taskCharCount: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 4, textAlign: 'right' },

  input:   { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text, fontSize: FontSize.sm, marginTop: 4 },
  textarea:{ backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, color: Colors.text, fontSize: FontSize.sm, minHeight: 110, lineHeight: 22, marginTop: 4, textAlignVertical: 'top' },
  inputError:{ borderColor: Colors.streak },

  photoPicker:      { borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: Radius.xl, overflow: 'hidden', height: 150, marginTop: 4 },
  photoPickerError: { borderColor: Colors.streak },
  photoPreview:     { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoPlaceholderText: { color: Colors.textMuted, fontSize: FontSize.sm },
  removePhoto:      { color: Colors.streak, fontSize: FontSize.xs, textAlign: 'center', marginTop: 6 },

  errorText: { color: Colors.streak, fontSize: FontSize.xs, marginTop: 6 },
  charCount: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 4, textAlign: 'right' },

  footer:          { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  submitBtn:       { backgroundColor: Colors.xp, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled:{ opacity: 0.45 },
  submitBtnRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnText:   { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },

  successContainer:{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  successIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.success + '18', alignItems: 'center', justifyContent: 'center' },
  successTitle:    { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800', textAlign: 'center' },
  successSub:      { color: Colors.textSub, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
});
