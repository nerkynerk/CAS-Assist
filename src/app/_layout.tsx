import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import LoginScreen from '@/components/auth/login-screen';
import RegisterScreen from '@/components/auth/register-screen';
import { AuthProvider, useAuth } from '@/context/auth';
import { usePushNotifications } from '@/hooks/use-push-notifications';

type AuthView = 'login' | 'register';

const styles = StyleSheet.create({
  // Must be above AnimatedSplashOverlay (zIndex 1000) on native,
  // and above everything on web.
  overlay: { zIndex: 1001, elevation: 1001 },
});

// ── Auth overlay ──────────────────────────────────────────────
// AppTabs stays mounted at all times so the Expo Router navigator
// is never torn down. When there is no session we cover it with a
// full-screen overlay. Signing out makes session null → overlay
// appears. Signing in makes session non-null → overlay disappears.

function PushSetup() {
  const { profile } = useAuth();
  usePushNotifications(profile?.id);
  return null;
}

function AuthOverlay() {
  const { session, isLoading } = useAuth();
  const [authView, setAuthView] = useState<AuthView>('login');

  // While restoring the session from storage, show nothing —
  // the AnimatedSplashOverlay above handles the loading moment.
  if (isLoading || session) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {authView === 'login' ? (
        <LoginScreen onNavigateToRegister={() => setAuthView('register')} />
      ) : (
        <RegisterScreen onNavigateToLogin={() => setAuthView('login')} />
      )}
    </View>
  );
}

// ── Root layout ───────────────────────────────────────────────

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppTabs />
        {Platform.OS !== 'web' && <AnimatedSplashOverlay />}
        <PushSetup />
        <AuthOverlay />
      </ThemeProvider>
    </AuthProvider>
  );
}
