import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Modal,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { clearSession } from '../../lib/zk-login-store';
import { auth, db } from '../../lib/firebase';
import { useXPProfile, useRecentBadges } from '../../lib/use-xp-profile';
import type { UserProfile, Friendship } from '@talentbank/shared';
import { LEVEL_NAMES } from '@talentbank/shared';
import { listenToFriends, listenToFriendRequests } from '@talentbank/firebase-config';
import { Colors, Radius, FontSize } from '../../constants/theme';
import AvatarPickerModal from '../../components/AvatarPickerModal';

const { width: SCREEN_W } = Dimensions.get('window');
const EXPLORER_BASE = 'https://suiscan.xyz/testnet/account/';

// ─── INLINE CONSTANTS ─────────────────────────────────────────────────────────



// ─── XP BAR ───────────────────────────────────────────────────────────────────

function XPBar({ xp, xpToNext, nextLevel }: { xp: number; xpToNext: number; nextLevel: number }) {
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
      <Text style={styles.xpSub}>to Level {nextLevel}</Text>
    </View>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const { xp, level, xpToNext, displayName, loading: xpLoading } = useXPProfile();
  const recentBadges = useRecentBadges(4);

  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  // Friends / social state
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friendship[]>([]);


  // Profile from Firestore
  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeDoc?.();
      if (!user) {
        setLoading(false);
        return;
      }
      unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
        setLoading(false);
      });
    });
    return () => {
      unsubscribeAuth();
      unsubscribeDoc?.();
    };
  }, []);

  // Friends listeners
  useEffect(() => {
    if (!profile?.uid) return;
    const unsub1 = listenToFriends(profile.uid, (data: Friendship[]) => setFriends(data));
    const unsub2 = listenToFriendRequests(profile.uid, (data: Friendship[]) => setFriendRequests(data));
    return () => { unsub1(); unsub2(); };
  }, [profile?.uid]);

  const handleSignOut = async () => {
    await clearSession();
    await signOut(auth);
    router.replace('/');
  };

  const copyAddress = async () => {
    if (!profile?.suiAddress) return;
    await Clipboard.setStringAsync(profile.suiAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openExplorer = () => {
    if (!profile?.suiAddress) return;
    Linking.openURL(EXPLORER_BASE + profile.suiAddress);
  };

  if (loading || xpLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.xp} />
      </View>
    );
  }

  const levelName = LEVEL_NAMES[level] ?? 'Explorer';
  const addr = profile?.suiAddress;
  const shortAddr = addr ? `${addr.slice(0, 10)}...${addr.slice(-8)}` : null;
  const getFriendDisplayName = (f: Friendship) =>
    f.requestedBy === profile?.uid
      ? (f.accepterName ?? 'Friend')
      : f.requesterName;
  const getFriendPhoto = (f: Friendship) =>
    f.requestedBy === profile?.uid ? f.accepterPhoto : f.requesterPhoto;
  const getFriendId = (f: Friendship) =>
    f.users.find((u) => u !== profile?.uid) ?? '';

  return (
    <>
      <AvatarPickerModal
        visible={avatarPickerVisible}
        onClose={() => setAvatarPickerVisible(false)}
        uid={profile?.uid ?? ''}
        onAvatarUpdated={(url) =>
          setProfile((prev) => prev ? { ...prev, photoURL: url } : prev)
        }
      />

      {/* QR Code Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setQrModalVisible(false)}
        >
          <View style={styles.qrModalSheet}>
            <View style={styles.qrModalHandle} />
            <Text style={styles.qrModalTitle}>Your Friend QR Code</Text>
            <Text style={styles.qrModalSub}>Let friends scan this to add you</Text>
            {profile?.uid && (
              <View style={styles.qrWrap}>
                <QRCode value={profile.uid} size={200} />
              </View>
            )}
            <Text style={styles.qrUid} numberOfLines={1}>
              {profile?.uid ? `${profile.uid.slice(0, 20)}...` : ''}
            </Text>
            <TouchableOpacity
              style={styles.qrCloseBtn}
              onPress={() => setQrModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.qrCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Avatar + identity ── */}
      <TouchableOpacity
        onPress={() => setAvatarPickerVisible(true)}
        activeOpacity={0.85}
        style={styles.avatarWrap}
      >
        {profile?.photoURL ? (
          <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]} />
        )}
        <View style={styles.avatarEditBadge}>
          <Ionicons name="camera" size={12} color="#fff" />
        </View>
      </TouchableOpacity>
      <Text style={styles.name}>{profile?.name}</Text>
      <Text style={styles.email}>{profile?.email}</Text>

      {/* ── XP / Level progress ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <View style={styles.xpCard}>
          <View style={styles.levelRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Lv.{level}</Text>
            </View>
            <Text style={styles.levelName}>{levelName} — {displayName || profile?.name}</Text>
          </View>
          <XPBar xp={xp} xpToNext={xpToNext} nextLevel={level + 1} />
        </View>
      </View>

      {/* ── Career Profile entry ── */}
      <TouchableOpacity
        style={styles.careerBtn}
        onPress={() => router.push('/profile/career' as any)}
        activeOpacity={0.85}
      >
        <Ionicons name="briefcase-outline" size={18} color={Colors.accent} />
        <Text style={styles.careerBtnText}>Career Profile</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* ── Interests ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interests</Text>
        <View style={styles.tags}>
          {(profile?.interests ?? []).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Skills ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Skills</Text>
        <View style={styles.tags}>
          {(profile?.skills ?? []).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {(profile?.skills ?? []).length === 0 && (
            <Text style={styles.emptyText}>No skills added yet.</Text>
          )}
        </View>
      </View>

      {/* ── Friends ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Friends</Text>

        {/* Action buttons */}
        <View style={styles.friendBtnRow}>
          <TouchableOpacity
            style={styles.friendBtnOutline}
            onPress={() => setQrModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code" size={16} color={Colors.accent} />
            <Text style={styles.friendBtnOutlineText}>My QR Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.friendBtnFilled}
            onPress={() => router.push('/scan-friend-qr' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.friendBtnFilledText}>Add Friend</Text>
          </TouchableOpacity>
        </View>

        {/* Pending requests banner → opens in-page modal */}
        {friendRequests.length > 0 && (
          <TouchableOpacity
            style={styles.requestsBanner}
            onPress={() => router.push('/(tabs)/messages')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={16} color={Colors.accent} />
            <Text style={styles.requestsBannerText}>
              {friendRequests.length} pending friend {friendRequests.length === 1 ? 'request' : 'requests'} — tap to review
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
          </TouchableOpacity>
        )}

        {/* Friends horizontal scroll */}
        {friends.length === 0 ? (
          <Text style={styles.emptyText}>Add friends by scanning their QR code</Text>
        ) : (
          <>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={friends}
              keyExtractor={(f) => f.id}
              contentContainerStyle={styles.friendsScroll}
              renderItem={({ item }) => {
                const photo = getFriendPhoto(item);
                const name = getFriendDisplayName(item);
                const fid = getFriendId(item);
                return (
                  <TouchableOpacity
                    style={styles.friendAvatarCard}
                    onPress={() => router.push(`/chat/${fid}` as any)}
                    activeOpacity={0.8}
                  >
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.friendAvatarImg} />
                    ) : (
                      <View style={[styles.friendAvatarImg, styles.friendAvatarPlaceholder]}>
                        <Text style={styles.friendAvatarInitial}>
                          {name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.friendAvatarName} numberOfLines={1}>{name}</Text>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity onPress={() => router.push('/friends' as any)}>
              <Text style={styles.seeAllLink}>See All Friends →</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Sui Wallet ── */}
      <View style={styles.section}>
        <View style={styles.walletHeaderRow}>
          <Text style={styles.sectionTitle}>Sui Wallet</Text>
          {addr && (
            <View style={styles.networkBadge}>
              <Text style={styles.networkBadgeText}>Testnet</Text>
            </View>
          )}
        </View>

        <View style={styles.walletCard}>
          <View style={styles.walletTopRow}>
            <Text style={styles.walletSymbol}>◎</Text>
            <View style={styles.walletInfo}>
              {shortAddr ? (
                <>
                  <Text style={styles.walletAddress}>{shortAddr}</Text>
                  <Text style={styles.walletSubLabel}>ZK Login · Auto-generated</Text>
                </>
              ) : (
                <Text style={styles.walletEmptyText}>
                  Wallet will be ready after your next sign-in
                </Text>
              )}
            </View>
          </View>

          {shortAddr && (
            <View style={styles.walletActionsRow}>
              <TouchableOpacity style={styles.walletActionBtn} onPress={copyAddress} activeOpacity={0.7}>
                <Text style={styles.walletActionText}>{copied ? '✓ Copied!' : '⎘  Copy Address'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.walletActionBtn} onPress={openExplorer} activeOpacity={0.7}>
                <Text style={styles.walletActionText}>↗  View on Explorer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* ── Recent Badges ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Badges</Text>
        {recentBadges.length === 0 ? (
          <Text style={styles.emptyText}>No badges earned yet.</Text>
        ) : (
          <View style={styles.badgeGrid}>
            {recentBadges.map((badge) => (
              <View key={badge.id} style={styles.badgeCard}>
                <View style={[styles.badgeIcon, {
                  backgroundColor: badge.color,
                  shadowColor: badge.color,
                }]}>
                  <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                </View>
                <Text style={styles.badgeSkill} numberOfLines={1}>{badge.eventTitle}</Text>
                <View style={styles.levelPill}>
                  <Text style={styles.levelPillText}>+{badge.xpValue ?? 200} XP</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.bg },
  content:            { padding: 24, alignItems: 'center' },
  center:             { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  avatarWrap:         { position: 'relative', marginBottom: 12 },
  avatar:             { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder:  { backgroundColor: Colors.borderAlt },
  avatarEditBadge:    { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.bg },
  name:               { color: Colors.text, fontSize: 20, fontWeight: 'bold' },
  email:              { color: Colors.textSub, fontSize: 14, marginBottom: 24 },
  section:            { width: '100%', marginBottom: 24 },
  sectionTitle:       { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  tags:               { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.borderAlt },
  tagText:            { color: Colors.textSub, fontSize: FontSize.sm },
  emptyText:          { color: Colors.textMuted, fontSize: 14 },
  careerBtn:          { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, borderWidth: 1, borderColor: Colors.accent + '40' },
  careerBtnText:      { flex: 1, color: Colors.accent, fontSize: FontSize.md, fontWeight: '700' },
  signOutButton:      { marginTop: 16, width: '100%', padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center' },
  signOutText:        { color: '#ef4444', fontWeight: '600' },

  // XP card
  xpCard:             { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, borderWidth: 1, borderColor: Colors.border, marginTop: 8 },
  levelRow:           { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  levelBadge:         { backgroundColor: Colors.xp + '20', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText:     { color: Colors.xp, fontSize: FontSize.xs, fontWeight: '700' },
  levelName:          { color: Colors.text, fontSize: FontSize.md, fontWeight: '600', flexShrink: 1 },

  // XPBar
  xpBarWrap:          { marginBottom: 4 },
  xpBarRow:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xpLabel:            { color: Colors.textSub, fontSize: FontSize.xs },
  xpBarTrack:         { height: 10, backgroundColor: Colors.border, borderRadius: 5, overflow: 'hidden' },
  xpBarFill:          { height: '100%', backgroundColor: Colors.xp, borderRadius: 5 },
  xpSub:              { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 4 },

  // Recommendations

  // Sui Wallet card
  walletHeaderRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  networkBadge:       { backgroundColor: '#E8923C20', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#E8923C40' },
  networkBadgeText:   { color: '#E8923C', fontSize: FontSize.xs, fontWeight: '600' },
  walletCard:         { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 16, borderWidth: 1, borderColor: Colors.border },
  walletTopRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletSymbol:       { fontSize: 28, color: '#E8923C' },
  walletInfo:         { flex: 1 },
  walletAddress:      { color: Colors.text, fontSize: FontSize.md, fontWeight: '600', fontFamily: 'monospace' },
  walletSubLabel:     { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 3 },
  walletEmptyText:    { color: Colors.textMuted, fontSize: FontSize.sm },
  walletActionsRow:   { flexDirection: 'row', gap: 10, marginTop: 14 },
  walletActionBtn:    { flex: 1, paddingVertical: 9, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderAlt, alignItems: 'center' },
  walletActionText:   { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '600' },

  // QR Modal
  modalBackdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  qrModalSheet:       { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: 24, paddingBottom: 40, alignItems: 'center' },
  qrModalHandle:      { width: 40, height: 4, backgroundColor: Colors.borderAlt, borderRadius: 2, marginBottom: 20 },
  qrModalTitle:       { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: 6 },
  qrModalSub:         { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: 24 },
  qrWrap:             { padding: 16, backgroundColor: '#fff', borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  qrUid:              { color: Colors.textMuted, fontSize: 11, fontFamily: 'monospace', marginBottom: 24 },
  qrCloseBtn:         { width: '100%', paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderAlt, alignItems: 'center' },
  qrCloseBtnText:     { color: Colors.textSub, fontWeight: '600' },

  // Friend request modal
  reqCounter:         { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center', marginBottom: 4 },
  reqModalTitle:      { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  reqUserRow:         { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.xl, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  reqAvatar:          { width: 56, height: 56, borderRadius: 28 },
  reqAvatarPlaceholder:{ backgroundColor: Colors.accent + '20', alignItems: 'center', justifyContent: 'center' },
  reqAvatarInitial:   { color: Colors.accent, fontSize: FontSize.lg, fontWeight: '700' },
  reqName:            { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  reqSub:             { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 3 },
  reqBtnRow:          { flexDirection: 'row', gap: 12 },
  reqDeclineBtn:      { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.borderAlt },
  reqDeclineBtnText:  { color: Colors.textSub, fontWeight: '700', fontSize: FontSize.sm },
  reqAcceptBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: Radius.md, backgroundColor: Colors.accent },
  reqAcceptBtnText:   { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },

  // Friends section
  friendBtnRow:       { flexDirection: 'row', gap: 10, marginBottom: 16 },
  friendBtnOutline:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.accent },
  friendBtnOutlineText:{ color: Colors.accent, fontSize: FontSize.sm, fontWeight: '700' },
  friendBtnFilled:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: Radius.md, backgroundColor: Colors.accent },
  friendBtnFilledText:{ color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
  requestsBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.accent + '15', borderRadius: Radius.lg, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.accent + '30' },
  requestsBannerText: { flex: 1, color: Colors.accent, fontSize: FontSize.sm, fontWeight: '600' },
  friendsScroll:      { gap: 12, paddingVertical: 4, marginBottom: 10 },
  friendAvatarCard:   { alignItems: 'center', gap: 6, width: 64 },
  friendAvatarImg:    { width: 52, height: 52, borderRadius: 26 },
  friendAvatarPlaceholder:{ backgroundColor: Colors.accent + '20', alignItems: 'center', justifyContent: 'center' },
  friendAvatarInitial:{ color: Colors.accent, fontSize: FontSize.md, fontWeight: '700' },
  friendAvatarName:   { color: Colors.textSub, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  seeAllLink:         { color: Colors.accent, fontSize: FontSize.sm, fontWeight: '600', marginTop: 4 },

  // Badge grid
  badgeGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  badgeCard:          { width: (SCREEN_W - 48 - 36) / 4, alignItems: 'center', gap: 6 },
  badgeIcon:          { width: 54, height: 54, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 8 },
  badgeEmoji:         { fontSize: 26 },
  badgeSkill:         { color: Colors.textSub, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  levelPill:          { backgroundColor: Colors.xp + '20', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  levelPillText:      { color: Colors.xp, fontSize: 9, fontWeight: '700' },
});
