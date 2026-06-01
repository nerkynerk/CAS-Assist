import { Link, useRouter } from 'expo-router';
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
const SUCCESS  = '#16A34A';

export default function RegisterScreen() {
  const theme  = useTheme();
  const router = useRouter();
  const { signUp } = useAuth();

  const [displayName, setDisplayName]   = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [confirmed, setConfirmed]       = useState(false);

  async function handleRegister() {
    setError(null);

    const trimmedName  = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError('Full name is required.');
      return;
    }
    if (!trimmedEmail.endsWith('@neu.edu.ph')) {
      setError('Only @neu.edu.ph email addresses are allowed.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: authError, needsConfirmation } = await signUp(
      trimmedEmail,
      password,
      trimmedName,
    );
    setLoading(false);

    if (authError) {
      setError(authError);
    } else if (needsConfirmation) {
      setConfirmed(true);
    } else {
      router.replace('/');
    }
  }

  const styles = makeStyles(theme.background, theme.backgroundElement, theme.text, theme.textSecondary);

  // ── Email confirmation pending state ─────────────────────────
  if (confirmed) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <View style={styles.confirmedContainer}>
          <View style={styles.confirmedIcon}>
            <Text style={styles.confirmedIconText}>✉️</Text>
          </View>
          <Text style={[styles.confirmedTitle, { color: theme.text }]}>Check Your Email</Text>
          <Text style={[styles.confirmedBody, { color: theme.textSecondary }]}>
            We sent a confirmation link to{'\n'}
            <Text style={{ color: PRIMARY, fontWeight: '600' }}>{email}</Text>
            {'\n\n'}Click the link to activate your account, then sign in.
          </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Go to Sign In</Text>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    );
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

          {/* ── Header ───────────────────────────────── */}
          <View style={styles.header}>
            <Text style={[styles.formTitle, { color: theme.text }]}>Create Account</Text>
            <Text style={[styles.formSub, { color: theme.textSecondary }]}>
              Join CAS Assist — NEU students only
            </Text>
          </View>

          {/* ── Form ─────────────────────────────────── */}
          <View style={styles.card}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
                placeholder="Juan Dela Cruz"
                placeholderTextColor={theme.textSecondary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                editable={!loading}
              />
            </View>

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
              {email.length > 0 && !email.toLowerCase().endsWith('@neu.edu.ph') && (
                <Text style={styles.fieldHint}>Must end with @neu.edu.ph</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.backgroundElement }]}>
                <TextInput
                  style={[styles.inputInner, { color: theme.text }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  returnKeyType="next"
                  editable={!loading}
                />
                <Pressable onPress={() => setShowPass(v => !v)} hitSlop={8} style={styles.eyeBtn}>
                  <Text style={[styles.eyeText, { color: theme.textSecondary }]}>
                    {showPass ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Confirm Password</Text>
              <View style={[styles.inputRow, { backgroundColor: theme.backgroundElement }]}>
                <TextInput
                  style={[styles.inputInner, { color: theme.text }]}
                  placeholder="Re-enter your password"
                  placeholderTextColor={theme.textSecondary}
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showConfirm}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                  editable={!loading}
                />
                <Pressable onPress={() => setShowConfirm(v => !v)} hitSlop={8} style={styles.eyeBtn}>
                  <Text style={[styles.eyeText, { color: theme.textSecondary }]}>
                    {showConfirm ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              </View>
              {confirm.length > 0 && password !== confirm && (
                <Text style={styles.fieldHint}>Passwords do not match</Text>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: pressed || loading ? 0.75 : 1 },
              ]}
              onPress={handleRegister}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
            </Pressable>
          </View>

          {/* ── Footer ───────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign In</Text>
              </Pressable>
            </Link>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(
  bg: string,
  bgEl: string,
  text: string,
  textSec: string,
) {
  return StyleSheet.create({
    safe: { flex: 1 },
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 40,
      gap: 28,
    },

    // Header
    header: { gap: 6 },
    formTitle: { fontSize: 26, fontWeight: '700' },
    formSub: { fontSize: 14 },

    // Card
    card: { gap: 18 },

    // Error
    errorBox: {
      backgroundColor: '#FEE2E2',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    errorText: { color: ERROR, fontSize: 13 },

    // Fields
    fieldGroup: { gap: 6 },
    label: { fontSize: 13, fontWeight: '500' },
    fieldHint: { fontSize: 12, color: ERROR, marginTop: 2 },
    input: {
      height: 50,
      borderRadius: 12,
      paddingHorizontal: 16,
      fontSize: 15,
    },
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

    // Button
    primaryBtn: {
      height: 52,
      backgroundColor: PRIMARY,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

    // Footer
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    footerText: { fontSize: 14 },
    footerLink: { fontSize: 14, fontWeight: '600', color: PRIMARY },

    // Confirmed state
    confirmedContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 20,
    },
    confirmedIcon: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmedIconText: { fontSize: 36 },
    confirmedTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
    confirmedBody: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  });
}
