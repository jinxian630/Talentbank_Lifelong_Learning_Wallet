import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { updateUserPushToken } from '@talentbank/firebase-config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

export function useNotifications() {
  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;

    const register = async () => {
      if (Platform.OS === 'web') return;

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (user && token) {
          await updateUserPushToken(user.uid, token);
        }
      });
    };

    register().catch(() => {});

    return () => {
      unsubscribeAuth?.();
    };
  }, []);
}
