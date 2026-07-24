import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  getUserProfileByUid,
  getUserProfileByEmail,
  sendFriendRequest,
} from '@talentbank/firebase-config';
import type { UserProfile } from '@talentbank/shared';
import { Colors, Radius, FontSize } from '../constants/theme';

type Tab = 'qr' | 'email';

export default function AddFriendScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('qr');

  // Auth
  const [myUid, setMyUid] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);

  // QR state
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  // Email state
  const [emailInput, setEmailInput] = useState('');

  // Shared result state
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setMyUid(user.uid);
      const profile = await getUserProfileByUid(user.uid);
      setMyProfile(profile);
    });
    return () => unsub();
  }, []);

  const resetResult = () => {
    setFoundUser(null);
    setRequestSent(false);
    setError(null);
    setScanned(false);
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    resetResult();
  };

  // ─── QR ────────────────────────────────────────────────────────────────────
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    setError(null);
    try {
      let uid = data.trim();
      try { const p = JSON.parse(uid); if (p?.uid) uid = p.uid; } catch {}
      if (!uid || uid === myUid) {
        setError(uid === myUid ? "That's your own QR code!" : 'Invalid QR code.');
        return;
      }
      const user = await getUserProfileByUid(uid);
      if (!user) { setError('User not found.'); return; }
      setFoundUser(user);
    } catch {
      setError('Failed to look up user.');
    } finally {
      setLoading(false);
    }
  };

  // ─── EMAIL ─────────────────────────────────────────────────────────────────
  const handleEmailSearch = async () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError(null);
    setFoundUser(null);
    try {
      const user = await getUserProfileByEmail(email);
      if (!user) { setError('No user found with that email.'); return; }
      if (user.uid === myUid) { setError("That's your own account!"); return; }
      setFoundUser(user);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── SHARED ────────────────────────────────────────────────────────────────
  const handleSendRequest = async () => {
    if (!myUid || !myProfile || !foundUser) return;
    setLoading(true);
    try {
      await sendFriendRequest(myUid, foundUser.uid, {
        name: myProfile.name,
        photoURL: myProfile.photoURL,
      });
      setRequestSent(true);
    } catch {
      setError('Failed to send request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── RESULT PANEL (shared between both tabs) ───────────────────────────────
  const ResultPanel = () => {
    if (loading) {
      return (
        <View style={styles.resultRow}>
          <ActivityIndicator color={Colors.xp} />
          <Text style={styles.loadingText}>Looking up user…</Text>
        </View>
      );
    }
    if (requestSent) {
      return (
        <View style={styles.successWrap}>
          <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
          <Text style={styles.successText}>Friend request sent!</Text>
          <TouchableOpacity onPress={resetResult}>
            <Text style={styles.linkText}>{tab === 'qr' ? 'Scan Another' : 'Search Another'}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={resetResult}>
            <Text style={styles.linkText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (foundUser) {
      return (
        <View>
          <View style={styles.foundUserRow}>
            {foundUser.photoURL ? (
              <Image source={{ uri: foundUser.photoURL }} style={styles.foundAvatar} />
            ) : (
              <View style={[styles.foundAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {foundUser.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.foundName}>{foundUser.name}</Text>
              <Text style={styles.foundEmail}>{foundUser.email}</Text>
              {(foundUser.interests?.length ?? 0) > 0 && (
                <Text style={styles.foundInterests} numberOfLines={1}>
                  {foundUser.interests!.slice(0, 3).join(' · ')}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={handleSendRequest} activeOpacity={0.8}>
            <Ionicons name="person-add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Send Friend Request</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={resetResult} style={styles.cancelWrap}>
            <Text style={styles.linkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  // ─── NO CAMERA PERMISSION ──────────────────────────────────────────────────
  if (tab === 'qr' && hasPermission === false) {
    return (
      <SafeAreaView style={styles.bgContainer}>
        <TouchableOpacity style={styles.topBack} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
          <Text style={styles.topBackText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.tabRow}>
          <TabPills tab={tab} onChange={handleTabChange} />
        </View>
        <View style={styles.noPermWrap}>
          <Ionicons name="camera-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.noPermTitle}>Camera Access Needed</Text>
          <Text style={styles.noPermText}>
            Allow TalentBank to access your camera to scan QR codes, or switch to Email search.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── EMAIL TAB ─────────────────────────────────────────────────────────────
  if (tab === 'email') {
    return (
      <SafeAreaView style={styles.bgContainer}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.emailScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity style={styles.topBack} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
              <Text style={styles.topBackText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.pageTitle}>Add Friend</Text>

            <View style={styles.tabRow}>
              <TabPills tab={tab} onChange={handleTabChange} />
            </View>

            <View style={styles.emailCard}>
              <Text style={styles.emailLabel}>Friend's Email</Text>
              <View style={styles.emailInputRow}>
                <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.emailInput}
                  value={emailInput}
                  onChangeText={(t) => { setEmailInput(t); setError(null); setFoundUser(null); }}
                  placeholder="Enter email address"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={handleEmailSearch}
                />
                {emailInput.length > 0 && (
                  <TouchableOpacity onPress={() => { setEmailInput(''); resetResult(); }} style={{ paddingHorizontal: 12 }}>
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.searchBtn, !emailInput.trim() && styles.searchBtnDisabled]}
                onPress={handleEmailSearch}
                disabled={!emailInput.trim() || loading}
                activeOpacity={0.8}
              >
                <Ionicons name="search" size={16} color={!emailInput.trim() ? Colors.textMuted : '#fff'} />
                <Text style={[styles.searchBtnText, !emailInput.trim() && styles.searchBtnTextDisabled]}>
                  Search
                </Text>
              </TouchableOpacity>
            </View>

            <ResultPanel />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─── QR TAB ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.cameraContainer}>
      {hasPermission && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
      )}

      {/* Overlay */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.cutout}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Header */}
      <SafeAreaView style={styles.cameraHeader}>
        <TouchableOpacity style={styles.cameraBack} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
          <Text style={styles.cameraBackText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Title over camera */}
      <View style={styles.cameraTitleWrap} pointerEvents="none">
        <Text style={styles.cameraTitle}>Add Friend</Text>
        <Text style={styles.cameraSubtitle}>Point camera at a friend's profile QR code</Text>
      </View>

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        {/* Tab pills inside bottom sheet */}
        <View style={styles.tabRow}>
          <TabPills tab={tab} onChange={handleTabChange} dark={false} />
        </View>

        <ResultPanel />

        {!loading && !foundUser && !requestSent && !error && (
          <Text style={styles.hintText}>Point camera at a friend's QR code</Text>
        )}
      </View>
    </View>
  );
}

function TabPills({ tab, onChange, dark = false }: { tab: Tab; onChange: (t: Tab) => void; dark?: boolean }) {
  return (
    <View style={[tabStyles.row, dark && tabStyles.rowDark]}>
      <TouchableOpacity
        style={[tabStyles.pill, tab === 'qr' && tabStyles.pillActive]}
        onPress={() => onChange('qr')}
        activeOpacity={0.7}
      >
        <Ionicons name="qr-code-outline" size={14} color={tab === 'qr' ? '#fff' : Colors.textSub} />
        <Text style={[tabStyles.pillText, tab === 'qr' && tabStyles.pillTextActive]}>
          Scan QR
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[tabStyles.pill, tab === 'email' && tabStyles.pillActive]}
        onPress={() => onChange('email')}
        activeOpacity={0.7}
      >
        <Ionicons name="mail-outline" size={14} color={tab === 'email' ? '#fff' : Colors.textSub} />
        <Text style={[tabStyles.pillText, tab === 'email' && tabStyles.pillTextActive]}>
          Email
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  row:            { flexDirection: 'row', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.xl, padding: 3, gap: 2 },
  rowDark:        { backgroundColor: 'rgba(255,255,255,0.15)' },
  pill:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: Radius.lg },
  pillActive:     { backgroundColor: Colors.accent },
  pillText:       { color: Colors.textSub, fontSize: FontSize.sm, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
});

const CUTOUT = 240;
const CORNER = 24;
const CORNER_BORDER = 3;

const styles = StyleSheet.create({
  // ── Email / No-perm screens ──
  bgContainer:      { flex: 1, backgroundColor: Colors.bg },
  topBack:          { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  topBackText:      { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  pageTitle:        { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700', paddingHorizontal: 20, marginTop: 8, marginBottom: 20 },
  tabRow:           { paddingHorizontal: 20, marginBottom: 20 },
  emailScrollContent:{ paddingBottom: 40 },

  emailCard:        { marginHorizontal: 20, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  emailLabel:       { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },
  emailInputRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  emailInput:       { flex: 1, paddingHorizontal: 10, paddingVertical: 13, color: Colors.text, fontSize: FontSize.md },
  searchBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: 13 },
  searchBtnDisabled:{ backgroundColor: Colors.border },
  searchBtnText:    { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  searchBtnTextDisabled:{ color: Colors.textMuted },

  noPermWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  noPermTitle:      { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  noPermText:       { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },

  // ── QR camera screen ──
  cameraContainer:  { flex: 1, backgroundColor: '#000' },
  overlay:          { ...StyleSheet.absoluteFillObject },
  overlayTop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddle:    { flexDirection: 'row', height: CUTOUT },
  overlaySide:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom:    { flex: 1.5, backgroundColor: 'rgba(0,0,0,0.6)' },
  cutout:           { width: CUTOUT, height: CUTOUT },
  corner:           { position: 'absolute', width: CORNER, height: CORNER, borderColor: Colors.accent },
  cornerTL:         { top: 0, left: 0, borderTopWidth: CORNER_BORDER, borderLeftWidth: CORNER_BORDER },
  cornerTR:         { top: 0, right: 0, borderTopWidth: CORNER_BORDER, borderRightWidth: CORNER_BORDER },
  cornerBL:         { bottom: 0, left: 0, borderBottomWidth: CORNER_BORDER, borderLeftWidth: CORNER_BORDER },
  cornerBR:         { bottom: 0, right: 0, borderBottomWidth: CORNER_BORDER, borderRightWidth: CORNER_BORDER },
  cameraHeader:     { position: 'absolute', top: 0, left: 0, right: 0 },
  cameraBack:       { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 16 },
  cameraBackText:   { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  cameraTitleWrap:  { position: 'absolute', top: '18%', left: 0, right: 0, alignItems: 'center' },
  cameraTitle:      { color: '#fff', fontSize: FontSize.xl, fontWeight: '700' },
  cameraSubtitle:   { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.sm, marginTop: 4 },

  bottomSheet:      {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.bg,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: 20,
    minHeight: 180,
    ...(Platform.OS === 'ios' ? { paddingBottom: 40 } : {}),
  },
  hintText:         { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: 8 },

  // ── Shared result states ──
  resultRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 8 },
  loadingText:      { color: Colors.textSub, fontSize: FontSize.sm },
  successWrap:      { alignItems: 'center', gap: 10, paddingVertical: 8 },
  successText:      { color: Colors.success, fontSize: FontSize.md, fontWeight: '700' },
  errorWrap:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#fef2f2', borderRadius: Radius.lg, padding: 12, marginBottom: 12 },
  errorText:        { flex: 1, color: '#ef4444', fontSize: FontSize.sm, lineHeight: 18 },
  linkText:         { color: Colors.accent, fontSize: FontSize.sm, fontWeight: '600', textAlign: 'center', marginTop: 4 },

  foundUserRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  foundAvatar:      { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder:{ backgroundColor: Colors.accent + '20', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:    { color: Colors.accent, fontSize: FontSize.lg, fontWeight: '700' },
  foundName:        { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  foundEmail:       { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  foundInterests:   { color: Colors.textSub, fontSize: FontSize.xs, marginTop: 4 },

  addBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: 14, marginBottom: 4 },
  addBtnText:       { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  cancelWrap:       { alignItems: 'center', marginTop: 10 },
});
