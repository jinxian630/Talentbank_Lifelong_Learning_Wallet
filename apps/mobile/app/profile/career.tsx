import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Share,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';
import { auth, db } from '../../lib/firebase';
import {
  saveUserProfile,
  getUserBadges,
  getUserExamRegistrations,
} from '@talentbank/firebase-config';
import { LEVEL_NAMES } from '@talentbank/shared';
import type { UserProfile, Badge } from '@talentbank/shared';
import { SKILL_TEMPLATES } from '../../lib/skill-templates';
import { Colors, Radius, FontSize } from '../../constants/theme';

const PROFILE_BASE_URL = process.env.EXPO_PUBLIC_PROFILE_BASE_URL ?? '';

// ── Background themes ─────────────────────────────────────────────────────────
// gradient: true → show split-swatch on mobile; CSS linear-gradient on web
// previewBg / gradientEnd → the two stops used for the mobile split preview

const BACKGROUND_THEMES = [
  // Solid
  { key: 'cream',    label: 'Cream',    gradient: false, previewBg: '#F7F4EE', gradientEnd: '#F7F4EE', dark: false },
  { key: 'white',    label: 'White',    gradient: false, previewBg: '#ffffff', gradientEnd: '#ffffff', dark: false },
  { key: 'slate',    label: 'Slate',    gradient: false, previewBg: '#1e293b', gradientEnd: '#1e293b', dark: true  },
  { key: 'charcoal', label: 'Charcoal', gradient: false, previewBg: '#18181b', gradientEnd: '#18181b', dark: true  },
  // Gradient
  { key: 'sunset',   label: 'Sunset',   gradient: true,  previewBg: '#f6d365', gradientEnd: '#fda085', dark: false },
  { key: 'rose',     label: 'Rose',     gradient: true,  previewBg: '#f9a8d4', gradientEnd: '#f06292', dark: false },
  { key: 'ocean',    label: 'Ocean',    gradient: true,  previewBg: '#667eea', gradientEnd: '#764ba2', dark: true  },
  { key: 'aurora',   label: 'Aurora',   gradient: true,  previewBg: '#a8edea', gradientEnd: '#fed6e3', dark: false },
  { key: 'midnight', label: 'Midnight', gradient: true,  previewBg: '#2c3e50', gradientEnd: '#3498db', dark: true  },
  { key: 'forest',   label: 'Forest',   gradient: true,  previewBg: '#d4fc79', gradientEnd: '#96e6a1', dark: false },
  { key: 'peach',    label: 'Peach',    gradient: true,  previewBg: '#ffecd2', gradientEnd: '#fcb69f', dark: false },
  { key: 'cosmic',   label: 'Cosmic',   gradient: true,  previewBg: '#6b2d8b', gradientEnd: '#e040fb', dark: true  },
  { key: 'neon',     label: 'Neon',     gradient: true,  previewBg: '#0d0d0d', gradientEnd: '#00d4aa', dark: true  },
  { key: 'candy',    label: 'Candy',    gradient: true,  previewBg: '#f953c6', gradientEnd: '#b91d73', dark: true  },
] as const;

const FIELD_LABEL_TEMPLATES = [
  'GitHub', 'LinkedIn', 'Portfolio', 'Twitter', 'Website',
  'YouTube', 'Email', 'Behance', 'Dribbble', 'Notion',
];

// ── Helpers ───────────────────────────────────────────────────────────────────


