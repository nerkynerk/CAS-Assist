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
} from '@/components/ui/academic-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

interface RecentUser {
  id: string;
  display_name: string;
  email: string;
  role: string;
  created_at: string;
}

const ROLE_TONE: Record<string, 'blue' | 'warning' | 'success' | 'error'> = {
  student: 'blue',
  faculty: 'warning',
  staff: 'success',
  super_admin: 'error',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function AdminAction({
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

export default function AdminDashboardHome() {
  const router = useRouter();
  const { profile } = useAuth();
  const [stats, setStats] = useState({ users: 0, openTickets: 0, actionReq: 0, announcements: 0 });
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
      users: userCount.count ?? 0,
      openTickets: openCount,
      actionReq: actionCount.count ?? 0,
      announcements: annCount.count ?? 0,
    });
    setRecentUsers(latestUsers.data ?? []);
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Academic.primary} />}
        contentContainerStyle={styles.scroll}>
        <RoleHeroHeader
          label="CAS Assist Administration"
          title="System Overview"
          subtitle={profile?.email ?? 'Monitor users, operations, and CAS service activity.'}
        />

        {loading ? (
          <ActivityIndicator color={Academic.primary} style={styles.loader} />
        ) : (
          <>
            <View style={styles.metricsRow}>
              <MetricCard
                label="Total users"
                value={stats.users}
                icon={{ ios: 'person.2', android: 'groups', web: 'groups' }}
                tone="blue"
              />
              <MetricCard
                label="Open tickets"
                value={stats.openTickets}
                icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
                tone="warning"
              />
            </View>
            <View style={styles.metricsRow}>
              <MetricCard
                label="Action required"
                value={stats.actionReq}
                icon={{ ios: 'exclamationmark.circle', android: 'priority_high', web: 'priority_high' }}
                tone="error"
              />
              <MetricCard
                label="Announcements"
                value={stats.announcements}
                icon={{ ios: 'megaphone', android: 'campaign', web: 'campaign' }}
                tone="success"
              />
            </View>
          </>
        )}

        <SectionHeader title="Admin Tools" action="Open panel" onAction={() => router.navigate('/admin')} />
        <View style={styles.actionGrid}>
          <AdminAction
            label="Ticket Operations"
            icon={{ ios: 'list.bullet', android: 'format_list_bulleted', web: 'format_list_bulleted' }}
            onPress={() => router.navigate('/admin')}
          />
          <AdminAction
            label="Post Announcement"
            icon={{ ios: 'megaphone', android: 'campaign', web: 'campaign' }}
            onPress={() => router.navigate('/admin')}
          />
          <AdminAction
            label="Document Requests"
            icon={{ ios: 'doc.text', android: 'description', web: 'description' }}
            onPress={() => router.navigate('/admin')}
          />
          <AdminAction
            label="Users"
            icon={{ ios: 'person.crop.circle.badge.checkmark', android: 'manage_accounts', web: 'manage_accounts' }}
            onPress={() => router.navigate('/admin')}
          />
        </View>

        <SectionHeader title="Recently Registered" />
        {recentUsers.length === 0 ? (
          <EmptyState
            title="No users yet"
            message="New account registry entries will appear here."
            icon={{ ios: 'person.2', android: 'groups', web: 'groups' }}
          />
        ) : (
          recentUsers.map(user => (
            <SurfaceCard key={user.id} style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.userInitial}>{(user.display_name || 'U')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>{user.display_name}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                <Text style={styles.userDate}>Joined {formatDate(user.created_at)}</Text>
              </View>
              <StatusBadge label={user.role.replace('_', ' ')} tone={ROLE_TONE[user.role] ?? 'muted'} />
            </SurfaceCard>
          ))
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.softBlue,
  },
  userInitial: { color: Academic.primary, fontSize: 18, fontWeight: '900' },
  userInfo: { flex: 1, gap: 2 },
  userName: { color: Academic.navy, fontSize: 15, fontWeight: '900' },
  userEmail: { color: Academic.textSecondary, fontSize: 12 },
  userDate: { color: Academic.textSecondary, fontSize: 11, fontWeight: '700' },
});
