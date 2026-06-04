import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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
  EmptyState,
  IconButton,
  SectionHeader,
  StatusBadge,
  SurfaceCard,
} from '@/components/ui/academic-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

interface DocumentRequest {
  id: string;
  document_type: string;
  purpose: string;
  copies: number;
  status: string;
  remarks: string | null;
  requested_at: string;
}

type ScreenView = 'list' | 'new';

const DOC_TYPES: { value: string; label: string; description: string }[] = [
  { value: 'transcript_of_records', label: 'Transcript of Records', description: 'Official academic record of grades' },
  { value: 'certificate_of_enrollment', label: 'Certificate of Enrollment', description: 'Proof of current enrollment' },
  { value: 'certificate_of_good_moral', label: 'Certificate of Good Moral', description: 'Character reference certificate' },
  { value: 'honorable_dismissal', label: 'Honorable Dismissal', description: 'Transfer clearance document' },
  { value: 'diploma', label: 'Diploma', description: 'Graduation certificate' },
  { value: 'other', label: 'Other', description: 'Other document not listed above' },
];

const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_TYPES.map(item => [item.value, item.label]));

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  under_evaluation: 'Under Evaluation',
  action_required: 'Action Required',
  processing: 'Processing',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  rejected: 'Rejected',
};

const STATUS_TONE: Record<string, 'blue' | 'warning' | 'success' | 'error' | 'muted'> = {
  submitted: 'blue',
  under_evaluation: 'warning',
  action_required: 'error',
  processing: 'warning',
  ready_for_pickup: 'success',
  completed: 'success',
  rejected: 'error',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function RequestCard({ item }: { item: DocumentRequest }) {
  const tone = STATUS_TONE[item.status] ?? 'muted';
  return (
    <SurfaceCard style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.docIcon}>
          <AcademicIcon
            name={{ ios: 'doc.text', android: 'description', web: 'description' }}
            color={Academic.primary}
            size={22}
          />
        </View>
        <View style={styles.requestText}>
          <Text style={styles.docTitle} numberOfLines={2}>{DOC_LABEL[item.document_type] ?? item.document_type}</Text>
          <Text style={styles.requestMeta}>
            {item.copies} {item.copies === 1 ? 'copy' : 'copies'} - Requested {formatDate(item.requested_at)}
          </Text>
        </View>
        <StatusBadge label={STATUS_LABEL[item.status] ?? item.status} tone={tone} />
      </View>
      <Text style={styles.requestPurpose} numberOfLines={2}>Purpose: {item.purpose}</Text>
      {item.remarks ? (
        <View style={styles.remarksBox}>
          <Text style={styles.remarksLabel}>Staff note</Text>
          <Text style={styles.remarksText}>{item.remarks}</Text>
        </View>
      ) : null}
    </SurfaceCard>
  );
}