function calcCompletion(
  profile: UserProfile | null,
  badges: Badge[],
  hasEnrollment: boolean,
): number {
  if (!profile) return 0;
  const checks = [
    !!profile.photoURL,
    (profile.skills?.length ?? 0) > 0,
    (profile.interests?.length ?? 0) > 0,
    badges.length > 0,
    hasEnrollment,
    !!(profile.profileBackground && profile.profileBackground.value !== 'cream'),
    (profile.customFields?.length ?? 0) > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ── Tag chip ─────────────────────────────────────────────────────────────────

function Tag({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="close" size={12} color={Colors.textSub} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Add skill / interest drawer ───────────────────────────────────────────────

interface AddDrawerProps {
  visible: boolean;
  title: string;
  showTemplates: boolean;
  existing: string[];
  onAdd: (value: string) => void;
  onClose: () => void;
}

function AddDrawer({ visible, title, showTemplates, existing, onAdd, onClose }: AddDrawerProps) {
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || existing.includes(trimmed)) { setText(''); return; }
    onAdd(trimmed);
    setText('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.drawer}>
          <View style={styles.drawerHandle} />
          <Text style={styles.drawerTitle}>{title}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Type and press Add…"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <TouchableOpacity style={styles.addBtn} onPress={submit}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {showTemplates && (
            <>
              <Text style={styles.drawerSubLabel}>QUICK ADD</Text>
              <View style={styles.templateGrid}>
                {SKILL_TEMPLATES.map((t) => {
                  const picked = existing.includes(t);
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.templateChip, picked && styles.templateChipPicked]}
                      onPress={() => { if (!picked) { onAdd(t); } }}
                      disabled={picked}
                    >
                      <Text style={[styles.templateChipText, picked && styles.templateChipTextPicked]}>
                        {picked ? '✓ ' : ''}{t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Add custom field drawer ───────────────────────────────────────────────────

interface AddFieldDrawerProps {
  visible: boolean;
  onAdd: (label: string, value: string, fieldType: 'link' | 'description') => void;
  onClose: () => void;
}

function AddFieldDrawer({ visible, onAdd, onClose }: AddFieldDrawerProps) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [fieldType, setFieldType] = useState<'link' | 'description'>('link');

  const reset = () => { setLabel(''); setValue(''); setFieldType('link'); };

  const submit = () => {
    const l = label.trim();
    const v = value.trim();
    if (!l || !v) return;
    onAdd(l, v, fieldType);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => { reset(); onClose(); }}>
        <TouchableOpacity activeOpacity={1} style={styles.drawer}>
          <View style={styles.drawerHandle} />
          <Text style={styles.drawerTitle}>Add a Field</Text>

          {/* Type toggle */}
          <View style={styles.typeToggleRow}>
            <TouchableOpacity
              style={[styles.typeToggleBtn, fieldType === 'link' && styles.typeToggleBtnActive]}
              onPress={() => setFieldType('link')}
            >
              <Ionicons name="link-outline" size={14} color={fieldType === 'link' ? '#fff' : Colors.textSub} />
              <Text style={[styles.typeToggleBtnText, fieldType === 'link' && styles.typeToggleBtnTextActive]}>Link / URL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeToggleBtn, fieldType === 'description' && styles.typeToggleBtnActive]}
              onPress={() => setFieldType('description')}
            >
              <Ionicons name="document-text-outline" size={14} color={fieldType === 'description' ? '#fff' : Colors.textSub} />
              <Text style={[styles.typeToggleBtnText, fieldType === 'description' && styles.typeToggleBtnTextActive]}>Description</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.drawerSubLabel}>LABEL</Text>
          <View style={styles.templateGrid}>
            {FIELD_LABEL_TEMPLATES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.templateChip, label === t && styles.templateChipPicked]}
                onPress={() => setLabel(t)}
              >
                <Text style={[styles.templateChipText, label === t && styles.templateChipTextPicked]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.inputRow, { marginTop: 10 }]}>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="or type a custom label…"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <Text style={[styles.drawerSubLabel, { marginTop: 14 }]}>
            {fieldType === 'link' ? 'URL' : 'DESCRIPTION'}
          </Text>
          {fieldType === 'link' ? (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder="https://github.com/you"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={submit}
              />
            </View>
          ) : (
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={value}
              onChangeText={setValue}
              placeholder="Write a description, bio, or any text…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          )}

          <TouchableOpacity style={[styles.addBtn, { marginTop: 16, paddingVertical: 13, borderRadius: Radius.md }]} onPress={submit}>
            <Text style={[styles.addBtnText, { textAlign: 'center' }]}>Save Field</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.closeBtn, { marginTop: 10 }]} onPress={() => { reset(); onClose(); }}>
            <Text style={styles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  step, title, complete, children,
}: {
  step: number; title: string; complete: boolean; children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.stepBadge, complete && styles.stepBadgeDone]}>
          {complete
            ? <Ionicons name="checkmark" size={13} color="#fff" />
            : <Text style={styles.stepNum}>{step}</Text>}
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CareerScreen() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [skillDrawer, setSkillDrawer] = useState(false);
  const [interestDrawer, setInterestDrawer] = useState(false);
  const [fieldDrawer, setFieldDrawer] = useState(false);
  // Optimistic local state — updates instantly on tap, clears once Firestore round-trips back
  const [localBgKey, setLocalBgKey] = useState<string | null>(null);

  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { setLoading(false); return; }
      setUid(user.uid);
      return onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) setProfile(snap.data() as UserProfile);
        setLoading(false);
      });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    getUserBadges(uid).then((b) => setBadges(b as Badge[]));
    getUserExamRegistrations(uid).then((e) => setEnrollments(e));
  }, [uid]);

  // Once Firestore confirms the background change, drop the optimistic override
  useEffect(() => {
    if (profile?.profileBackground?.value) setLocalBgKey(null);
  }, [profile?.profileBackground?.value]);

  const pct = calcCompletion(profile, badges, enrollments.length > 0);

  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct]);

  const barWidth = barAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  // ── mutations ────────────────────────────────────────────────────────────────

  const save = async (data: Partial<UserProfile>) => {
    if (!uid) return;
    setSaving(true);
    try { await saveUserProfile(uid, data); } finally { setSaving(false); }
  };

  const removeSkill = (s: string) =>
    save({ skills: (profile?.skills ?? []).filter((x) => x !== s) });
  const addSkill = (s: string) =>
    save({ skills: [...(profile?.skills ?? []).filter((x) => x !== s), s] });

  const removeInterest = (i: string) =>
    save({ interests: (profile?.interests ?? []).filter((x) => x !== i) });
  const addInterest = (i: string) =>
    save({ interests: [...(profile?.interests ?? []).filter((x) => x !== i), i] });

  const setBackground = (key: string) => {
    const theme = BACKGROUND_THEMES.find((t) => t.key === key);
    const type = theme?.gradient ? 'gradient' : 'static';
    setLocalBgKey(key); // instant visual feedback — no waiting for Firestore
    save({ profileBackground: { type, value: key } });
  };

  const addCustomField = (label: string, value: string, fieldType: 'link' | 'description') =>
    save({
      customFields: [
        ...(profile?.customFields ?? []),
        { id: String(Date.now()), label, value, fieldType },
      ],
    });

  const removeCustomField = (id: string) =>
    save({ customFields: (profile?.customFields ?? []).filter((f) => f.id !== id) });

  // ── share ────────────────────────────────────────────────────────────────────

  const profileUrl = uid ? `${PROFILE_BASE_URL}/student/${uid}` : '';

  const handleShare = async () => {
    if (!profileUrl) return;
    try { await Share.share({ message: `View my career profile: ${profileUrl}`, url: profileUrl }); } catch {}
  };

  const handleCopyLink = async () => {
    if (!profileUrl) return;
    await Clipboard.setStringAsync(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.xp} />
      </View>
    );
  }

  const skills       = profile?.skills ?? [];
  const interests    = profile?.interests ?? [];
  const customFields = profile?.customFields ?? [];

  // localBgKey wins over Firestore value — gives instant feedback on tap
  const activeBgKey  = localBgKey ?? profile?.profileBackground?.value ?? 'cream';
  const activeTheme  = BACKGROUND_THEMES.find((t) => t.key === activeBgKey) ?? BACKGROUND_THEMES[0];
  const currentBg    = profile?.profileBackground;

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: activeTheme.previewBg }]} contentContainerStyle={styles.content}>

        {/* ── Completion bar ── */}
        <View style={styles.completionCard}>
          <View style={styles.completionRow}>
            <Text style={styles.completionLabel}>Profile Completion</Text>
            <Text style={styles.completionPct}>{pct}%</Text>
            {saving && <ActivityIndicator size="small" color={Colors.accent} style={{ marginLeft: 6 }} />}
          </View>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, { width: barWidth }]} />
          </View>
          <Text style={styles.completionSub}>
            {pct === 100 ? 'Perfect! Your profile is fully complete 🎉' : 'Complete all sections to stand out to managers.'}
          </Text>
        </View>

        {/* ── Step 1: Avatar ── */}
        <Section step={1} title="Profile Photo" complete={!!profile?.photoURL}>
          <View style={styles.avatarRow}>
            {profile?.photoURL
              ? <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
              : <View style={[styles.avatar, styles.avatarPlaceholder]} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.guideText}>A clear profile photo makes a strong first impression.</Text>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => router.back()} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={15} color={Colors.accent} />
                <Text style={styles.outlineBtnText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* ── Step 2: Skills ── */}
        <Section step={2} title="Skills" complete={skills.length > 0}>
          <Text style={styles.guideText}>List technical and soft skills you've built. Managers filter by these.</Text>
          <View style={styles.tagWrap}>
            {skills.map((s) => <Tag key={s} label={s} onRemove={() => removeSkill(s)} />)}
            <TouchableOpacity style={styles.addTagBtn} onPress={() => setSkillDrawer(true)}>
              <Ionicons name="add" size={14} color={Colors.accent} />
              <Text style={styles.addTagBtnText}>Add Skill</Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* ── Step 3: Interests ── */}
        <Section step={3} title="Interests" complete={interests.length > 0}>
          <Text style={styles.guideText}>Share what domains and topics excite you — Blockchain, AI, Design, etc.</Text>
          <View style={styles.tagWrap}>
            {interests.map((i) => <Tag key={i} label={i} onRemove={() => removeInterest(i)} />)}
            <TouchableOpacity style={styles.addTagBtn} onPress={() => setInterestDrawer(true)}>
              <Ionicons name="add" size={14} color={Colors.accent} />
              <Text style={styles.addTagBtnText}>Add Interest</Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* ── Step 4: Badges ── */}
        <Section step={4} title="Badges" complete={badges.length > 0}>
          {badges.length > 0 ? (
            <View style={styles.badgeGrid}>
              {badges.map((b) => (
                <View key={b.id} style={[styles.badgeCard, { backgroundColor: b.color + '30', shadowColor: b.color }]}>
                  <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                  <Text style={styles.badgeTitle} numberOfLines={2}>{b.eventTitle}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🏅</Text>
              <Text style={styles.emptyText}>No badges yet.</Text>
              <Text style={styles.guideText}>Attend events and submit your work to earn badges from organisers.</Text>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/(tabs)/events' as any)} activeOpacity={0.8}>
                <Text style={styles.outlineBtnText}>Browse Events →</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* ── Step 5: Certifications ── */}
        <Section step={5} title="Certifications" complete={enrollments.length > 0}>
          {enrollments.length > 0 ? (
            <View style={{ gap: 8 }}>
              {enrollments.map((e: any) => (
                <View key={e.id} style={styles.enrollRow}>
                  <Ionicons name="ribbon-outline" size={18} color={Colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.enrollTitle}>{e.examTitle ?? 'Certification'}</Text>
                    <Text style={styles.enrollStatus}>{e.status ?? 'registered'}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📜</Text>
              <Text style={styles.emptyText}>No certifications yet.</Text>
              <Text style={styles.guideText}>Register for certification exams using your XP to earn recognised credentials.</Text>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/wallet/cert-market' as any)} activeOpacity={0.8}>
                <Text style={styles.outlineBtnText}>Browse Certs →</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* ── Step 6: Background Design ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.stepBadge, activeBgKey !== 'cream' && styles.stepBadgeDone]}>
              {activeBgKey !== 'cream'
                ? <Ionicons name="checkmark" size={13} color="#fff" />
                : <Text style={styles.stepNum}>6</Text>}
            </View>
            <Text style={styles.sectionTitle}>Profile Background</Text>
          </View>

          <Text style={styles.guideText}>
            Tap a swatch to preview. Gradient themes fill the full page on the web.
          </Text>

          <View style={styles.swatchRow}>
            {BACKGROUND_THEMES.map((t) => {
              const selected = activeBgKey === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.swatch, selected && styles.swatchSelected]}
                  onPress={() => setBackground(t.key)}
                >
                  {/* Split-colour preview for gradients, solid for plain */}
                  <View style={[styles.swatchInner, { overflow: 'hidden' }]}>
                    <View style={{ flex: 1, backgroundColor: t.previewBg }} />
                    {t.gradient && (
                      <View style={{ flex: 1, backgroundColor: t.gradientEnd }} />
                    )}
                  </View>
                  {selected && (
                    <View style={styles.swatchCheckOverlay}>
                      <Ionicons name="checkmark" size={12} color={t.dark ? '#fff' : '#3A332C'} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Step 7: Custom Fields ── */}
        <Section step={7} title="Links & Info" complete={customFields.length > 0}>
          <Text style={styles.guideText}>
            Add links to your GitHub, LinkedIn, portfolio, or any other info you want managers to see.
          </Text>

          {customFields.map((f) => (
            <View key={f.id} style={styles.fieldRow}>
              <View style={styles.fieldLabelPill}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
              </View>
              <Text style={styles.fieldValue} numberOfLines={1}>{f.value}</Text>
              <TouchableOpacity onPress={() => removeCustomField(f.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={[styles.addTagBtn, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={() => setFieldDrawer(true)}>
            <Ionicons name="add" size={14} color={Colors.accent} />
            <Text style={styles.addTagBtnText}>Add Field</Text>
          </TouchableOpacity>
        </Section>

        {/* ── Share profile ── */}
        <View style={styles.shareCard}>
          <View style={styles.shareHeader}>
            <Ionicons name="share-social-outline" size={20} color={Colors.accent} />
            <Text style={styles.shareTitle}>Share Your Profile</Text>
          </View>
          <Text style={styles.guideText}>
            Send this link to managers or recruiters — they can view your full career profile in a browser.
          </Text>
          {profileUrl ? (
            <>
              <TouchableOpacity style={styles.urlChip} onPress={handleCopyLink} activeOpacity={0.75}>
                <Text style={styles.urlText} numberOfLines={1}>{profileUrl}</Text>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={copied ? Colors.success : Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
                <Ionicons name="share-outline" size={17} color="#fff" />
                <Text style={styles.shareBtnText}>Share Link</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.guideText}>Set EXPO_PUBLIC_PROFILE_BASE_URL in your .env to enable sharing.</Text>
          )}
        </View>

      </ScrollView>

      {/* ── Drawers ── */}
      <AddDrawer visible={skillDrawer} title="Add a Skill" showTemplates existing={skills} onAdd={addSkill} onClose={() => setSkillDrawer(false)} />
      <AddDrawer visible={interestDrawer} title="Add an Interest" showTemplates={false} existing={interests} onAdd={addInterest} onClose={() => setInterestDrawer(false)} />
      <AddFieldDrawer visible={fieldDrawer} onAdd={addCustomField} onClose={() => setFieldDrawer(false)} />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: Colors.bg },
  content:                { padding: 20, gap: 16, paddingBottom: 60 },
  center:                 { flex: 1, justifyContent: 'center', alignItems: 'center' },

  completionCard:         { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 18, borderWidth: 1, borderColor: Colors.border },
  completionRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  completionLabel:        { flex: 1, color: Colors.text, fontWeight: '700', fontSize: FontSize.sm },
  completionPct:          { color: Colors.accent, fontWeight: '700', fontSize: FontSize.lg },
  barTrack:               { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  barFill:                { height: '100%', backgroundColor: Colors.accent, borderRadius: 4 },
  completionSub:          { color: Colors.textMuted, fontSize: FontSize.xs },

  section:                { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 18, borderWidth: 1, borderColor: Colors.border },
  sectionHeader:          { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepBadge:              { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.borderAlt, alignItems: 'center', justifyContent: 'center' },
  stepBadgeDone:          { backgroundColor: Colors.success },
  stepNum:                { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '700' },
  sectionTitle:           { color: Colors.text, fontWeight: '700', fontSize: FontSize.md },

  avatarRow:              { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatar:                 { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder:      { backgroundColor: Colors.borderAlt },

  tagWrap:                { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag:                    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accent + '15', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.accent + '30' },
  tagText:                { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '600' },
  addTagBtn:              { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: Colors.accent, borderStyle: 'dashed' },
  addTagBtnText:          { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '700' },

  guideText:              { color: Colors.textSub, fontSize: FontSize.xs, lineHeight: 18, marginBottom: 8 },
  outlineBtn:             { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.accent, marginTop: 4 },
  outlineBtnText:         { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '700' },

  badgeGrid:              { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  badgeCard:              { width: 80, alignItems: 'center', gap: 4, padding: 10, borderRadius: Radius.lg, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  badgeEmoji:             { fontSize: 28 },
  badgeTitle:             { color: Colors.textSub, fontSize: 9, fontWeight: '600', textAlign: 'center' },

  enrollRow:              { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border },
  enrollTitle:            { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  enrollStatus:           { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2, textTransform: 'capitalize' },

  emptyState:             { alignItems: 'center', paddingVertical: 12, gap: 4 },
  emptyEmoji:             { fontSize: 36, marginBottom: 4 },
  emptyText:              { color: Colors.textSub, fontWeight: '600', fontSize: FontSize.sm },

  // Background picker
  swatchLabel:            { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  swatchRow:              { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch:                 { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: Colors.border, overflow: 'hidden', position: 'relative' },
  swatchInner:            { flex: 1, flexDirection: 'row' },
  swatchSelected:         { borderColor: Colors.accent, borderWidth: 3 },
  swatchCheckOverlay:     { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },

  // Custom fields
  fieldRow:               { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  fieldLabelPill:         { backgroundColor: Colors.accent + '20', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  fieldLabel:             { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '700' },
  fieldValue:             { flex: 1, color: Colors.textSub, fontSize: FontSize.xs },

  // Share card
  shareCard:              { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 18, borderWidth: 1, borderColor: Colors.accent + '30' },
  shareHeader:            { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  shareTitle:             { color: Colors.text, fontWeight: '700', fontSize: FontSize.md },
  urlChip:                { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  urlText:                { flex: 1, color: Colors.textSub, fontSize: FontSize.xs, fontFamily: 'monospace' },
  shareBtn:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: 13 },
  shareBtnText:           { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },

  // Drawer
  backdrop:               { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  drawer:                 { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: 24, paddingBottom: 48, maxHeight: '85%' },
  drawerHandle:           { width: 40, height: 4, backgroundColor: Colors.borderAlt, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  drawerTitle:            { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: 14 },
  drawerSubLabel:         { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  inputRow:               { flexDirection: 'row', gap: 10 },
  input:                  { flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10, color: Colors.text, fontSize: FontSize.sm, borderWidth: 1, borderColor: Colors.border },
  addBtn:                 { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText:             { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  templateGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inputMultiline:         { height: 100, paddingTop: 10 },
  typeToggleRow:          { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeToggleBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surfaceAlt },
  typeToggleBtnActive:    { borderColor: Colors.accent, backgroundColor: Colors.accent },
  typeToggleBtnText:      { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '700' },
  typeToggleBtnTextActive:{ color: '#fff' },
  templateChip:           { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.borderAlt, backgroundColor: Colors.surfaceAlt },
  templateChipPicked:     { borderColor: Colors.accent, backgroundColor: Colors.accent + '15' },
  templateChipText:       { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '600' },
  templateChipTextPicked: { color: Colors.accent },
  closeBtn:               { marginTop: 20, paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderAlt, alignItems: 'center' },
  closeBtnText:           { color: Colors.textSub, fontWeight: '600' },
});
