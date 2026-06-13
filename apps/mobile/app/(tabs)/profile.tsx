import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { clearSession } from '../../lib/zk-login-store';
import { auth, db } from '../../lib/firebase';
import { useXPProfile, useRecentBadges } from '../../lib/use-xp-profile';
import type { UserProfile } from '@talentbank/shared';
import { LEVEL_NAMES } from '@talentbank/shared';
import { Colors, Radius, FontSize, FontFamily } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const EXPLORER_BASE = 'https://suiscan.xyz/testnet/account/';

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
  const shortAddr = addr
    ? `${addr.slice(0, 10)}...${addr.slice(-8)}`
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar + identity */}
      {profile?.photoURL ? (
        <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder} />
      )}
      <Text style={styles.name}>{profile?.name}</Text>
      <Text style={styles.email}>{profile?.email}</Text>

      {/* XP / Level progress */}
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

      {/* Interests */}
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

      {/* Skills */}
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

      {/* Sui Wallet */}
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

      {/* Recent Badges */}
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
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.bg },
  content:            { padding: 24, alignItems: 'center' },
  center:             { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  avatar:             { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarPlaceholder:  { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.borderAlt, marginBottom: 12 },
  name:               { color: Colors.text, fontSize: 20, fontWeight: 'bold' },
  email:              { color: Colors.textSub, fontSize: 14, marginBottom: 24 },
  section:            { width: '100%', marginBottom: 24 },
  sectionTitle:       { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  tags:               { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.borderAlt },
  tagText:            { color: Colors.textSub, fontSize: FontSize.sm },
  emptyText:          { color: Colors.textMuted, fontSize: 14 },
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

  // Badge grid
  badgeGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  badgeCard:          { width: (SCREEN_W - 48 - 36) / 4, alignItems: 'center', gap: 6 },
  badgeIcon:          { width: 54, height: 54, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 8 },
  badgeEmoji:         { fontSize: 26 },
  badgeSkill:         { color: Colors.textSub, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  levelPill:          { backgroundColor: Colors.xp + '20', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  levelPillText:      { color: Colors.xp, fontSize: 9, fontWeight: '700' },
});
