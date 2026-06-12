import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '@mysten/sui/transactions';
import { collection, doc, query, setDoc, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { XP_REWARDS, computeLevel } from '@talentbank/shared';
import type { Badge } from '@talentbank/shared';
import { auth, db } from '../../lib/firebase';
import { updateBadgeOnChain } from '@talentbank/firebase-config';
import { signAndExecuteWithZkLogin } from '../../lib/zk-login-signer';
import { getSession } from '../../lib/zk-login-store';
import { useXPProfile } from '../../lib/use-xp-profile';
import { Colors, Radius, FontSize } from '../../constants/theme';

const PACKAGE_ID  = process.env.EXPO_PUBLIC_SUI_PACKAGE_ID  ?? '';
const REGISTRY_ID = process.env.EXPO_PUBLIC_SUI_REGISTRY_ID ?? '';

function formatDate(awardedAt: Badge['awardedAt']): string {
  try {
    const d = typeof (awardedAt as any)?.toDate === 'function'
      ? (awardedAt as any).toDate()
      : new Date(awardedAt as any);
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
}

interface BadgeCardProps {
  badge: Badge;
  isClaiming: boolean;
  onClaim: () => void;
  suiAddress: string;
}

function BadgeCard({ badge, isClaiming, onClaim, suiAddress }: BadgeCardProps) {
  const xpValue = badge.xpValue ?? XP_REWARDS.approve;

  const openOnSuiScan = () => {
    const url = suiAddress
      ? `https://suiscan.xyz/testnet/account/${suiAddress}`
      : `https://suiscan.xyz/testnet/object/${badge.onChain?.objectId}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.badgeCard}>
      <View style={[styles.badgeIcon, {
        backgroundColor: badge.color,
        shadowColor: badge.color,
      }]}>
        <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
      </View>
      <Text style={styles.badgeSkill} numberOfLines={1}>{badge.eventTitle}</Text>
      <Text style={styles.badgeDate}>{formatDate(badge.awardedAt)}</Text>
      <View style={styles.xpPill}>
        <Text style={styles.xpPillText}>+{xpValue} XP</Text>
      </View>

      {badge.onChain?.txHash ? (
        // Claimed — show SuiScan link
        <>
          <View style={styles.txRow}>
            <Text style={styles.txHash}>
              {(badge.onChain.objectId ?? badge.onChain.txHash).slice(0, 8)}
              …
              {(badge.onChain.objectId ?? badge.onChain.txHash).slice(-6)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.chainBtn, styles.chainBtnActive]}
            onPress={openOnSuiScan}
            activeOpacity={0.7}
          >
            <Ionicons name="wallet-outline" size={11} color={Colors.accent} />
            <Text style={[styles.chainBtnText, { color: Colors.accent }]}>View Asset</Text>
          </TouchableOpacity>
        </>
      ) : badge.onChain?.voucherObjectId ? (
        // Voucher issued — claim directly on mobile
        <>
          <View style={styles.txRow}>
            <Text style={[styles.txHash, { color: Colors.xp }]}>Voucher ready</Text>
          </View>
          <TouchableOpacity
            style={[styles.chainBtn, styles.chainBtnClaim, isClaiming && styles.chainBtnDisabled]}
            onPress={onClaim}
            disabled={isClaiming}
            activeOpacity={0.7}
          >
            {isClaiming ? (
              <ActivityIndicator size="small" color={Colors.xp} />
            ) : (
              <Ionicons name="trophy-outline" size={11} color={Colors.xp} />
            )}
            <Text style={[styles.chainBtnText, { color: Colors.xp }]}>
              {isClaiming ? 'Claiming…' : 'Claim Badge'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        // No voucher yet
        <>
          <View style={styles.txRow}>
            <Text style={styles.txHash}>— — —</Text>
          </View>
          <TouchableOpacity style={styles.chainBtn} disabled activeOpacity={1}>
            <Ionicons name="open-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.chainBtnText}>Not minted yet</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export default function BadgesListScreen() {
  const { uid, xp: userXp, loading: profileLoading } = useXPProfile();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [suiAddress, setSuiAddress] = useState<string>('');

  useEffect(() => {
    getSession().then((s) => { if (s) setSuiAddress(s.suiAddress); });
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { setBadges([]); setBadgesLoading(false); return; }
      const q = query(collection(db, 'badges'), where('userId', '==', user.uid));
      const unsubBadges = onSnapshot(q, (snap) => {
        setBadges(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Badge)));
        setBadgesLoading(false);
      });
      return unsubBadges;
    });
    return () => unsubAuth();
  }, []);

  // Backfill XP from badges for accounts predating the XP system
  useEffect(() => {
    if (profileLoading || badgesLoading || !uid || badges.length === 0) return;
    const expectedMinXP = badges.reduce((sum, b) => sum + (b.xpValue ?? XP_REWARDS.approve), 0);
    if (userXp < expectedMinXP) {
      const newXp = expectedMinXP;
      setDoc(doc(db, 'users', uid), { xp: newXp, level: computeLevel(newXp) }, { merge: true });
    }
  }, [profileLoading, badgesLoading, uid, badges.length, userXp]);

  const handleClaim = async (badge: Badge) => {
    if (!badge.onChain?.voucherObjectId) return;
    setClaimingId(badge.id);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::badge::claim_badge`,
        arguments: [
          tx.object(badge.onChain.voucherObjectId),
          tx.object(REGISTRY_ID),
          tx.object('0x6'), // Sui Clock
        ],
      });

      const { digest, objectChanges } = await signAndExecuteWithZkLogin(tx);

      const created = objectChanges.find(
        (c: any) => c.type === 'created' && c.objectType?.includes('::badge::Badge'),
      );
      const objectId: string = created?.objectId ?? '';
      await updateBadgeOnChain(badge.id, digest, objectId);
    } catch (err: any) {
      Alert.alert('Claim failed', err?.message ?? 'Transaction failed. Please try again.');
    } finally {
      setClaimingId(null);
    }
  };

  if (profileLoading || badgesLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {badges.length} Badge{badges.length !== 1 ? 's' : ''} Earned
        </Text>

        {badges.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyOwl}>🦉😴</Text>
            <Text style={styles.emptyTitle}>No badges yet!</Text>
            <Text style={styles.emptyText}>
              Your wallet is emptier than my motivation on Mondays 😭{'\n'}
              Go complete some quests, warrior.
            </Text>
          </View>
        ) : (
          <View style={styles.badgeGrid}>
            {badges.map(badge => (
              <BadgeCard
                key={badge.id}
                badge={badge}
                isClaiming={claimingId === badge.id}
                onClaim={() => handleClaim(badge)}
                suiAddress={suiAddress}
              />
            ))}
          </View>
        )}
      </View>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  section:      { paddingHorizontal: 20, paddingTop: 16, marginBottom: 20 },
  sectionTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: 12 },
  badgeGrid: { gap: 14 },
  badgeCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, alignItems: 'center',
  },
  badgeIcon: {
    width: 72, height: 72, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 10,
  },
  badgeEmoji:  { fontSize: 34 },
  badgeSkill:  { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', marginBottom: 2 },
  badgeDate:   { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 8 },
  xpPill: {
    backgroundColor: Colors.xp + '20', borderRadius: Radius.xxl,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  xpPillText: { color: Colors.xp, fontSize: FontSize.sm, fontWeight: '700' },
  txRow:   { marginBottom: 8 },
  txHash:  { color: Colors.textMuted, fontSize: 11, fontFamily: 'monospace' },
  chainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5,
  },
  chainBtnText:     { color: Colors.textMuted, fontSize: FontSize.xs },
  chainBtnActive:   { borderColor: Colors.accent + '40' },
  chainBtnClaim:    { borderColor: Colors.xp + '40' },
  chainBtnDisabled: { opacity: 0.5 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyOwl:   { fontSize: 52, marginBottom: 12 },
  emptyTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginBottom: 8 },
  emptyText:  { color: Colors.textSub, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
});
