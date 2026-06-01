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

import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const PRIMARY = '#208AEF';

const ROLE_COLOR: Record<string, string> = {
  student:     '#208AEF',
  faculty:     '#8B5CF6',
  staff:       '#16A34A',
  super_admin: '#DC2626',
};

const ROLE_LABEL: Record<string, string> = {
  student:     'Student',
  faculty:     'Faculty',
  staff:       'Staff',
  super_admin: 'Super Admin',
};

export default function ProfileScreen() {
  const theme              = useTheme();
  const { profile, signOut } = useAuth();

  const [editing, setEditing]       = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const role  = profile?.role ?? 'student';
  const rc    = ROLE_COLOR[role] ?? PRIMARY;

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
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: rc }]}>
            <Text style={styles.avatarLetter}>
              {(profile?.display_name ?? 'U')[0].toUpperCase()}
            </Text>
          </View>
          {!editing ? (
            <Text style={[styles.displayName, { color: theme.text }]}>
              {profile?.display_name ?? '—'}
            </Text>
          ) : (
            <TextInput
              style={[styles.nameInput, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              value={displayName}
              onChangeText={setDisplayName}
              autoFocus
              maxLength={60}
            />
          )}
          <View style={[styles.roleBadge, { backgroundColor: rc + '20' }]}>
            <Text style={[styles.roleText, { color: rc }]}>{ROLE_LABEL[role]}</Text>
          </View>
        </View>

        {/* Feedback banners */}
        {saveError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}
        {saveSuccess && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>✓  Profile updated successfully.</Text>
          </View>
        )}

        {/* Info rows */}
        <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement }]}>
          <InfoRow label="Email"  value={profile?.email ?? '—'}  textColor={theme.text} subColor={theme.textSecondary} />
          <View style={[styles.separator, { backgroundColor: theme.background }]} />
          <InfoRow label="Role"   value={ROLE_LABEL[role]}        textColor={theme.text} subColor={theme.textSecondary} />
          <View style={[styles.separator, { backgroundColor: theme.background }]} />
          <InfoRow
            label="Account status"
            value={profile?.state === 'archived_read_only' ? 'Read-only (archived)' : 'Active'}
            valueColor={profile?.state === 'archived_read_only' ? '#D97706' : '#16A34A'}
            textColor={theme.text}
            subColor={theme.textSecondary}
          />
        </View>

        {/* About section */}
        <View style={[styles.infoCard, { backgroundColor: theme.backgroundElement }]}>
          <InfoRow label="System"  value="CAS Assist v1.0"     textColor={theme.text} subColor={theme.textSecondary} />
          <View style={[styles.separator, { backgroundColor: theme.background }]} />
          <InfoRow label="College" value="College of Arts and Sciences" textColor={theme.text} subColor={theme.textSecondary} />
          <View style={[styles.separator, { backgroundColor: theme.background }]} />
          <InfoRow label="School"  value="New Era University"   textColor={theme.text} subColor={theme.textSecondary} />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {!editing ? (
            <Pressable
              style={({ pressed }) => [styles.editBtn, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => { setEditing(true); setDisplayName(profile?.display_name ?? ''); }}>
              <Text style={[styles.editBtnText, { color: theme.text }]}>Edit Display Name</Text>
            </Pressable>
          ) : (
            <View style={styles.editRow}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}
                onPress={() => setEditing(false)}>
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.saveBtn, { opacity: pressed || saving ? 0.75 : 1 }]}
                onPress={handleSave}
                disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </Pressable>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.signOutBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={signOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  textColor,
  subColor,
  valueColor,
}: {
  label: string;
  value: string;
  textColor: string;
  subColor: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: subColor }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor ?? textColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 120,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },

  // Avatar section
  avatarSection: { alignItems: 'center', gap: 12, paddingVertical: Spacing.three },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 38, fontWeight: '800', color: '#fff' },
  displayName:  { fontSize: 22, fontWeight: '700' },
  nameInput: {
    fontSize: 20,
    fontWeight: '600',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 220,
    textAlign: 'center',
  },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  roleText:  { fontSize: 13, fontWeight: '600' },

  // Info card
  infoCard:  { borderRadius: 16, overflow: 'hidden' },
  infoRow:   {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'right' },
  separator: { height: 1, marginHorizontal: Spacing.three },

  // Actions
  actions:   { gap: 12 },
  editBtn:   { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 15, fontWeight: '600' },
  editRow:   { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 15 },
  saveBtn:   { flex: 2, height: 50, backgroundColor: PRIMARY, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  signOutBtn: {
    height: 50,
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },

  // Feedback
  errorBox:    { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12 },
  errorText:   { color: '#DC2626', fontSize: 13 },
  successBox:  { backgroundColor: '#DCFCE7', borderRadius: 10, padding: 12 },
  successText: { color: '#16A34A', fontSize: 13, fontWeight: '500' },
});
