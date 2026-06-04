import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Academic,
  AcademicIcon,
  RoleHeroHeader,
  SectionHeader,
  StatusBadge,
  SurfaceCard,
} from '@/components/ui/academic-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  faculty: 'Faculty',
  staff: 'CAS Staff',
  super_admin: 'Super Administrator',
};

const ROLE_TONE: Record<string, 'blue' | 'warning' | 'success' | 'error'> = {
  student: 'blue',
  faculty: 'warning',
  staff: 'success',
  super_admin: 'error',
};

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const role = profile?.role ?? 'student';
  const firstName = profile?.display_name?.split(' ')[0] ?? 'there';

  async function handleSave() {
    if (!displayName.trim()) { setSaveError('Name cannot be empty.'); return; }
    setSaveError(null);
    setSaving(true);

    const { error } = await supabase
      .from('users_account_registry')
      .update({ display_name: displayName.trim() })
      .eq('id', profile!.id);

    setSaving(false);
    if (error) {
      setSaveError('Failed to update. Please try again.');
    } else {
      setSaveSuccess(true);
      setEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <RoleHeroHeader
          label="CAS Assist Profile"
          title={`Hello, ${firstName}`}
          subtitle="Manage your institutional account details."
          right={
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{(profile?.display_name ?? 'U')[0].toUpperCase()}</Text>
            </View>
          }
        />

        <SurfaceCard style={styles.identityCard}>
          {!editing ? (
            <Text style={styles.displayName}>{profile?.display_name ?? 'No name set'}</Text>
          ) : (
            <TextInput
              style={styles.nameInput}
              value={displayName}
              onChangeText={setDisplayName}
              autoFocus
              maxLength={60}
              placeholder="Display name"
              placeholderTextColor={Academic.textSecondary}
            />
          )}
          <View style={styles.badgeRow}>
            <StatusBadge label={ROLE_LABEL[role] ?? role} tone={ROLE_TONE[role] ?? 'blue'} />
            <StatusBadge
              label={profile?.state === 'archived_read_only' ? 'Read-only' : 'Active'}
              tone={profile?.state === 'archived_read_only' ? 'warning' : 'success'}
            />
          </View>
        </SurfaceCard>

        {saveError ? <View style={styles.errorBox}><Text style={styles.errorText}>{saveError}</Text></View> : null}
        {saveSuccess ? <View style={styles.successBox}><Text style={styles.successText}>Profile updated successfully.</Text></View> : null}

        <SectionHeader title="Account" />
        <SurfaceCard style={styles.infoCard}>
          <InfoRow icon={{ ios: 'envelope', android: 'mail', web: 'mail' }} label="Email" value={profile?.email ?? '-'} />
          <View style={styles.separator} />
          <InfoRow icon={{ ios: 'person.badge.key', android: 'badge', web: 'badge' }} label="Role" value={ROLE_LABEL[role] ?? role} />
          <View style={styles.separator} />
          <InfoRow
            icon={{ ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' }}
            label="Status"
            value={profile?.state === 'archived_read_only' ? 'Archived read-only' : 'Active'}
          />
        </SurfaceCard>

        <SectionHeader title="Institution" />
        <SurfaceCard style={styles.infoCard}>
          <InfoRow icon={{ ios: 'building.columns', android: 'account_balance', web: 'account_balance' }} label="System" value="CAS Assist v1.0" />
          <View style={styles.separator} />
          <InfoRow icon={{ ios: 'graduationcap', android: 'school', web: 'school' }} label="College" value="College of Arts and Sciences" />
          <View style={styles.separator} />
          <InfoRow icon={{ ios: 'building.2', android: 'domain', web: 'domain' }} label="School" value="New Era University" />
        </SurfaceCard>

        {!editing ? (
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => { setEditing(true); setDisplayName(profile?.display_name ?? ''); }}>
            <Text style={styles.secondaryButtonText}>Edit Display Name</Text>
          </Pressable>
        ) : (
          <View style={styles.editRow}>
            <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]} onPress={() => setEditing(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.saveButton, (pressed || saving) && styles.pressed]}
              onPress={handleSave}
              disabled={saving}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
            </Pressable>
          </View>
        )}

        <Pressable style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: Parameters<typeof AcademicIcon>[0]['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <AcademicIcon name={icon} color={Academic.textSecondary} size={18} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Academic.background },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 128,
    gap: Spacing.three,
  },
  pressed: { opacity: 0.72 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarLetter: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  identityCard: { gap: Spacing.two },
  displayName: { color: Academic.navy, fontSize: 22, fontWeight: '900' },
  nameInput: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: Academic.navy,
    backgroundColor: Academic.muted,
    fontSize: 18,
    fontWeight: '800',
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  infoCard: { paddingVertical: 4 },
  infoRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  infoLabel: { color: Academic.textSecondary, fontSize: 13, fontWeight: '800' },
  infoValue: { color: Academic.navy, fontSize: 14, fontWeight: '800', flex: 1, textAlign: 'right' },
  separator: { height: 1, backgroundColor: Academic.border },
  secondaryButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.softBlue,
  },
  secondaryButtonText: { color: Academic.primary, fontSize: 15, fontWeight: '900' },
  editRow: { flexDirection: 'row', gap: Spacing.two },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.muted,
  },
  cancelButtonText: { color: Academic.textSecondary, fontSize: 15, fontWeight: '900' },
  saveButton: {
    flex: 2,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.primary,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  signOutButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.errorBg,
  },
  signOutText: { color: Academic.error, fontSize: 15, fontWeight: '900' },
  errorBox: { borderRadius: 14, padding: 12, backgroundColor: Academic.errorBg },
  errorText: { color: Academic.error, fontSize: 13, fontWeight: '800' },
  successBox: { borderRadius: 14, padding: 12, backgroundColor: Academic.successBg },
  successText: { color: Academic.success, fontSize: 13, fontWeight: '800' },
});
