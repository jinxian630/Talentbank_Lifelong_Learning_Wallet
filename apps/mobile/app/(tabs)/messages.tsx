import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import {
  listenToChats,
  listenToFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  getUserProfileByUid,
} from '@talentbank/firebase-config';
import type { ChatRoom, Friendship, UserProfile } from '@talentbank/shared';
import { Colors, Radius, FontSize } from '../../constants/theme';

function timeAgo(ts: any): string {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function MessagesScreen() {
  const router = useRouter();

  const [myUid, setMyUid] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestActionLoading, setRequestActionLoading] = useState<string | null>(null);

  // Auth + own profile fetch
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setMyUid(null); setLoading(false); return; }
      setMyUid(user.uid);
      const profile = await getUserProfileByUid(user.uid);
      setMyProfile(profile);
    });
    return () => unsub();
  }, []);

  // Chat list listener
  useEffect(() => {
    if (!myUid) return;
    const unsub = listenToChats(myUid, (data: ChatRoom[]) => {
      setChats(data);
      setLoading(false);
    });
    return () => unsub();
  }, [myUid]);

  // Friend requests listener
  useEffect(() => {
    if (!myUid) return;
    const unsub = listenToFriendRequests(myUid, (data: Friendship[]) => {
      setFriendRequests(data);
    });
    return () => unsub();
  }, [myUid]);

  const handleAccept = async (req: Friendship) => {
    if (!myUid || !myProfile) return;
    const otherId = req.users.find(u => u !== myUid)!;
    setRequestActionLoading(req.id);
    try {
      const otherProfile = await getUserProfileByUid(otherId);
      await acceptFriendRequest(
        myUid, otherId,
        { name: myProfile.name, photoURL: myProfile.photoURL },
        {
          name: otherProfile?.name ?? req.requesterName,
          photoURL: otherProfile?.photoURL ?? req.requesterPhoto,
        },
      );
      // listenToChats fires automatically — new chat appears in list
    } finally {
      setRequestActionLoading(null);
    }
  };

  const handleDecline = async (req: Friendship) => {
    if (!myUid) return;
    const otherId = req.users.find(u => u !== myUid)!;
    setRequestActionLoading(req.id);
    try {
      await declineFriendRequest(myUid, otherId);
    } finally {
      setRequestActionLoading(null);
    }
  };

  const isEmpty = !loading && chats.length === 0 && friendRequests.length === 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.xp} />
        </View>
      ) : isEmpty ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="chatbubbles-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Add friends from your profile to start chatting
          </Text>
          <TouchableOpacity
            style={styles.goToProfileBtn}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.goToProfileBtnText}>Go to Profile</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            friendRequests.length > 0 ? (
              <View style={styles.requestsSection}>
                <Text style={styles.requestsSectionTitle}>
                  FRIEND REQUESTS ({friendRequests.length})
                </Text>
                {friendRequests.map((req) => (
                  <View key={req.id} style={styles.requestCard}>
                    {req.requesterPhoto ? (
                      <Image source={{ uri: req.requesterPhoto }} style={styles.reqAvatar} />
                    ) : (
                      <View style={[styles.reqAvatar, styles.reqAvatarPlaceholder]}>
                        <Text style={styles.reqInitial}>
                          {req.requesterName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reqName}>{req.requesterName}</Text>
                      <Text style={styles.reqSub}>Wants to be your friend</Text>
                    </View>
                    {requestActionLoading === req.id ? (
                      <ActivityIndicator color={Colors.accent} />
                    ) : (
                      <View style={styles.reqActions}>
                        <TouchableOpacity
                          style={styles.declineBtn}
                          onPress={() => handleDecline(req)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close" size={18} color={Colors.textSub} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() => handleAccept(req)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
                {chats.length > 0 && <View style={styles.sectionDivider} />}
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (!myUid) return null;
            const friendUid = item.participants.find(u => u !== myUid) ?? '';
            const friendName = item.participantNames?.[friendUid] ?? 'Friend';
            const friendPhoto = item.participantPhotos?.[friendUid];
            const unread = item.unreadCounts?.[myUid] ?? 0;
            const last = item.lastMessage;

            return (
              <TouchableOpacity
                style={styles.chatRow}
                onPress={() => router.push(`/chat/${friendUid}` as any)}
                activeOpacity={0.7}
              >
                {friendPhoto ? (
                  <Image source={{ uri: friendPhoto }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>
                      {friendName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.chatInfo}>
                  <Text style={styles.chatName}>{friendName}</Text>
                  {last && (
                    <Text style={styles.lastMsg} numberOfLines={1}>
                      {last.type === 'event' ? `📅 ${last.text}` : last.text}
                    </Text>
                  )}
                </View>
                <View style={styles.chatRight}>
                  {last && <Text style={styles.timeText}>{timeAgo(last.createdAt)}</Text>}
                  {unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{unread}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            friendRequests.length > 0 ? null : (
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={64} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptyText}>
                  Accept a friend request to start chatting
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: Colors.bg },
  center:               { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:               { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, backgroundColor: Colors.bg },
  headerTitle:          { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700' },

  list:                 { paddingBottom: 20 },

  // Friend requests section
  requestsSection:      { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  requestsSectionTitle: { color: Colors.textSub, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  requestCard:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  reqAvatar:            { width: 46, height: 46, borderRadius: 23 },
  reqAvatarPlaceholder: { backgroundColor: Colors.accent + '20', alignItems: 'center', justifyContent: 'center' },
  reqInitial:           { color: Colors.accent, fontSize: FontSize.md, fontWeight: '700' },
  reqName:              { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  reqSub:               { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  reqActions:           { flexDirection: 'row', gap: 8 },
  declineBtn:           { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: Colors.borderAlt, alignItems: 'center', justifyContent: 'center' },
  acceptBtn:            { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  sectionDivider:       { height: 1, backgroundColor: Colors.border, marginTop: 8, marginBottom: 4 },

  // Chat rows
  chatRow:              { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar:               { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder:    { backgroundColor: Colors.accent + '20', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:        { color: Colors.accent, fontSize: FontSize.lg, fontWeight: '700' },
  chatInfo:             { flex: 1, gap: 3 },
  chatName:             { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  lastMsg:              { color: Colors.textMuted, fontSize: FontSize.sm },
  chatRight:            { alignItems: 'flex-end', gap: 4 },
  timeText:             { color: Colors.textMuted, fontSize: FontSize.xs },
  unreadBadge:          { backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText:           { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Empty state
  emptyWrap:            { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12, marginTop: 60 },
  emptyTitle:           { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  emptyText:            { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
  goToProfileBtn:       { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Colors.accent },
  goToProfileBtnText:   { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
});
