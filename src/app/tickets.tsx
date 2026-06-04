import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  FloatingChatButton,
  IconButton,
  SectionHeader,
  StatusBadge,
  SurfaceCard,
  formatCategory,
  shortRef,
} from '@/components/ui/academic-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

const EXEC_E = (5 + 45 + 15) / 3;
const ACTIVE_STATUSES = ['open', 'in_progress', 'pending_review'];

interface QueueMetrics {
  L: number;
  lambda: number;
  W: number | null;
  position: number | null;
  estimatedMinutes: number | null;
}

interface Ticket {
  id: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
}

type RequestFilter = 'active' | 'completed' | 'all';
type ScreenView = 'list' | 'new';

const STATUS_LABEL: Record<string, string> = {
  open: 'In Queue',
  in_progress: 'Serving',
  pending_review: 'Pending',
  resolved: 'Completed',
  closed: 'Closed',
};

const STATUS_TONE: Record<string, 'blue' | 'warning' | 'success' | 'muted'> = {
  open: 'warning',
  in_progress: 'blue',
  pending_review: 'warning',
  resolved: 'success',
  closed: 'muted',
};

const CATEGORIES = [
  'General Inquiry',
  'Grades',
  'Document Request',
  'Others',
];

async function computeQueueMetrics(userId: string): Promise<QueueMetrics> {
  const since24h = new Date(Date.now() - 86_400_000).toISOString();

  const [{ data: unresolved }, { count: lambda }] = await Promise.all([
    supabase
      .from('advising_ticket_pipeline')
      .select('id, student_id, created_at')
      .in('status', ACTIVE_STATUSES)
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
  const studentTickets = (unresolved ?? []).filter(t => t.student_id === userId);
  let position: number | null = null;

  if (studentTickets.length > 0) {
    const idx = (unresolved ?? []).findIndex(t => t.id === studentTickets[0].id);
    position = idx + 1;
  }

  const estimatedMinutes = position !== null ? Math.round(EXEC_E * position) : null;
  return { L, lambda: lam, W, position, estimatedMinutes };
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function CurrentTicketCard({
  ticket,
  metrics,
}: {
  ticket: Ticket;
  metrics: QueueMetrics | null;
}) {
  const minutes = metrics?.estimatedMinutes;

  return (
    <View style={styles.currentTicketCard}>
      <View style={styles.currentText}>
        <Text style={styles.currentLabel}>Current Active Ticket</Text>
        <View style={styles.currentRefRow}>
          <Text style={styles.currentRef}>{shortRef(ticket.id)}</Text>
          <View style={styles.currentCategoryPill}>
            <Text style={styles.currentCategoryText}>{formatCategory(ticket.category)}</Text>
          </View>
        </View>
        <View style={styles.currentStats}>
          <View>
            <Text style={styles.currentStatLabel}>Students ahead</Text>
            <Text style={styles.currentStatValue}>
              {metrics?.position ? Math.max(metrics.position - 1, 0) : '--'}
            </Text>
          </View>
          <View>
            <Text style={styles.currentStatLabel}>Est. wait</Text>
            <Text style={styles.currentStatValue}>
              {minutes ? `${minutes} min` : '--'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.currentClock}>
        <AcademicIcon
          name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
          color="rgba(255,255,255,0.24)"
          size={72}
        />
      </View>
    </View>
  );
}

function RequestListCard({ ticket }: { ticket: Ticket }) {
  const isComplete = ['resolved', 'closed'].includes(ticket.status);
  const tone = STATUS_TONE[ticket.status] ?? 'muted';

  return (
    <SurfaceCard style={styles.requestCard}>
      <View style={[styles.requestIcon, isComplete && styles.requestIconDone]}>
        <AcademicIcon
          name={
            isComplete
              ? { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }
              : ticket.status === 'in_progress'
                ? { ios: 'clock', android: 'schedule', web: 'schedule' }
                : { ios: 'doc.text', android: 'description', web: 'description' }
          }
          color={isComplete ? Academic.success : Academic.primary}
          size={22}
        />
      </View>
      <View style={styles.requestCardBody}>
        <View style={styles.requestMetaRow}>
          <Text style={styles.requestRef}>{shortRef(ticket.id)}</Text>
          <StatusBadge label={STATUS_LABEL[ticket.status] ?? ticket.status} tone={tone} />
        </View>
        <Text style={styles.requestTitle} numberOfLines={1}>{formatCategory(ticket.category)}</Text>
        <Text style={styles.requestDate} numberOfLines={1}>
          {isComplete ? 'Completed' : 'Submitted'}: {formatDateTime(ticket.created_at)}
        </Text>
      </View>
      <AcademicIcon
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        color="#C4CFDD"
        size={18}
      />
    </SurfaceCard>
  );
}

function NewTicketForm({
  onBack,
  onSubmitted,
  userId,
}: {
  onBack: () => void;
  onSubmitted: () => Promise<void>;
  userId: string | undefined;
}) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit() {
    setFormError(null);
    if (!category) { setFormError('Please select a category.'); return; }
    if (!description.trim()) { setFormError('Please describe your concern.'); return; }
    if (!userId) { setFormError('User session expired. Please sign in again.'); return; }

    setSubmitting(true);
    const { error } = await supabase
      .from('advising_ticket_pipeline')
      .insert({
        student_id: userId,
        category: category.toLowerCase().replace(/ /g, '_'),
        description: description.trim(),
        priority: 'medium',
        status: 'open',
        file_attachment_urls: [],
      });
    setSubmitting(false);

    if (error) {
      setFormError('Failed to submit request. Please try again.');
    } else {
      setCategory('');
      setDescription('');
      await onSubmitted();
      onBack();
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.pageHeader}>
          <IconButton
            icon={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            onPress={onBack}
            label="Back to requests"
            bg={Academic.muted}
            color={Academic.textSecondary}
          />
          <Text style={styles.pageTitle}>New Request</Text>
        </View>

        {formError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        <SectionHeader title="Request Type" />
        <View style={styles.chipGrid}>
          {CATEGORIES.map(c => {
            const active = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.choiceChip, active && styles.choiceChipActive]}>
                <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionHeader title="Details" />
        <TextInput
          style={styles.textarea}
          placeholder="Please provide as much detail as possible..."
          placeholderTextColor={Academic.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          maxLength={800}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{description.length}/800</Text>

        <Pressable
          style={({ pressed }) => [styles.submitButton, (pressed || submitting) && styles.pressed]}
          onPress={handleSubmit}
          disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Request</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function TicketsScreen() {
  const { profile, session } = useAuth();
  const [view, setView] = useState<ScreenView>('list');
  const [filter, setFilter] = useState<RequestFilter>('active');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updateAlert, setUpdateAlert] = useState<string | null>(null);

  const userId = profile?.id ?? session?.user.id;
  const fetchRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const fetchTickets = useCallback(async () => {
    if (!userId) return;
    const [{ data }, queueMetrics] = await Promise.all([
      supabase
        .from('advising_ticket_pipeline')
        .select('id, category, description, status, priority, created_at')
        .eq('student_id', userId)
        .eq('state', 'active')
        .order('created_at', { ascending: false }),
      computeQueueMetrics(userId),
    ]);

    setTickets(data ?? []);
    setMetrics(queueMetrics);
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

  useEffect(() => {
    if (!userId) return;
    load();

    const channel = supabase
      .channel(`tickets-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'advising_ticket_pipeline',
          filter: `student_id=eq.${userId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status;
          setUpdateAlert(`Your request is now ${STATUS_LABEL[newStatus] ?? newStatus}.`);
          setTimeout(() => setUpdateAlert(null), 4000);
          fetchRef.current?.();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const activeTickets = tickets.filter(t => ACTIVE_STATUSES.includes(t.status));
  const currentTicket = activeTickets[0];

  const visibleTickets = useMemo(() => {
    if (filter === 'active') return tickets.filter(t => ACTIVE_STATUSES.includes(t.status));
    if (filter === 'completed') return tickets.filter(t => ['resolved', 'closed'].includes(t.status));
    return tickets;
  }, [filter, tickets]);

  if (view === 'new') {
    return (
      <NewTicketForm
        onBack={() => setView('list')}
        onSubmitted={fetchTickets}
        userId={userId}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Academic.primary} />}
        contentContainerStyle={styles.scroll}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>My Requests</Text>
          <IconButton
            icon={{ ios: 'plus', android: 'add', web: 'add' }}
            onPress={() => setView('new')}
            label="Create request"
          />
        </View>

        {updateAlert ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>{updateAlert}</Text>
          </View>
        ) : null}

        <View style={styles.segmented}>
          {(['active', 'completed', 'all'] as const).map(item => {
            const active = filter === item;
            return (
              <Pressable
                key={item}
                onPress={() => setFilter(item)}
                style={[styles.segment, active && styles.segmentActive]}>
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {currentTicket ? (
          <CurrentTicketCard ticket={currentTicket} metrics={metrics} />
        ) : null}

        {loading ? (
          <ActivityIndicator color={Academic.primary} style={styles.loader} />
        ) : visibleTickets.length === 0 ? (
          <EmptyState
            title={filter === 'active' ? 'No active requests' : 'No requests found'}
            message={filter === 'active'
              ? 'Submitted requests that are still being processed will appear here.'
              : 'Try another filter or create a new request.'}
            icon={{ ios: 'tray', android: 'inbox', web: 'inbox' }}
          />
        ) : (
          visibleTickets.map(ticket => <RequestListCard key={ticket.id} ticket={ticket} />)
        )}
      </ScrollView>
      <FloatingChatButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Academic.background },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: 152,
    gap: Spacing.three,
  },
  pressed: { opacity: 0.72 },
  pageHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  pageTitle: { color: Academic.navy, fontSize: 26, fontWeight: '900' },
  infoBanner: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: Academic.softBlue,
  },
  infoBannerText: { color: Academic.primary, fontSize: 13, fontWeight: '700' },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#E9EEF6',
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: Academic.card,
    boxShadow: '0 1px 4px rgba(16, 33, 62, 0.15)',
  },
  segmentText: { color: Academic.textSecondary, fontSize: 14, fontWeight: '800' },
  segmentTextActive: { color: Academic.navy },
  currentTicketCard: {
    minHeight: 164,
    borderRadius: 16,
    padding: Spacing.four,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Academic.primary,
  },
  currentText: { flex: 1, gap: 8 },
  currentLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  currentRefRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  currentRef: { color: '#FFFFFF', fontSize: 40, lineHeight: 44, fontWeight: '900' },
  currentCategoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  currentCategoryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  currentStats: { flexDirection: 'row', gap: Spacing.four, marginTop: 2 },
  currentStatLabel: { color: '#FFFFFF', opacity: 0.92, fontSize: 12, fontWeight: '700' },
  currentStatValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  currentClock: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 7,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  requestIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.muted,
  },
  requestIconDone: { backgroundColor: Academic.successBg },
  requestCardBody: { flex: 1, gap: 3 },
  requestMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  requestRef: { color: Academic.primary, fontSize: 13, fontWeight: '900' },
  requestTitle: { color: Academic.navy, fontSize: 15, fontWeight: '900' },
  requestDate: { color: Academic.textSecondary, fontSize: 13 },
  loader: { marginTop: Spacing.four },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
  },
  choiceChipActive: { backgroundColor: Academic.primary, borderColor: Academic.primary },
  choiceChipText: { color: Academic.textSecondary, fontSize: 13, fontWeight: '800' },
  choiceChipTextActive: { color: '#FFFFFF' },
  textarea: {
    minHeight: 150,
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
    color: Academic.navy,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
  },
  charCount: { color: Academic.textSecondary, fontSize: 12, textAlign: 'right' },
  submitButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.primary,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  errorBox: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: Academic.errorBg,
  },
  errorText: { color: Academic.error, fontSize: 13, fontWeight: '700' },
});
