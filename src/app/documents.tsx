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

import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const PRIMARY = '#8B5CF6';

// ── Types ─────────────────────────────────────────────────────

interface DocumentRequest {
  id: string;
  document_type: string;
  purpose: string;
  copies: number;
  status: string;
  remarks: string | null;
  requested_at: string;
}

// ── Constants ─────────────────────────────────────────────────

const DOC_TYPES: { value: string; label: string; description: string }[] = [
  { value: 'transcript_of_records',      label: 'Transcript of Records',      description: 'Official academic record of grades' },
  { value: 'certificate_of_enrollment',  label: 'Certificate of Enrollment',   description: 'Proof of current enrollment' },
  { value: 'certificate_of_good_moral',  label: 'Certificate of Good Moral',   description: 'Character reference certificate' },
  { value: 'honorable_dismissal',        label: 'Honorable Dismissal',         description: 'Transfer clearance document' },
  { value: 'diploma',                    label: 'Diploma',                     description: 'Graduation certificate' },
  { value: 'other',                      label: 'Other',                       description: 'Other document not listed above' },
];

const STATUS_COLOR: Record<string, string> = {
  submitted:         '#208AEF',
  under_evaluation:  '#F59E0B',
  action_required:   '#EF4444',
  processing:        '#8B5CF6',
  ready_for_pickup:  '#10B981',
  completed:         '#16A34A',
  rejected:          '#DC2626',
};

const STATUS_LABEL: Record<string, string> = {
  submitted:         'Submitted',
  under_evaluation:  'Under Evaluation',
  action_required:   'Action Required',
  processing:        'Processing',
  ready_for_pickup:  'Ready for Pickup',
  completed:         'Completed',
  rejected:          'Rejected',
};

const DOC_LABEL: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map(d => [d.value, d.label])
);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Request card ──────────────────────────────────────────────

function RequestCard({
  item,
  bgEl,
  textColor,
  textSec,
}: {
  item: DocumentRequest;
  bgEl: string;
  textColor: string;
  textSec: string;
}) {
  const sc = STATUS_COLOR[item.status] ?? '#6B7280';
  return (
    <View style={[styles.card, { backgroundColor: bgEl }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.docType, { color: textColor }]}>
          {DOC_LABEL[item.document_type] ?? item.document_type}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: sc + '20' }]}>
          <Text style={[styles.statusText, { color: sc }]}>
            {STATUS_LABEL[item.status] ?? item.status}
          </Text>
        </View>
      </View>

      <Text style={[styles.cardDetail, { color: textSec }]}>
        Purpose: {item.purpose}
      </Text>
      <Text style={[styles.cardDetail, { color: textSec }]}>
        Copies: {item.copies}
      </Text>

      {item.remarks && (
        <View style={[styles.remarksBox, { backgroundColor: sc + '12' }]}>
          <Text style={[styles.remarksLabel, { color: sc }]}>Staff note:</Text>
          <Text style={[styles.remarksText, { color: textColor }]}>{item.remarks}</Text>
        </View>
      )}

      <Text style={[styles.cardDate, { color: textSec }]}>
        Requested {formatDate(item.requested_at)}
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────

type ScreenView = 'list' | 'new';

