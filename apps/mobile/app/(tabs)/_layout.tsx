import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { Colors } from '../../constants/theme';
import { useBadge } from '../../lib/badge-context';
import { useNotifications } from '../../hooks/useNotifications';
import { auth } from '../../lib/firebase';
import { listenToChats } from '@talentbank/firebase-config';

export default function TabLayout() {
  useNotifications();
  const { count } = useBadge();
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let unsubChats: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubChats?.();
      if (!user) { setUnreadMessages(0); return; }
      unsubChats = listenToChats(user.uid, (chats: import('@talentbank/shared').ChatRoom[]) => {
        const total = chats.reduce((sum: number, c: import('@talentbank/shared').ChatRoom) => sum + (c.unreadCounts?.[user.uid] ?? 0), 0);
        setUnreadMessages(total);
      });
    });
    return () => { unsubAuth(); unsubChats?.(); };
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E2DED6' },
        tabBarActiveTintColor: Colors.xp,
        tabBarInactiveTintColor: Colors.textMuted,
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.text,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="events"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-events"
        options={{
          title: 'My Events',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-clear" color={color} size={size} />
          ),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: '#ef4444', color: '#fff', fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" color={color} size={size} />
          ),
          tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
          tabBarBadgeStyle: { backgroundColor: '#ef4444', color: '#fff', fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
