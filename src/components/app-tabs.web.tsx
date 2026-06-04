import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useAuth } from '@/context/auth';
import { BrandColors, MaxContentWidth, Spacing } from '@/constants/theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

export default function AppTabs() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'student';
  const isStudent = role === 'student';
  const isFaculty = role === 'faculty';
  const isStaff = role === 'staff';
  const isSuperAdmin = role === 'super_admin';

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon={{ ios: 'house', android: 'home', web: 'home' }}>
              {isStudent ? 'Home' : isFaculty ? 'Dashboard' : isStaff ? 'Operations' : 'Overview'}
            </TabButton>
          </TabTrigger>
          {(isStaff || isSuperAdmin) && (
            <TabTrigger name="admin" href="/admin" asChild>
              <TabButton icon={{ ios: 'briefcase', android: 'work', web: 'work' }}>
                {isStaff ? 'Queue' : 'Management'}
              </TabButton>
            </TabTrigger>
          )}
          {(isStudent || isFaculty) && (
            <TabTrigger name="tickets" href="/tickets" asChild>
              <TabButton icon={{ ios: 'doc.text', android: 'assignment', web: 'assignment' }}>
                {isStudent ? 'Requests' : 'Advising'}
              </TabButton>
            </TabTrigger>
          )}
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}>Updates</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton icon={{ ios: 'person', android: 'person', web: 'person' }}>Profile</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  icon,
  ...props
}: TabTriggerSlotProps & {
  icon: SymbolName;
}) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <SymbolView
          name={icon}
          size={17}
          tintColor={isFocused ? BrandColors.primary : '#8B95A8'}
        />
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          CAS Assist
        </ThemedText>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,           // pin to bottom — was floating at top and blocking all content clicks
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    pointerEvents: 'box-none', // transparent gap between buttons passes clicks through
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: { marginRight: 'auto' },
  pressed: { opacity: 0.7 },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
