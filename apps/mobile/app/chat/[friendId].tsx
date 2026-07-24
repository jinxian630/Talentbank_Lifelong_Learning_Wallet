import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import {
  listenToMessages,
  sendMessage,
  markChatRead,
  getUserProfileByUid,
  getOrCreateChat,
} from '@talentbank/firebase-config';
import type { Message, UserProfile, TalentEvent } from '@talentbank/shared';
import { Colors, Radius, FontSize, EventTypeColors } from '../../constants/theme';

function friendshipId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ChatScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const router = useRouter();

  const [myUid, setMyUid] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eventPickerVisible, setEventPickerVisible] = useState(false);
  const [events, setEvents] = useState<TalentEvent[]>([]);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || !friendId) return;
      setMyUid(user.uid);
      const [me, friend] = await Promise.all([
        getUserProfileByUid(user.uid),
        getUserProfileByUid(friendId),
      ]);
      setMyProfile(me);
      setFriendProfile(friend);
      const cid = await getOrCreateChat(
        user.uid,
        friendId,
        { name: me?.name ?? '', photoURL: me?.photoURL ?? '' },
        { name: friend?.name ?? '', photoURL: friend?.photoURL ?? '' },
      );
      setChatId(cid);
      setLoading(false);
    });
    return () => unsub();
  }, [friendId]);

  useEffect(() => {
    if (!chatId) return;
    const unsub = listenToMessages(chatId, setMessages);
    return () => unsub();
  }, [chatId]);

  // Load user's registered events for the event picker
  useEffect(() => {
    if (!myUid) return;
    const q = query(collection(db, 'events'), firestoreOrderBy('startAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TalentEvent));
      setEvents(all.filter((e) => e.participants?.includes(myUid)));
    });
    return () => unsub();
  }, [myUid]);

  const markRead = useCallback(() => {
    if (chatId && myUid) markChatRead(chatId, myUid).catch(() => {});
  }, [chatId, myUid]);

  useEffect(() => { markRead(); }, [markRead]);
  useFocusEffect(useCallback(() => { markRead(); }, [markRead]));

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !chatId || !myUid || !friendId || sending) return;
    setSending(true);
    setInputText('');
    try {
      await sendMessage(chatId, myUid, friendId, { type: 'text', text });
    } finally {
      setSending(false);
    }
  };

  const handleSendEvent = async (event: TalentEvent) => {
    if (!chatId || !myUid || !friendId) return;
    setEventPickerVisible(false);
    await sendMessage(chatId, myUid, friendId, {
      type: 'event',
      text: event.title,
      eventId: event.id,
      eventSnapshot: {
        title: event.title,
        emoji: event.emoji ?? '📅',
        type: event.type,
        startAt: event.startAt,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.xp} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        {friendProfile?.photoURL ? (
          <Image source={{ uri: friendProfile.photoURL }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {(friendProfile?.name ?? 'F').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.headerName}>{friendProfile?.name ?? 'Chat'}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const isMe = item.senderId === myUid;
            const prevMsg = messages[index - 1];
            const showDate =
              !prevMsg ||
              formatDate(prevMsg.createdAt) !== formatDate(item.createdAt);

            return (
              <>
                {showDate && (
                  <View style={styles.dateDivider}>
                    <Text style={styles.dateDividerText}>{formatDate(item.createdAt)}</Text>
                  </View>
                )}
                <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
                  {item.type === 'event' && item.eventSnapshot ? (
                    <TouchableOpacity
                      style={[styles.eventCard, isMe ? styles.eventCardMe : styles.eventCardThem]}
                      onPress={() => router.push(`/event/${item.eventId}` as any)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.eventCardTop}>
                        <Text style={styles.eventEmoji}>{item.eventSnapshot.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.eventTitle} numberOfLines={2}>
                            {item.eventSnapshot.title}
                          </Text>
                          <View style={[
                            styles.typePill,
                            { backgroundColor: (EventTypeColors[item.eventSnapshot.type] ?? Colors.textMuted) + '25' }
                          ]}>
                            <Text style={[
                              styles.typePillText,
                              { color: EventTypeColors[item.eventSnapshot.type] ?? Colors.textMuted }
                            ]}>
                              {item.eventSnapshot.type}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.eventViewLink}>View Event →</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                      <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                        {item.text}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.timeLabel, isMe ? styles.timeLabelMe : styles.timeLabelThem]}>
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
              </>
            );
          }}
        />

        {/* Input row */}
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.shareEventBtn}
            onPress={() => setEventPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={22} color={Colors.accent} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />

          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.7}
          >
            <Ionicons name="send" size={18} color={inputText.trim() ? '#fff' : Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Event Picker Modal */}
      <Modal
        visible={eventPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEventPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share an Event</Text>
              <TouchableOpacity onPress={() => setEventPickerVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {events.length === 0 ? (
              <View style={styles.noEventsWrap}>
                <Text style={styles.noEventsText}>
                  Register for events to share them with friends
                </Text>
              </View>
            ) : (
              <FlatList
                data={events}
                keyExtractor={(e) => e.id}
                contentContainerStyle={styles.eventList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.eventPickerRow}
                    onPress={() => handleSendEvent(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eventPickerEmoji}>{item.emoji ?? '📅'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventPickerTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.eventPickerType}>{item.type}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.bg },
  flex:               { flex: 1 },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  header:             { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn:            { padding: 4 },
  headerAvatar:       { width: 38, height: 38, borderRadius: 19 },
  avatarPlaceholder:  { backgroundColor: Colors.accent + '20', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:      { color: Colors.accent, fontSize: FontSize.md, fontWeight: '700' },
  headerName:         { flex: 1, color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },

  messagesList:       { paddingHorizontal: 16, paddingVertical: 12 },

  dateDivider:        { alignItems: 'center', marginVertical: 10 },
  dateDividerText:    { color: Colors.textMuted, fontSize: FontSize.xs, backgroundColor: Colors.bg, paddingHorizontal: 10 },

  msgRow:             { marginBottom: 2 },
  msgRowMe:           { alignItems: 'flex-end' },
  msgRowThem:         { alignItems: 'flex-start' },

  bubble:             { maxWidth: '80%', borderRadius: Radius.xl, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe:           { backgroundColor: Colors.accent + '25', borderWidth: 1, borderColor: Colors.accent + '50', borderBottomRightRadius: 4 },
  bubbleThem:         { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleText:         { fontSize: FontSize.sm, lineHeight: 20 },
  bubbleTextMe:       { color: Colors.text },
  bubbleTextThem:     { color: Colors.text },

  eventCard:          { maxWidth: '80%', borderRadius: Radius.xl, padding: 14, borderWidth: 1 },
  eventCardMe:        { backgroundColor: Colors.accent + '15', borderColor: Colors.accent + '40', borderBottomRightRadius: 4 },
  eventCardThem:      { backgroundColor: Colors.surface, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  eventCardTop:       { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  eventEmoji:         { fontSize: 24 },
  eventTitle:         { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700', lineHeight: 18, marginBottom: 6 },
  typePill:           { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  typePillText:       { fontSize: FontSize.xs, fontWeight: '700' },
  eventViewLink:      { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '700' },

  timeLabel:          { color: Colors.textMuted, fontSize: 10, marginTop: 2, marginBottom: 10 },
  timeLabelMe:        { textAlign: 'right' },
  timeLabelThem:      { textAlign: 'left' },

  inputRow:           {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    ...(Platform.OS === 'ios' ? { paddingBottom: 20 } : {}),
  },
  shareEventBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  textInput:          {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: Colors.bg,
    borderRadius: Radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn:            { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:    { backgroundColor: Colors.border },

  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet:         { backgroundColor: Colors.bg, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, maxHeight: '70%', paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  modalHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle:         { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  eventList:          { padding: 16 },
  eventPickerRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  eventPickerEmoji:   { fontSize: 22 },
  eventPickerTitle:   { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  eventPickerType:    { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  noEventsWrap:       { padding: 32, alignItems: 'center' },
  noEventsText:       { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
});