export default function DocumentsScreen() {
  const { profile, session } = useAuth();
  const [view, setView] = useState<ScreenView>('list');
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [docType, setDocType] = useState('');
  const [purpose, setPurpose] = useState('');
  const [copies, setCopies] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const userId = profile?.id ?? session?.user.id;

  const fetchRequests = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('document_requests')
      .select('id, document_type, purpose, copies, status, remarks, requested_at')
      .eq('student_id', userId)
      .eq('state', 'active')
      .order('requested_at', { ascending: false });
    setRequests(data ?? []);
  }, [userId]);

  async function load() { setLoading(true); await fetchRequests(); setLoading(false); }
  async function onRefresh() { setRefreshing(true); await fetchRequests(); setRefreshing(false); }

  useEffect(() => { load(); }, [fetchRequests]);

  async function handleSubmit() {
    setFormError(null);
    if (!docType) { setFormError('Please select a document type.'); return; }
    if (!purpose.trim()) { setFormError('Please state the purpose of your request.'); return; }
    if (!userId) { setFormError('Session expired. Please sign in again.'); return; }

    setSubmitting(true);
    const { error } = await supabase.from('document_requests').insert({
      student_id: userId,
      document_type: docType,
      purpose: purpose.trim(),
      copies,
      status: 'submitted',
    });
    setSubmitting(false);

    if (error) {
      setFormError('Failed to submit request. Please try again.');
    } else {
      setFormSuccess(true);
      setDocType('');
      setPurpose('');
      setCopies(1);
      await fetchRequests();
      setTimeout(() => { setFormSuccess(false); setView('list'); }, 1500);
    }
  }

  if (view === 'new') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.pageHeader}>
            <IconButton
              icon={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              onPress={() => setView('list')}
              label="Back"
              bg={Academic.muted}
              color={Academic.textSecondary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>Request Document</Text>
              <Text style={styles.pageSub}>Processing time depends on office verification.</Text>
            </View>
          </View>

          {formError ? <View style={styles.errorBox}><Text style={styles.errorText}>{formError}</Text></View> : null}
          {formSuccess ? <View style={styles.successBox}><Text style={styles.successText}>Request submitted successfully.</Text></View> : null}

          <SectionHeader title="Document Type" />
          <View style={styles.docTypeGrid}>
            {DOC_TYPES.map(item => {
              const active = docType === item.value;
              return (
                <Pressable key={item.value} onPress={() => setDocType(item.value)} style={[styles.docTypeCard, active && styles.docTypeCardActive]}>
                  <Text style={[styles.docTypeLabel, active && styles.docTypeLabelActive]}>{item.label}</Text>
                  <Text style={styles.docTypeDesc}>{item.description}</Text>
                </Pressable>
              );
            })}
          </View>

          <SectionHeader title="Purpose" />
          <TextInput
            style={styles.textarea}
            placeholder="e.g. For scholarship application, employment requirements..."
            placeholderTextColor={Academic.textSecondary}
            value={purpose}
            onChangeText={setPurpose}
            multiline
            numberOfLines={4}
            maxLength={300}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{purpose.length}/300</Text>

          <SectionHeader title="Copies" />
          <View style={styles.copiesRow}>
            {[1, 2, 3, 4, 5].map(count => {
              const active = copies === count;
              return (
                <Pressable key={count} onPress={() => setCopies(count)} style={[styles.copyButton, active && styles.copyButtonActive]}>
                  <Text style={[styles.copyText, active && styles.copyTextActive]}>{count}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [styles.submitButton, (pressed || submitting) && styles.pressed]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Submit Request</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Academic.primary} />}
        contentContainerStyle={styles.scroll}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Documents</Text>
            <Text style={styles.pageSub}>Track official CAS document requests.</Text>
          </View>
          <IconButton
            icon={{ ios: 'plus', android: 'add', web: 'add' }}
            onPress={() => setView('new')}
            label="New document request"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendRail}>
          {['submitted', 'under_evaluation', 'processing', 'ready_for_pickup', 'completed'].map(status => (
            <StatusBadge key={status} label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={Academic.primary} style={styles.loader} />
        ) : requests.length === 0 ? (
          <EmptyState
            title="No document requests"
            message="Tap the plus button to request an official document."
            icon={{ ios: 'doc.text', android: 'description', web: 'description' }}
          />
        ) : (
          requests.map(item => <RequestCard key={item.id} item={item} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Academic.background },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: 128,
    gap: Spacing.three,
  },
  pressed: { opacity: 0.72 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  pageTitle: { color: Academic.navy, fontSize: 26, fontWeight: '900' },
  pageSub: { color: Academic.textSecondary, fontSize: 13, marginTop: 3 },
  legendRail: { gap: Spacing.two, paddingRight: Spacing.three },
  loader: { marginTop: Spacing.four },
  requestCard: { gap: 12 },
  requestHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  docIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.softBlue,
  },
  requestText: { flex: 1, gap: 3 },
  docTitle: { color: Academic.navy, fontSize: 16, fontWeight: '900' },
  requestMeta: { color: Academic.textSecondary, fontSize: 12, lineHeight: 17 },
  requestPurpose: { color: Academic.textSecondary, fontSize: 13, lineHeight: 19 },
  remarksBox: { borderRadius: 12, padding: 10, gap: 3, backgroundColor: Academic.muted },
  remarksLabel: { color: Academic.primary, fontSize: 12, fontWeight: '900' },
  remarksText: { color: Academic.navy, fontSize: 13, lineHeight: 18 },
  docTypeGrid: { gap: Spacing.two },
  docTypeCard: {
    borderRadius: 16,
    padding: 14,
    gap: 4,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
  },
  docTypeCardActive: { borderColor: Academic.primary, backgroundColor: Academic.softBlue },
  docTypeLabel: { color: Academic.navy, fontSize: 15, fontWeight: '900' },
  docTypeLabelActive: { color: Academic.primary },
  docTypeDesc: { color: Academic.textSecondary, fontSize: 12, lineHeight: 17 },
  textarea: {
    minHeight: 112,
    borderRadius: 16,
    padding: 14,
    color: Academic.navy,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
    fontSize: 15,
    lineHeight: 21,
  },
  charCount: { color: Academic.textSecondary, fontSize: 12, textAlign: 'right' },
  copiesRow: { flexDirection: 'row', gap: Spacing.two },
  copyButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
  },
  copyButtonActive: { backgroundColor: Academic.primary, borderColor: Academic.primary },
  copyText: { color: Academic.textSecondary, fontSize: 16, fontWeight: '900' },
  copyTextActive: { color: '#FFFFFF' },
  submitButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.primary,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  errorBox: { borderRadius: 14, padding: 12, backgroundColor: Academic.errorBg },
  errorText: { color: Academic.error, fontSize: 13, fontWeight: '800' },
  successBox: { borderRadius: 14, padding: 12, backgroundColor: Academic.successBg },
  successText: { color: Academic.success, fontSize: 13, fontWeight: '800' },
});
