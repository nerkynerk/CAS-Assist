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

import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const GREEN = '#16A34A';

interface TicketRow {
  id: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
  student_id: { display_name: string; email: string } | null;
}

const STATUS_COLOR: Record<string, string> = {
  open: '#208AEF', in_progress: '#F59E0B', pending_review: '#8B5CF6', resolved: '#16A34A', closed: '#6B7280',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Submitted', in_progress: 'Evaluating', pending_review: 'Action Required', resolved: 'Resolved', closed: 'Closed',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

interface StatCardProps { label: string; value: number; color: string; }
function StatCard({ label, value, color }: StatCardProps) {
  const theme = require('@/hooks/use-theme').useTheme();
  return (
    <View style={[statStyles.card, { backgroundColor: color + '15' }]}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}
const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  value: { fontSize: 28, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
});

export default function StaffDashboard() {
  const theme  = useTheme();
  const router = useRouter();
  const { profile } = useAuth();

  const [counts, setCounts]   = useState<Record<string, number>>({});
  const [urgent, setUrgent]   = useState<TicketRow[]>([]);
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
    for (const t of (allTickets.data ?? [])) {
      c[t.status] = (c[t.status] ?? 0) + 1;
    }
    setCounts(c);
    setUrgent((urgentTickets.data as unknown as TicketRow[]) ?? []);
  }

  async function load() { setLoading(true); await fetchData(); setLoading(false); }
  async function onRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false); }
  useEffect(() => { load(); }, []);

  const firstName = profile?.display_name?.split(' ')[0] ?? 'there';
  const total = Object.values(counts).reduce((s, v) => s + v, 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>{getGreeting()},</Text>
            <Text style={[styles.name, { color: theme.text }]}>{firstName}</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: GREEN + '20' }]}>
            <Text style={[styles.badgeText, { color: GREEN }]}>Staff</Text>
          </View>
          <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>{total} total tickets</Text>
        </View>

        {/* Stats */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Ticket Overview</Text>
        {loading ? (
          <ActivityIndicator color={GREEN} style={styles.loader} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard label="Submitted" value={counts.open ?? 0} color="#208AEF" />
              <StatCard label="Evaluating" value={counts.in_progress ?? 0} color="#F59E0B" />
            </View>
            <View style={styles.statsRow}>
              <StatCard label="Action Req." value={counts.pending_review ?? 0} color="#8B5CF6" />
              <StatCard label="Resolved" value={counts.resolved ?? 0} color="#16A34A" />
            </View>
          </>
        )}

        {/* Quick actions */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
        <View style={styles.quickRow}>
          {[
            { label: 'Manage Tickets', icon: '🎫', color: '#208AEF', nav: () => router.navigate('/admin') },
            { label: 'Post Announcement', icon: '📢', color: GREEN, nav: () => router.navigate('/admin') },
            { label: 'View Users', icon: '👥', color: '#8B5CF6', nav: () => router.navigate('/admin') },
            { label: 'Ask AI', icon: '🤖', color: '#F59E0B', nav: () => router.navigate('/chatbot') },
          ].map(a => (
            <Pressable key={a.label} onPress={a.nav} style={({ pressed }) => [styles.quickCard, { backgroundColor: a.color + '15', opacity: pressed ? 0.7 : 1 }]}>
              <Text style={styles.quickIcon}>{a.icon}</Text>
              <Text style={[styles.quickLabel, { color: a.color }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Tickets needing attention */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Needs Attention</Text>
        {urgent.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>🎉  All tickets are up to date.</Text>
          </View>
        ) : (
          urgent.map(t => {
            const sc = STATUS_COLOR[t.status] ?? '#6B7280';
            const student = t.student_id;
            return (
              <Pressable key={t.id} onPress={() => router.navigate('/admin')} style={[styles.ticketCard, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.ticketTop}>
                  <Text style={[styles.ticketCategory, { color: theme.text }]}>{t.category}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: sc + '20' }]}>
                    <Text style={[styles.statusText, { color: sc }]}>{STATUS_LABEL[t.status] ?? t.status}</Text>
                  </View>
                </View>
                {student && <Text style={[styles.ticketStudent, { color: theme.textSecondary }]}>{student.display_name} · {student.email}</Text>}
                <Text style={[styles.ticketDesc, { color: theme.textSecondary }]} numberOfLines={1}>{t.description}</Text>
                <Text style={[styles.ticketDate, { color: theme.textSecondary }]}>{formatDate(t.created_at)}</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.three, paddingBottom: 100, gap: Spacing.two },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: Spacing.three, paddingBottom: Spacing.one },
  greeting: { fontSize: 14 },
  name: { fontSize: 24, fontWeight: '700', marginTop: 2 },
  signOutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginTop: 4 },
  signOutText: { fontSize: 13 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  totalLabel: { fontSize: 13 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: Spacing.one },
  statsRow: { flexDirection: 'row', gap: 12 },
  loader: { marginTop: Spacing.four },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: { width: '47%', borderRadius: 14, padding: 16, gap: 8 },
  quickIcon: { fontSize: 24 },
  quickLabel: { fontSize: 14, fontWeight: '600' },
  emptyCard: { borderRadius: 12, padding: Spacing.three, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  ticketCard: { borderRadius: 14, padding: Spacing.three, gap: 4 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketCategory: { fontSize: 15, fontWeight: '600', flex: 1 },
  ticketStudent: { fontSize: 12 },
  ticketDesc: { fontSize: 13 },
  ticketDate: { fontSize: 11 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '600' },
});
