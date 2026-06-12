import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BadgeProvider } from '../lib/badge-context';

export default function RootLayout() {
  return (
    <BadgeProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#0a0a0a' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: 'Set Up Your Profile' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="qr/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="submission/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="wallet/xp-history" options={{ title: 'XP History' }} />
        <Stack.Screen name="wallet/badges-list" options={{ title: 'My Badges' }} />
        <Stack.Screen name="wallet/cert-market" options={{ title: 'Cert Market' }} />
        <Stack.Screen name="wallet/earn-xp" options={{ title: 'Earn XP' }} />
        <Stack.Screen name="wallet/exam/[id]" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </BadgeProvider>
  );
}
