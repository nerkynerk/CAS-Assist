import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Academic,
  AcademicIcon,
  EmptyState,
  MetricCard,
  RoleHeroHeader,
  SectionHeader,
  StatusBadge,
  SurfaceCard,
  formatCategory,
  shortRef,
} from '@/components/ui/academic-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

interface TicketRow {
  id: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
  student_id: { display_name: string; email: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Submitted',
  in_progress: 'Serving',
  pending_review: 'Action Required',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_TONE: Record<string, 'blue' | 'warning' | 'success' | 'muted'> = {
  open: 'warning',
  in_progress: 'blue',
  pending_review: 'warning',
  resolved: 'success',
  closed: 'muted',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function OperationsAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: Parameters<typeof AcademicIcon>[0]['name'];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
      <View style={styles.actionIcon}>
        <AcademicIcon name={icon} color={Academic.primary} size={22} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function StaffDashboard() {
  const router = useRouter();
  const { profile } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [urgent, setUrgent] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    const [allTickets, urgentTickets] = await Promise.all([
      supabase
        .from('advising_ticket_pipeline')
        .select('status')
        .eq('state', 'active'),
      supabase
        .from('advising_ticket_pipeline')
        .select('id, category, description, status, created_at, student_id(display_name, email)')
        .in('status', ['open', 'pending_review'])
        .eq('state', 'active')
        .order('created_at', { ascending: true })
        .limit(5),
    ]);

    const c: Record<string, number> = {};
    for (const ticket of (allTickets.data ?? [])) {
      c[ticket.status] = (c[ticket.status] ?? 0) + 1;
    }
    setCounts(c);
    setUrgent((urgentTickets.data as unknown as TicketRow[]) ?? []);
  }

  async function load() {
    setLoading(true);
    await fetchData();
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  const firstName = profile?.display_name?.split(' ')[0] ?? 'there';
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Academic.primary} />}
        contentContainerStyle={styles.scroll}>
        <RoleHeroHeader
          label="CAS Assist Staff"
          title={`Hello, ${firstName}`}
          subtitle="Monitor daily CAS support operations."
        />

        {loading ? (
          <ActivityIndicator color={Academic.primary} style={styles.loader} />
        ) : (
          <>
            <View style={styles.metricsRow}>
              <MetricCard
                label="Waiting requests"
                value={counts.open ?? 0}
                icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
                tone="warning"
              />
              <MetricCard
                label="Currently serving"
                value={counts.in_progress ?? 0}
                icon={{ ios: 'person.2', android: 'groups', web: 'groups' }}
                tone="blue"
              />
            </View>
            <View style={styles.metricsRow}>
              <MetricCard
                label="Action required"
                value={counts.pending_review ?? 0}
                icon={{ ios: 'exclamationmark.circle', android: 'priority_high', web: 'priority_high' }}
                tone="error"
              />
              <MetricCard
                label="Completed"
                value={(counts.resolved ?? 0) + (counts.closed ?? 0)}
                icon={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }}
                tone="success"
              />
            </View>
          </>
        )}

        <SectionHeader title="Operations" action={`${total} active`} onAction={() => router.navigate('/admin')} />
        <View style={styles.actionGrid}>
          <OperationsAction
            label="Manage Queue"
            icon={{ ios: 'list.bullet', android: 'format_list_bulleted', web: 'format_list_bulleted' }}
            onPress={() => router.navigate('/admin')}
          />
          <OperationsAction
            label="Post Update"
            icon={{ ios: 'megaphone', android: 'campaign', web: 'campaign' }}
            onPress={() => router.navigate('/admin')}
          />
          <OperationsAction
            label="Document Requests"
            icon={{ ios: 'doc.text', android: 'description', web: 'description' }}
            onPress={() => router.navigate('/admin')}
          />
          <OperationsAction
            label="Helpdesk"
            icon={{ ios: 'message', android: 'chat_bubble', web: 'chat_bubble' }}
            onPress={() => router.navigate('/chatbot')}
          />
        </View>

        <SectionHeader title="Needs Attention" />
        {urgent.length === 0 ? (
          <EmptyState
            title="All queues are current"
            message="No submitted or pending-review tickets need immediate staff action."
            icon={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }}
          />
        ) : (
          urgent.map(ticket => {
            const student = ticket.student_id;
            return (
              <Pressable key={ticket.id} onPress={() => router.navigate('/admin')}>
                <SurfaceCard style={styles.ticketCard} accent={ticket.status === 'pending_review' ? 'warning' : 'blue'}>
                  <View style={styles.ticketTop}>
                    <View style={styles.ticketIcon}>
                      <AcademicIcon
                        name={{ ios: 'doc.text', android: 'assignment', web: 'assignment' }}
                        color={Academic.primary}
                        size={20}
                      />
                    </View>
                    <View style={styles.ticketBody}>
                      <View style={styles.ticketMeta}>
                        <Text style={styles.ticketRef}>{shortRef(ticket.id)}</Text>
                        <StatusBadge
                          label={STATUS_LABEL[ticket.status] ?? ticket.status}
                          tone={STATUS_TONE[ticket.status] ?? 'muted'}
                        />
                      </View>
                      <Text style={styles.ticketTitle} numberOfLines={1}>{formatCategory(ticket.category)}</Text>
                      {student ? (
                        <Text style={styles.ticketStudent} numberOfLines={1}>
                          {student.display_name} - {student.email}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.ticketDesc} numberOfLines={2}>{ticket.description}</Text>
                  <Text style={styles.ticketDate}>{formatDate(ticket.created_at)}</Text>
                </SurfaceCard>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
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
  loader: { marginTop: Spacing.four },
  metricsRow: { flexDirection: 'row', gap: Spacing.three },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  actionCard: {
    width: '48%',
    minHeight: 88,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.softBlue,
  },
  actionLabel: { color: Academic.navy, fontSize: 13, lineHeight: 17, fontWeight: '900' },
  ticketCard: { gap: 10 },
  ticketTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ticketIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.softBlue,
  },
  ticketBody: { flex: 1, gap: 3 },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ticketRef: { color: Academic.primary, fontSize: 13, fontWeight: '900' },
  ticketTitle: { color: Academic.navy, fontSize: 15, fontWeight: '900' },
  ticketStudent: { color: Academic.textSecondary, fontSize: 12 },
  ticketDesc: { color: Academic.textSecondary, fontSize: 13, lineHeight: 18 },
  ticketDate: { color: Academic.textSecondary, fontSize: 12, fontWeight: '700' },
});
