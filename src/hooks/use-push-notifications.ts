import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export interface PushNotificationState {
  expoPushToken: string | null;
  permissionGranted: boolean;
  lastNotification: Notifications.Notification | null;
}

export function usePushNotifications(userId: string | undefined): PushNotificationState {
  const [expoPushToken, setExpoPushToken]         = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [lastNotification, setLastNotification]   = useState<Notifications.Notification | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener     = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!userId) return;

    registerForPushNotifications(userId).then(token => {
      if (token) {
        setExpoPushToken(token);
        setPermissionGranted(true);
      }
    });

    // Foreground notification listener
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setLastNotification(notification);
    });

    // Response listener (user taps the notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      // Navigation on tap can be added here (e.g. go to tickets tab)
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId]);

  return { expoPushToken, permissionGranted, lastNotification };
}

// ── Push token registration ───────────────────────────────────

async function registerForPushNotifications(userId: string): Promise<string | null> {
  // Push notifications only work on physical devices (not simulators/web)
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('cas-assist', {
      name:             'CAS Assist',
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#208AEF',
    });
  }

  // Get Expo push token
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: 'cas-assist',
    });

    // Store token in users_account_registry for server-side sending
    await supabase
      .from('users_account_registry')
      .update({ push_token: token })
      .eq('id', userId);

    return token;
  } catch {
    return null;
  }
}