export default function DocumentsScreen() {
  const theme              = useTheme();
  const { profile, session } = useAuth();

  const [view, setView]           = useState<ScreenView>('list');
  const [requests, setRequests]   = useState<DocumentRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [docType, setDocType]       = useState('');
  const [purpose, setPurpose]       = useState('');
  const [copies, setCopies]         = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
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
      student_id:    userId,
      document_type: docType,
      purpose:       purpose.trim(),
      copies,
      status:        'submitted',
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
      setTimeout(() => { setFormSuccess(false); setView('list'); }, 1800);
    }
  }

  // ── New request form ─────────────────────────────────────────
  if (view === 'new') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}>

          <Pressable onPress={() => setView('list')} style={styles.backBtn}>
            <Text style={[styles.backText, { color: PRIMARY }]}>← Back</Text>
          </Pressable>

          <Text style={[styles.screenTitle, { color: theme.text }]}>Request a Document</Text>
          <Text style={[styles.screenSub, { color: theme.textSecondary }]}>
            Processing takes 3–5 working days. You will be notified when ready.
          </Text>

          {formError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          )}
          {formSuccess && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>✓  Request submitted successfully!</Text>
            </View>
          )}

          {/* Document type selection */}
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Document Type</Text>
          <View style={styles.docTypeGrid}>
            {DOC_TYPES.map(d => {
              const active = docType === d.value;
              return (
                <Pressable
                  key={d.value}
                  onPress={() => setDocType(d.value)}
                  style={[
                    styles.docTypeCard,
                    {
                      backgroundColor: active ? PRIMARY + '15' : theme.backgroundElement,
                      borderColor:     active ? PRIMARY : 'transparent',
                      borderWidth:     active ? 1.5 : 0,
                    },
                  ]}>
                  <Text style={[styles.docTypeLabel, { color: active ? PRIMARY : theme.text }]}>
                    {d.label}
                  </Text>
                  <Text style={[styles.docTypeDesc, { color: theme.textSecondary }]}>
                    {d.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Purpose */}
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Purpose</Text>
          <TextInput
            style={[styles.textarea, { backgroundColor: theme.backgroundElement, color: theme.text }]}
            placeholder="e.g. For scholarship application, employment requirements..."
            placeholderTextColor={theme.textSecondary}
            value={purpose}
            onChangeText={setPurpose}
            multiline
            numberOfLines={4}
            maxLength={300}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: theme.textSecondary }]}>
            {purpose.length}/300
          </Text>

          {/* Copies */}
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Number of Copies
          </Text>
          <View style={styles.copiesRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable
                key={n}
                onPress={() => setCopies(n)}
                style={[
                  styles.copyBtn,
                  { backgroundColor: copies === n ? PRIMARY : theme.backgroundElement },
                ]}>
                <Text style={[styles.copyBtnText, { color: copies === n ? '#fff' : theme.textSecondary }]}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              { backgroundColor: PRIMARY, opacity: pressed || submitting ? 0.75 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Request</Text>
            )}
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Request list ─────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}>

        <View style={styles.listHeader}>
          <View>
            <Text style={[styles.screenTitle, { color: theme.text }]}>My Documents</Text>
            <Text style={[styles.screenSub, { color: theme.textSecondary }]}>
              Track your document requests
            </Text>
          </View>
          <Pressable
            style={[styles.newBtn, { backgroundColor: PRIMARY }]}
            onPress={() => setView('new')}>
            <Text style={styles.newBtnText}>+ New</Text>
          </Pressable>
        </View>

        {/* Status legend */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendRow}>
          {['submitted', 'under_evaluation', 'processing', 'ready_for_pickup', 'completed'].map(s => (
            <View key={s} style={[styles.legendPill, { backgroundColor: STATUS_COLOR[s] + '20' }]}>
              <Text style={[styles.legendText, { color: STATUS_COLOR[s] }]}>
                {STATUS_LABEL[s]}
              </Text>
            </View>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={styles.loader} />
        ) : requests.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No requests yet</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Tap "+ New" to request an official document from CAS.
            </Text>
          </View>
        ) : (
          requests.map(r => (
            <RequestCard
              key={r.id}
              item={r}
              bgEl={theme.backgroundElement}
              textColor={theme.text}
              textSec={theme.textSecondary}
            />
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 100,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: Spacing.one,
  },
  screenTitle: { fontSize: 24, fontWeight: '700' },
  screenSub:   { fontSize: 13, marginTop: 2 },
  newBtn:      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  newBtnText:  { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Legend
  legendRow: { marginBottom: 4 },
  legendPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginRight: 6 },
  legendText: { fontSize: 11, fontWeight: '600' },

  // Cards
  card:        { borderRadius: 16, padding: Spacing.three, gap: 6 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  docType:     { fontSize: 16, fontWeight: '700', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:  { fontSize: 11, fontWeight: '600' },
  cardDetail:  { fontSize: 13 },
  remarksBox:  { borderRadius: 8, padding: 10, gap: 2 },
  remarksLabel:{ fontSize: 11, fontWeight: '700' },
  remarksText: { fontSize: 13 },
  cardDate:    { fontSize: 11, marginTop: 2 },

  // Empty
  loader:     { marginTop: Spacing.four },
  emptyCard:  { borderRadius: 16, padding: 32, alignItems: 'center', gap: 8, marginTop: Spacing.four },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText:  { fontSize: 14, textAlign: 'center' },

  // Form
  backBtn:  { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 15, fontWeight: '600' },

  docTypeGrid: { gap: 8 },
  docTypeCard: {
    borderRadius: 14,
    padding: 14,
    gap: 3,
  },
  docTypeLabel: { fontSize: 15, fontWeight: '600' },
  docTypeDesc:  { fontSize: 12 },

  fieldLabel: { fontSize: 13, fontWeight: '500', marginTop: Spacing.one },
  textarea:   { borderRadius: 12, padding: 14, fontSize: 15, minHeight: 100 },
  charCount:  { fontSize: 11, textAlign: 'right', marginTop: 2 },

  copiesRow: { flexDirection: 'row', gap: 10 },
  copyBtn:   { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copyBtnText: { fontSize: 16, fontWeight: '700' },

  submitBtn:     { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.two },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  errorBox:   { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12 },
  errorText:  { color: '#DC2626', fontSize: 13 },
  successBox: { backgroundColor: '#DCFCE7', borderRadius: 10, padding: 12 },
  successText:{ color: '#16A34A', fontSize: 13, fontWeight: '500' },
});
