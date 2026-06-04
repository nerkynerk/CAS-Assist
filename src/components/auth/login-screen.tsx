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

import { Academic, AcademicIcon, SurfaceCard } from '@/components/ui/academic-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

interface Props {
  onNavigateToRegister: () => void;
}

export default function LoginScreen({ onNavigateToRegister }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <AcademicIcon
                name={{ ios: 'building.columns', android: 'account_balance', web: 'account_balance' }}
                color="#FFFFFF"
                size={34}
              />
            </View>
            <Text style={styles.appName}>CAS Assist</Text>
            <Text style={styles.appSub}>College of Arts and Sciences</Text>
            <Text style={styles.appCopy}>AI-assisted department information and helpdesk for New Era University.</Text>
          </View>

          <SurfaceCard style={styles.card}>
            <Text style={styles.formTitle}>Sign in</Text>
            <Text style={styles.formSub}>Use your institutional account to continue.</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>NEU Email</Text>
              <TextInput
                style={styles.input}
                placeholder="yourname@neu.edu.ph"
                placeholderTextColor={Academic.textSecondary}
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
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="Enter your password"
                  placeholderTextColor={Academic.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                  editable={!loading}
                />
                <Pressable onPress={() => setShowPass(value => !value)} hitSlop={8}>
                  <Text style={styles.showText}>{showPass ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.primaryButton, (pressed || loading) && styles.pressed]}
              onPress={handleSignIn}
              disabled={loading}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Sign In</Text>}
            </Pressable>
          </SurfaceCard>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account?</Text>
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
  safe: { flex: 1, backgroundColor: Academic.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 40,
    gap: Spacing.four,
  },
  pressed: { opacity: 0.72 },
  brand: { alignItems: 'center', gap: 8 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.primary,
    boxShadow: '0 7px 18px rgba(32, 138, 239, 0.26)',
  },
  appName: { color: Academic.navy, fontSize: 30, fontWeight: '900' },
  appSub: { color: Academic.primary, fontSize: 14, fontWeight: '900' },
  appCopy: { color: Academic.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center', maxWidth: 300 },
  card: { gap: 16 },
  formTitle: { color: Academic.navy, fontSize: 23, fontWeight: '900' },
  formSub: { color: Academic.textSecondary, fontSize: 14, lineHeight: 20 },
  errorBox: { borderRadius: 12, padding: 11, backgroundColor: Academic.errorBg },
  errorText: { color: Academic.error, fontSize: 13, fontWeight: '800' },
  fieldGroup: { gap: 7 },
  label: { color: Academic.textSecondary, fontSize: 13, fontWeight: '800' },
  input: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: Academic.navy,
    backgroundColor: Academic.muted,
    fontSize: 15,
  },
  inputRow: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: Academic.muted,
  },
  inputInner: { flex: 1, color: Academic.navy, fontSize: 15 },
  showText: { color: Academic.primary, fontSize: 13, fontWeight: '900' },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.primary,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  footerText: { color: Academic.textSecondary, fontSize: 14 },
  footerLink: { color: Academic.primary, fontSize: 14, fontWeight: '900' },
});
