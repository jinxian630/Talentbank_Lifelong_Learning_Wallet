import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  listenToFriends,
  listenToFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  getUserProfileByUid,
} from '@talentbank/firebase-config';
import type { Friendship, UserProfile } from '@talentbank/shared';
import { Colors, Radius, FontSize } from '../constants/theme';

export default function FriendsScreen() {
  const router = useRouter();
  const [myUid, setMyUid] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setMyUid(user.uid);
      const profile = await getUserProfileByUid(user.uid);
      setMyProfile(profile);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!myUid) return;
    const unsub1 = listenToFriends(
      myUid,
      (data: Friendship[]) => { setFriends(data); setLoading(false); },
      () => setLoading(false),
    );
    const unsub2 = listenToFriendRequests(
      myUid,
      (data: Friendship[]) => setRequests(data),
    );
    return () => { unsub1(); unsub2(); };
  }, [myUid]);

  const handleAccept = async (friendship: Friendship) => {
    if (!myUid || !myProfile) return;
    const otherId = friendship.users.find(u => u !== myUid)!;
    setActionLoading(friendship.id);
    try {
      const otherProfile = await getUserProfileByUid(otherId);
      await acceptFriendRequest(myUid, otherId, {
        name: myProfile.name,
        photoURL: myProfile.photoURL,
      }, {
        name: otherProfile?.name ?? friendship.requesterName,
        photoURL: otherProfile?.photoURL ?? friendship.requesterPhoto,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (friendship: Friendship) => {
    if (!myUid) return;
    const otherId = friendship.users.find(u => u !== myUid)!;
    setActionLoading(friendship.id);
    try {
      await declineFriendRequest(myUid, otherId);
    } finally {
      setActionLoading(null);
    }
  };

  const getFriendId = (friendship: Friendship) =>
    friendship.users.find(u => u !== myUid) ?? '';

  const getFriendName = (f: Friendship) =>
    f.requestedBy === myUid
      ? (f.accepterName ?? 'Friend')
      : f.requesterName;

  const getFriendPhoto = (f: Friendship) =>
    f.requestedBy === myUid ? f.accepterPhoto : f.requesterPhoto;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.xp} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={[]}
        ListHeaderComponent={() => (
          <>
            {/* Pending Requests */}
            {requests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  FRIEND REQUESTS ({requests.length})
                </Text>
                {requests.map((req) => (
                  <View key={req.id} style={styles.requestCard}>
                    {req.requesterPhoto ? (
                      <Image source={{ uri: req.requesterPhoto }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{req.requesterName}</Text>
                      <Text style={styles.mutedText}>Wants to be your friend</Text>
                    </View>
                    <View style={styles.actionBtns}>
                      {actionLoading === req.id ? (
                        <ActivityIndicator color={Colors.accent} size="small" />
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => handleAccept(req)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.acceptBtnText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.declineBtn}
                            onPress={() => handleDecline(req)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.declineBtnText}>Decline</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Friends List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>FRIENDS ({friends.length})</Text>
              {friends.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No friends yet</Text>
                  <Text style={styles.emptySubText}>
                    Scan a friend's QR code from your profile to add them
                  </Text>
                </View>
              ) : (
                friends.map((f) => {
                  const fid = getFriendId(f);
                  const friendName = getFriendName(f);
                  const friendPhoto = getFriendPhoto(f);
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={styles.friendRow}
                      onPress={() => router.push(`/chat/${fid}` as any)}
                      activeOpacity={0.7}
                    >
                      {friendPhoto ? (
                        <Image source={{ uri: friendPhoto }} style={styles.avatarSm} />
                      ) : (
                        <View style={[styles.avatarSm, styles.avatarPlaceholder]} />
                      )}
                      <Text style={styles.friendName}>{friendName}</Text>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}
        renderItem={null}
        keyExtractor={() => ''}
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.bg },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  content:          { padding: 20 },
  section:          { marginBottom: 24 },
  sectionTitle:     { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },

  requestCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  avatar:           { width: 48, height: 48, borderRadius: 24 },
  avatarSm:         { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder:{ backgroundColor: Colors.borderAlt },
  name:             { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  mutedText:        { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  actionBtns:       { flexDirection: 'row', gap: 8 },
  acceptBtn:        { backgroundColor: Colors.accent, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 7 },
  acceptBtnText:    { color: '#fff', fontSize: FontSize.xs, fontWeight: '700' },
  declineBtn:       { borderWidth: 1, borderColor: Colors.borderAlt, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 7 },
  declineBtnText:   { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '600' },

  friendRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  friendName:       { flex: 1, color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },

  emptyWrap:        { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText:        { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  emptySubText:     { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
});
