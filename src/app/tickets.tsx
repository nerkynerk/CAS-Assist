import { useCallback, useEffect, useRef, useState } from 'react';
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

// ── Queue analytics ───────────────────────────────────────────
// Little's Law:  W = L / λ
//   L  — active tickets in the system
//   λ  — tickets opened in last 24 hours (arrival rate)
//   W  — expected wait (days); converted to minutes using
//         triangular distribution E(T) = (5 + 45 + 15) / 3 ≈ 21.67 min
// studentPosition — 1-based rank of the student's earliest open ticket

const EXEC_E = (5 + 45 + 15) / 3; // ≈ 21.67 min per ticket

interface QueueMetrics {
  L: number;
  lambda: number;
  W: number | null;
  position: number | null;
  estimatedMinutes: number | null;
}

async function computeQueueMetrics(userId: string): Promise<QueueMetrics> {
  const UNRESOLVED = ['open', 'in_progress', 'pending_review'];
  const since24h   = new Date(Date.now() - 86_400_000).toISOString();

  const [{ data: unresolved }, { count: lambda }] = await Promise.all([
    supabase
      .from('advising_ticket_pipeline')
      .select('id, student_id, created_at')
      .in('status', UNRESOLVED)
      .eq('state', 'active')
      .order('created_at', { ascending: true }),
    supabase
      .from('advising_ticket_pipeline')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h),
  ]);

  const L = unresolved?.length ?? 0;
  const lam = lambda ?? 0;
  const W = lam > 0 ? L / lam : null;

  // Student's 1-based position (earliest of their unresolved tickets)
  const studentTickets = (unresolved ?? []).filter(t => t.student_id === userId);
  let position: number | null = null;
  if (studentTickets.length > 0) {
    const idx = (unresolved ?? []).findIndex(t => t.id === studentTickets[0].id);
    position = idx + 1;
  }

  const estimatedMinutes = position !== null ? Math.round(EXEC_E * position) : null;

  return { L, lambda: lam, W, position, estimatedMinutes };
}

function QueueCard({
  userId,
  theme,
}: {
  userId: string;
  theme: ReturnType<typeof import('@/hooks/use-theme').useTheme>;
}) {
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    computeQueueMetrics(userId).then(m => {
      setMetrics(m);
      setLoading(false);
    });
  }, [userId]);

  if (loading) return <ActivityIndicator color="#208AEF" style={{ marginVertical: 8 }} />;
  if (!metrics || metrics.position === null) return null;

  const mins = metrics.estimatedMinutes ?? 0;
  const waitText = mins < 60
    ? `~${mins} min`
    : `~${Math.round(mins / 60)} hr`;

  return (
    <View style={[qStyles.card, { backgroundColor: '#208AEF' }]}>
      <View style={qStyles.row}>
        <View style={qStyles.stat}>
          <Text style={qStyles.statValue}>{metrics.position}</Text>
          <Text style={qStyles.statLabel}>Your position</Text>
        </View>
        <View style={qStyles.divider} />
        <View style={qStyles.stat}>
          <Text style={qStyles.statValue}>{waitText}</Text>
          <Text style={qStyles.statLabel}>Est. wait</Text>
        </View>
        <View style={qStyles.divider} />
        <View style={qStyles.stat}>
          <Text style={qStyles.statValue}>{metrics.L}</Text>
          <Text style={qStyles.statLabel}>Total queued</Text>
        </View>
      </View>
      <Text style={qStyles.sub}>
        Queue analytics · Little's Law  (λ={metrics.lambda}/day)
      </Text>
    </View>
  );
}

const qStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 26, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  divider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
});

const PRIMARY = '#208AEF';

// ── Types ─────────────────────────────────────────────────────

interface Ticket {
  id: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  open:           '#208AEF',
  in_progress:    '#F59E0B',
  pending_review: '#8B5CF6',
  resolved:       '#16A34A',
  closed:         '#6B7280',
};

const STATUS_LABEL: Record<string, string> = {
  open:           'Submitted',
  in_progress:    'Under Evaluation',
  pending_review: 'Action Required',
  resolved:       'Resolved',
  closed:         'Closed',
};

