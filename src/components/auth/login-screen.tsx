import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';

const PRIMARY = '#208AEF';
const ERROR   = '#DC2626';

interface Props {
  onNavigateToRegister: () => void;
}

export default function LoginScreen({ onNavigateToRegister }: Props) {
  const theme   = useTheme();
  const { signIn } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSignIn() {
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (!trimmedEmail.endsWith('@neu.edu.ph')) {
      setError('Only @neu.edu.ph email addresses are allowed.');
      return;
    }

    setLoading(true);
    const { error: authError } = await signIn(trimmedEmail, password);
    setLoading(false);

    if (authError) setError(authError);
    // On success, AuthProvider session updates → AppContent re-renders to AppTabs
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Branding ─────────────────────────────── */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBox}>
              <Text style={styles.logoLetter}>C</Text>
            </View>
            <Text style={styles.appName}>CAS Assist</Text>
            <Text style={[styles.appSub, { color: theme.textSecondary }]}>
              College of Arts and Sciences
            </Text>
          </View>

          {/* ── Form ─────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={[styles.formTitle, { color: theme.text }]}>Sign In</Text>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>NEU Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
                placeholder="yourname@neu.edu.ph"
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                editable={!loading}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.backgroundElement }]}>
                <TextInput
                  style={[styles.inputInner, { color: theme.text }]}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                  editable={!loading}
                />
                <Pressable onPress={() => setShowPass(v => !v)} hitSlop={8} style={styles.eyeBtn}>
                  <Text style={[styles.eyeText, { color: theme.textSecondary }]}>
                    {showPass ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed || loading ? 0.75 : 1 }]}
              onPress={handleSignIn}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          {/* ── Footer ───────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Don't have an account?{' '}
            </Text>
            <Pressable onPress={onNavigateToRegister}>
              <Text style={styles.footerLink}>Register</Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 32,
  },
  brandContainer: { alignItems: 'center', gap: 8 },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoLetter: { fontSize: 36, fontWeight: '700', color: '#fff' },
  appName: { fontSize: 28, fontWeight: '700', color: PRIMARY, letterSpacing: -0.5 },
  appSub: { fontSize: 14 },
  card: { gap: 20 },
  formTitle: { fontSize: 22, fontWeight: '700' },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: ERROR, fontSize: 13 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '500' },
  input: { height: 50, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  inputRow: {
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputInner: { flex: 1, fontSize: 15 },
  eyeBtn: { paddingLeft: 8 },
  eyeText: { fontSize: 13, fontWeight: '500' },
  primaryBtn: {
    height: 52,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '600', color: PRIMARY },
});
