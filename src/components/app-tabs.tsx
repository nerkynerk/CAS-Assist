import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { useAuth } from '@/context/auth';
import { Colors } from '@/constants/theme';

const PRIMARY = '#208AEF';

export default function AppTabs() {
  const scheme  = useColorScheme();
  const colors  = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { profile } = useAuth();

  const isAdmin = profile?.role === 'staff' || profile?.role === 'super_admin';

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={PRIMARY}
      labelStyle={{ selected: { color: PRIMARY } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="chatbot">
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tickets">
        <NativeTabs.Trigger.Label>Tickets</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>News</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="documents">
        <NativeTabs.Trigger.Label>Docs</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {isAdmin && (
        <NativeTabs.Trigger name="admin">
          <NativeTabs.Trigger.Label>Admin</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      )}

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