const CATEGORIES = [
  'General Inquiry',
  'Grades',
  'Document Request',
  'Others',
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Ticket card ───────────────────────────────────────────────

function TicketCard({
  ticket,
  bgEl,
  textColor,
  textSec,
}: {
  ticket: Ticket;
  bgEl: string;
  textColor: string;
  textSec: string;
}) {
  const statusColor = STATUS_COLOR[ticket.status] ?? '#6B7280';
  const statusLabel = STATUS_LABEL[ticket.status] ?? ticket.status;

  return (
    <View style={[styles.ticketCard, { backgroundColor: bgEl }]}>
      <View style={styles.ticketCardHeader}>
        <Text style={[styles.ticketCategory, { color: textColor }]}>{ticket.category}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={[styles.ticketDescription, { color: textSec }]} numberOfLines={2}>
        {ticket.description}
      </Text>
      <Text style={[styles.ticketDate, { color: textSec }]}>{formatDate(ticket.created_at)}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────

type View_ = 'list' | 'new';

export default function TicketsScreen() {
  const theme              = useTheme();
  const { profile, session } = useAuth();

  const [view, setView]         = useState<View_>('list');
  const [tickets, setTickets]   = useState<Ticket[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updateAlert, setUpdateAlert] = useState<string | null>(null);

  // New ticket form state
  const [category, setCategory]       = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);

  const userId    = profile?.id ?? session?.user.id;
  const fetchRef  = useRef<() => Promise<void>>();

  const fetchTickets = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('advising_ticket_pipeline')
      .select('id, category, description, status, priority, created_at')
      .eq('student_id', userId)
      .eq('state', 'active')
      .order('created_at', { ascending: false });

    setTickets(data ?? []);
  }, [userId]);

  useEffect(() => { fetchRef.current = fetchTickets; }, [fetchTickets]);

  async function load() {
    setLoading(true);
    await fetchTickets();
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  }

  // Real-time: watch the student's own tickets for status changes
  useEffect(() => {
    if (!userId) return;
    load();

    const channel = supabase
      .channel(`tickets-${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'advising_ticket_pipeline',
          filter: `student_id=eq.${userId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status;
          const label     = STATUS_LABEL[newStatus] ?? newStatus;
          setUpdateAlert(`Your ticket status changed to: ${label}`);
          setTimeout(() => setUpdateAlert(null), 4000);
          fetchRef.current?.();
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function handleSubmit() {
    setFormError(null);
    if (!category) { setFormError('Please select a category.'); return; }
    if (!description.trim()) { setFormError('Please describe your concern.'); return; }
    if (!userId) { setFormError('User session expired. Please sign in again.'); return; }

    setSubmitting(true);
    const { error } = await supabase
      .from('advising_ticket_pipeline')
      .insert({
        student_id:          userId,
        category:            category.toLowerCase().replace(/ /g, '_'),
        description:         description.trim(),
        priority:            'medium',
        status:              'open',
        file_attachment_urls: [],
      });

    setSubmitting(false);

    if (error) {
      setFormError('Failed to submit ticket. Please try again.');
    } else {
      setCategory('');
      setDescription('');
      setView('list');
      load();
    }
  }

  // ── New ticket form ──────────────────────────────────────────
  if (view === 'new') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}>

          {/* Form header */}
          <View style={styles.formHeader}>
            <Pressable onPress={() => setView('list')} style={styles.backBtn}>
              <Text style={[styles.backText, { color: PRIMARY }]}>← Back</Text>
            </Pressable>
            <Text style={[styles.screenTitle, { color: theme.text }]}>New Ticket</Text>
            <Text style={[styles.screenSub, { color: theme.textSecondary }]}>
              Describe your concern and our CAS staff will respond.
            </Text>
          </View>

          {formError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          )}

          {/* Category chips */}
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Category</Text>
          <View style={styles.chipGrid}>
            {CATEGORIES.map(c => {
              const active = category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? PRIMARY : theme.backgroundElement,
                      borderColor: active ? PRIMARY : 'transparent',
                    },
                  ]}>
                  <Text style={[styles.chipText, { color: active ? '#fff' : theme.textSecondary }]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Description */}
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Describe your concern
          </Text>
          <TextInput
            style={[styles.textarea, { backgroundColor: theme.backgroundElement, color: theme.text }]}
            placeholder="Please provide as much detail as possible..."
            placeholderTextColor={theme.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            maxLength={800}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: theme.textSecondary }]}>
            {description.length}/800
          </Text>

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              { opacity: pressed || submitting ? 0.75 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Ticket</Text>
            )}
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Ticket list ──────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}>

        {/* Real-time status update alert */}
        {updateAlert && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertText}>🔔  {updateAlert}</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.listHeader}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>My Tickets</Text>
          <Pressable
            style={[styles.newBtn, { backgroundColor: PRIMARY }]}
            onPress={() => setView('new')}>
            <Text style={styles.newBtnText}>+ New</Text>
          </Pressable>
        </View>

        {/* Queue analytics — only shown when student has active tickets */}
        {userId && tickets.some(t => ['open','in_progress','pending_review'].includes(t.status)) && (
          <QueueCard userId={userId} theme={theme} />
        )}

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={styles.loader} />
        ) : tickets.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
            <Text style={styles.emptyIcon}>🎫</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No tickets yet</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Submit a ticket and CAS staff will assist you.
            </Text>
          </View>
        ) : (
          tickets.map(t => (
            <TicketCard
              key={t.id}
              ticket={t}
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
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },

  // List header
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.two,
  },
  screenTitle: { fontSize: 24, fontWeight: '700' },
  screenSub: { fontSize: 14, marginTop: 4 },
  newBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  alertBanner: { backgroundColor: '#208AEF', borderRadius: 12, padding: 12 },
  alertText:   { color: '#fff', fontSize: 13, fontWeight: '600' },
  loader: { marginTop: Spacing.four },

  // Ticket card
  ticketCard: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: 6,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  ticketCategory: { fontSize: 15, fontWeight: '600', flex: 1 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  ticketDescription: { fontSize: 13, lineHeight: 18 },
  ticketDate: { fontSize: 11 },

  // Empty
  emptyCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.four,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center' },

  // Form
  formHeader: { gap: 6, paddingBottom: Spacing.two },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 15, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginTop: Spacing.two },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  textarea: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 140,
    marginTop: 6,
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 2 },
  submitBtn: {
    height: 52,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: '#DC2626', fontSize: 13 },
});
