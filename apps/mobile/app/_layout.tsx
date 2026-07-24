import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { BadgeProvider } from '../lib/badge-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Baloo2_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <BadgeProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#F7F4EE' },
          headerTintColor: '#3A332C',
          contentStyle: { backgroundColor: '#F7F4EE' },
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
        <Stack.Screen name="scan-friend-qr" options={{ headerShown: false }} />
        <Stack.Screen name="friends" options={{ title: 'Friends' }} />
        <Stack.Screen name="chat/[friendId]" options={{ headerShown: false }} />
        <Stack.Screen name="profile/career" options={{ title: 'Career Profile' }} />
      </Stack>
      <StatusBar style="dark" />
    </BadgeProvider>
  );
}
