import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { useAuth } from '@/context/auth';
import { BrandColors, Colors } from '@/constants/theme';

const PRIMARY = BrandColors.primary;
type TabIconSource = { default: string; selected: string };

function Tab({
  name,
  label,
  sf,
  md,
}: {
  name: string;
  label: string;
  sf: TabIconSource;
  md: TabIconSource;
}) {
  return (
    <NativeTabs.Trigger name={name}>
      <NativeTabs.Trigger.Icon sf={sf as never} md={md as never} />
      <NativeTabs.Trigger.Label>{label}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
  );
}

export default function AppTabs() {
  const scheme  = useColorScheme();
  const colors  = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { profile } = useAuth();

  const role = profile?.role ?? 'student';
  const isStudent = role === 'student';
  const isFaculty = role === 'faculty';
  const isStaff = role === 'staff';
  const isSuperAdmin = role === 'super_admin';

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={PRIMARY}
      iconColor={{ default: colors.textSecondary, selected: PRIMARY }}
      labelStyle={{ selected: { color: PRIMARY } }}>
      <Tab
        name="index"
        label={isStudent ? 'Home' : isFaculty ? 'Dashboard' : isStaff ? 'Operations' : 'Overview'}
        sf={{ default: 'house', selected: 'house.fill' }}
        md={{ default: 'home', selected: 'home' }}
      />

      {(isStaff || isSuperAdmin) && (
        <Tab
          name="admin"
          label={isStaff ? 'Queue' : 'Management'}
          sf={{ default: 'briefcase', selected: 'briefcase.fill' }}
          md={{ default: 'work', selected: 'work' }}
        />
      )}

      {(isStudent || isFaculty) && (
        <Tab
          name="tickets"
          label={isStudent ? 'Requests' : 'Advising'}
          sf={{ default: 'doc.text', selected: 'doc.text.fill' }}
          md={{ default: 'assignment', selected: 'assignment' }}
        />
      )}

      <Tab
        name="explore"
        label="Updates"
        sf={{ default: 'bell', selected: 'bell.fill' }}
        md={{ default: 'notifications', selected: 'notifications' }}
      />

      <Tab
        name="profile"
        label="Profile"
        sf={{ default: 'person', selected: 'person.fill' }}
        md={{ default: 'person_outline', selected: 'person' }}
      />
    </NativeTabs>
  );
}
