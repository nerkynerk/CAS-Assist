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

const RED = '#DC2626';

interface RecentUser {
  id: string;
  display_name: string;
  email: string;
  role: string;
  created_at: string;
}

const ROLE_COLOR: Record<string, string> = {
  student: '#208AEF', faculty: '#8B5CF6', staff: '#16A34A', super_admin: '#DC2626',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface StatTileProps { icon: string; label: string; value: number; color: string; }
function StatTile({ icon, label, value, color }: StatTileProps) {
  const theme = require('@/hooks/use-theme').useTheme();
  return (
    <View style={[tileStyles.tile, { backgroundColor: color + '12' }]}>
      <Text style={tileStyles.icon}>{icon}</Text>
      <Text style={[tileStyles.value, { color }]}>{value}</Text>
      <Text style={[tileStyles.label, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}
const tileStyles = StyleSheet.create({
  tile: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  icon: { fontSize: 22 },
  value: { fontSize: 26, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
});

export default function AdminDashboardHome() {
  const theme  = useTheme();
  const router = useRouter();
  const { profile } = useAuth();

  const [stats, setStats]     = useState({ users: 0, openTickets: 0, actionReq: 0, announcements: 0 });
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    const [userCount, ticketData, actionCount, annCount, latestUsers] = await Promise.all([
      supabase.from('users_account_registry').select('id', { count: 'exact', head: true }),
      supabase.from('advising_ticket_pipeline').select('status').eq('state', 'active'),
      supabase.from('advising_ticket_pipeline').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
      supabase.from('announcements').select('id', { count: 'exact', head: true }).eq('state', 'active'),
      supabase.from('users_account_registry').select('id, display_name, email, role, created_at').order('created_at', { ascending: false }).limit(5),
    ]);

    const openCount = (ticketData.data ?? []).filter(t => t.status === 'open').length;

    setStats({
      users:         userCount.count ?? 0,
      openTickets:   openCount,
      actionReq:     actionCount.count ?? 0,
      announcements: annCount.count ?? 0,
    });
    setRecentUsers(latestUsers.data ?? []);
  }

  async function load() { setLoading(true); await fetchData(); setLoading(false); }
  async function onRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false); }
  useEffect(() => { load(); }, []);

  const firstName = profile?.display_name?.split(' ')[0] ?? 'there';

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
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{profile?.email}</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: RED + '20' }]}>
            <Text style={[styles.badgeText, { color: RED }]}>Super Admin</Text>
          </View>
        </View>

        {/* System stats */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>System Overview</Text>
        {loading ? (
          <ActivityIndicator color={RED} style={styles.loader} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatTile icon="👥" label="Total Users" value={stats.users} color="#208AEF" />
              <StatTile icon="🎫" label="Open Tickets" value={stats.openTickets} color="#F59E0B" />
            </View>
            <View style={styles.statsRow}>
              <StatTile icon="⚠️" label="Action Required" value={stats.actionReq} color="#8B5CF6" />
              <StatTile icon="📢" label="Announcements" value={stats.announcements} color="#16A34A" />
            </View>
          </>
        )}

        {/* Quick actions */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Admin Actions</Text>
        <View style={styles.adminGrid}>
          {[
            { label: 'Manage Tickets', icon: '🎫', color: '#208AEF', nav: () => router.navigate('/admin') },
            { label: 'Post Announcement', icon: '📢', color: '#16A34A', nav: () => router.navigate('/admin') },
            { label: 'Manage Users', icon: '👥', color: '#8B5CF6', nav: () => router.navigate('/admin') },
            { label: 'Ask AI', icon: '🤖', color: '#F59E0B', nav: () => router.navigate('/chatbot') },
          ].map(a => (
            <Pressable
              key={a.label}
              onPress={a.nav}
              style={({ pressed }) => [styles.adminCard, { backgroundColor: a.color, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={styles.adminIcon}>{a.icon}</Text>
              <Text style={styles.adminLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Recently registered users */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recently Registered</Text>
        {recentUsers.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No users registered yet.</Text>
          </View>
        ) : (
          recentUsers.map(u => {
            const rc = ROLE_COLOR[u.role] ?? '#6B7280';
            return (
              <View key={u.id} style={[styles.userCard, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.userLeft}>
                  <Text style={[styles.userName, { color: theme.text }]}>{u.display_name}</Text>
                  <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{u.email}</Text>
                  <Text style={[styles.userDate, { color: theme.textSecondary }]}>Joined {formatDate(u.created_at)}</Text>
                </View>
                <View style={[styles.rolePill, { backgroundColor: rc + '20' }]}>
                  <Text style={[styles.rolePillText, { color: rc }]}>{u.role}</Text>
                </View>
              </View>
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
  subtitle: { fontSize: 13, marginTop: 2 },
  signOutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginTop: 4 },
  signOutText: { fontSize: 13 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: Spacing.one },
  statsRow: { flexDirection: 'row', gap: 12 },
  loader: { marginTop: Spacing.four },
  adminGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  adminCard: { width: '47%', borderRadius: 16, padding: Spacing.three, gap: 8, aspectRatio: 1.5, justifyContent: 'flex-end' },
  adminIcon: { fontSize: 28 },
  adminLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptyCard: { borderRadius: 12, padding: Spacing.three, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  userCard: { borderRadius: 14, padding: Spacing.three, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userLeft: { flex: 1, gap: 3 },
  userName: { fontSize: 15, fontWeight: '600' },
  userEmail: { fontSize: 12 },
  userDate: { fontSize: 11 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  rolePillText: { fontSize: 11, fontWeight: '600' },
});
