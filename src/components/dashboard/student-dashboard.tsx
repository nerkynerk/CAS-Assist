import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

const PRIMARY = '#208AEF';
const ORANGE  = '#F59E0B';

// ── Types ─────────────────────────────────────────────────────

interface Announcement {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string;
}

interface TicketSummary {
  status: string;
  count: number;
}

interface RoomChange {
  id: string;
  original_room: string;
  relocated_room: string;
  subject_code: string | null;
  section: string | null;
  reason: string | null;
  effective_at: string;
  logged_by: { display_name: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

const STATUS_COLOR: Record<string, string> = {
  open: '#208AEF', in_progress: '#F59E0B',
  pending_review: '#8B5CF6', resolved: '#16A34A', closed: '#6B7280',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Submitted', in_progress: 'Evaluating',
  pending_review: 'Action Required', resolved: 'Resolved', closed: 'Closed',
};

// ── Room change alert card ─────────────────────────────────────

function RoomChangeAlert({
  item, isAcknowledged, acknowledging, onAcknowledge,
}: {
  item: RoomChange;
  isAcknowledged: boolean; acknowledging: boolean; onAcknowledge: () => void;
}) {
  return (
    <View style={alertStyles.card}>
      <View style={alertStyles.header}>
        <Text style={alertStyles.icon}>⚠️</Text>
        <View style={alertStyles.headerText}>
          <Text style={alertStyles.title}>Room Change Alert</Text>
          {(item.subject_code || item.section) && (
            <Text style={alertStyles.sub}>
              {[item.subject_code, item.section].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        <Text style={alertStyles.time}>{formatTime(item.effective_at)}</Text>
      </View>

      <View style={alertStyles.roomRow}>
        <View style={alertStyles.roomBox}>
          <Text style={alertStyles.roomLabel}>FROM</Text>
          <Text style={alertStyles.roomValue}>{item.original_room}</Text>
        </View>
        <Text style={alertStyles.arrow}>→</Text>
        <View style={[alertStyles.roomBox, alertStyles.roomBoxNew]}>
          <Text style={[alertStyles.roomLabel, { color: '#fff' }]}>NOW AT</Text>
          <Text style={[alertStyles.roomValue, { color: '#fff' }]}>{item.relocated_room}</Text>
        </View>
      </View>

      {item.reason && (
        <Text style={alertStyles.reason}>Reason: {item.reason}</Text>
      )}
      {item.logged_by && (
        <Text style={alertStyles.faculty}>Posted by {item.logged_by.display_name}</Text>
      )}

      <Pressable
        onPress={onAcknowledge}
        disabled={isAcknowledged || acknowledging}
        style={[alertStyles.ackBtn, isAcknowledged && alertStyles.ackBtnDone]}
      >
        {acknowledging ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={[alertStyles.ackBtnText, isAcknowledged && { color: '#16A34A' }]}>
            {isAcknowledged ? 'Acknowledged ✅' : 'Acknowledge'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const alertStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: Spacing.three,
    borderLeftWidth: 4,
    borderLeftColor: ORANGE,
    gap: 10,
  },
  header:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  icon:       { fontSize: 20, marginTop: 1 },
  headerText: { flex: 1, gap: 2 },
  title:      { fontSize: 15, fontWeight: '700', color: '#92400E' },
  sub:        { fontSize: 12, color: '#B45309' },
  time:       { fontSize: 11, color: '#B45309', marginTop: 2 },
  roomRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roomBox:    {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  roomBoxNew: { backgroundColor: ORANGE },
  roomLabel:  { fontSize: 10, fontWeight: '700', color: '#92400E', letterSpacing: 0.5 },
  roomValue:  { fontSize: 16, fontWeight: '800', color: '#78350F' },
  arrow:      { fontSize: 20, color: ORANGE, fontWeight: '700' },
  reason:     { fontSize: 12, color: '#92400E', fontStyle: 'italic' },
  faculty:    { fontSize: 11, color: '#B45309' },
  ackBtn:     { backgroundColor: ORANGE, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 2 },
  ackBtnDone: { backgroundColor: '#DCFCE7' },
  ackBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});

// ── Action card ───────────────────────────────────────────────

function ActionCard({
  label, icon, color, onPress,
}: { label: string; icon: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionCard, { backgroundColor: color, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={onPress}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────

export default function StudentDashboard() {
  const theme  = useTheme();
  const router = useRouter();
  const { profile } = useAuth();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [ticketSummary, setTicketSummary] = useState<TicketSummary[]>([]);
  const [roomChanges, setRoomChanges]     = useState<RoomChange[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const fetchRoomRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // ── Fetch room changes from the last 24 hours ─────────────
  async function fetchRoomChanges() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('spatial_logs')
      .select('id, original_room, relocated_room, subject_code, section, reason, effective_at, logged_by(display_name)')
      .gte('effective_at', since)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('effective_at', { ascending: false })
      .limit(5);

    const changes = (data as unknown as RoomChange[]) ?? [];
    setRoomChanges(changes);

    if (profile?.id && changes.length > 0) {
      const ids = changes.map(c => c.id);
      const { data: acks } = await supabase
        .from('spatial_log_acknowledgments')
        .select('spatial_log_id')
        .in('spatial_log_id', ids)
        .eq('student_id', profile.id);
      setAcknowledgedIds(new Set((acks ?? []).map((a: { spatial_log_id: string }) => a.spatial_log_id)));
    }
  }

  async function handleAcknowledge(spatialLogId: string) {
    if (!profile?.id || acknowledgingId) return;
    setAcknowledgingId(spatialLogId);
    const { error } = await supabase.rpc('acknowledge_room_change', {
      p_spatial_log_id: spatialLogId,
      p_student_id: profile.id,
    });
    if (!error) {
      setAcknowledgedIds(prev => new Set([...prev, spatialLogId]));
    }
    setAcknowledgingId(null);
  }

  async function fetchData() {
    const userId = profile?.id;
    const [annRes, tickRes] = await Promise.all([
      supabase
        .from('announcements')
        .select('id, title, body, is_pinned, published_at')
        .eq('state', 'active')
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(3),
      userId
        ? supabase
            .from('advising_ticket_pipeline')
            .select('status')
            .eq('student_id', userId)
            .eq('state', 'active')
            .neq('status', 'closed')
        : Promise.resolve({ data: [] }),
    ]);

    setAnnouncements(annRes.data ?? []);

    const counts: Record<string, number> = {};
    for (const t of (tickRes.data ?? [])) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }
    setTicketSummary(
      Object.entries(counts).map(([status, count]) => ({ status, count })),
    );
  }

  useEffect(() => { fetchRoomRef.current = fetchRoomChanges; });

  async function load() {
    setLoading(true);
    await Promise.all([fetchData(), fetchRoomChanges()]);
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([fetchData(), fetchRoomChanges()]);
    setRefreshing(false);
  }

  // ── Real-time: watch spatial_logs for new room changes ────
  useEffect(() => {
    load();

    const channel = supabase
      .channel('room-changes-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'spatial_logs' },
        () => { fetchRoomRef.current?.(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  const firstName    = profile?.display_name?.split(' ')[0] ?? 'there';
  const activeTickets = ticketSummary.reduce((s, t) => s + t.count, 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>
              {getGreeting()},
            </Text>
            <Text style={[styles.name, { color: theme.text }]}>{firstName}</Text>
          </View>
        </View>

        {/* Role badge */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: PRIMARY + '20' }]}>
            <Text style={[styles.badgeText, { color: PRIMARY }]}>Student</Text>
          </View>
          {profile?.state === 'archived_read_only' && (
            <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.badgeText, { color: '#D97706' }]}>Read-only</Text>
            </View>
          )}
        </View>

        {/* ── Room change alerts ─────────────────────────── */}
        {roomChanges.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                📍 Class Updates
              </Text>
              <View style={styles.liveDot}>
                <Text style={styles.liveDotText}>LIVE</Text>
              </View>
            </View>
            {roomChanges.map(rc => (
              <RoomChangeAlert
                key={rc.id}
                item={rc}
                isAcknowledged={acknowledgedIds.has(rc.id)}
                acknowledging={acknowledgingId === rc.id}
                onAcknowledge={() => handleAcknowledge(rc.id)}
              />
            ))}
          </>
        )}

        {/* Active tickets summary */}
        {activeTickets > 0 && (
          <View style={[styles.ticketSummaryCard, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.ticketSummaryHeader}>
              <Text style={[styles.ticketSummaryTitle, { color: theme.text }]}>
                🎫  {activeTickets} active {activeTickets === 1 ? 'ticket' : 'tickets'}
              </Text>
              <Pressable onPress={() => router.navigate('/tickets')}>
                <Text style={[styles.seeAll, { color: PRIMARY }]}>View all</Text>
              </Pressable>
            </View>
            <View style={styles.ticketStatusRow}>
              {ticketSummary.map(({ status, count }) => (
                <View
                  key={status}
                  style={[
                    styles.statusPill,
                    { backgroundColor: (STATUS_COLOR[status] ?? '#6B7280') + '20' },
                  ]}>
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: STATUS_COLOR[status] ?? '#6B7280' },
                    ]}>
                    {STATUS_LABEL[status] ?? status}: {count}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quick actions */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Access</Text>
        <View style={styles.actionGrid}>
          <ActionCard label="Ask AI"        icon="🤖" color={PRIMARY}    onPress={() => router.navigate('/chatbot')} />
          <ActionCard label="My Tickets"    icon="🎫" color="#F59E0B"    onPress={() => router.navigate('/tickets')} />
          <ActionCard label="Announcements" icon="📢" color="#16A34A"    onPress={() => router.navigate('/explore')} />
          <ActionCard label="Documents"     icon="📄" color="#8B5CF6"    onPress={() => router.navigate('/documents')} />
        </View>

        {/* Recent announcements */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Updates</Text>
          <Pressable onPress={() => router.navigate('/explore')}>
            <Text style={[styles.seeAll, { color: PRIMARY }]}>See all</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={styles.loader} />
        ) : announcements.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No announcements yet.
            </Text>
          </View>
        ) : (
          announcements.map(a => (
            <Pressable
              key={a.id}
              style={[styles.announcementCard, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.navigate('/explore')}>
              {a.is_pinned && <Text style={styles.pinnedLabel}>📌 Pinned</Text>}
              <Text
                style={[styles.announcementTitle, { color: theme.text }]}
                numberOfLines={1}>
                {a.title}
              </Text>
              <Text
                style={[styles.announcementBody, { color: theme.textSecondary }]}
                numberOfLines={2}>
                {a.body}
              </Text>
              <Text style={[styles.announcementDate, { color: theme.textSecondary }]}>
                {formatDate(a.published_at)}
              </Text>
            </Pressable>
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { paddingHorizontal: Spacing.three, paddingBottom: 120, gap: Spacing.two },

  header:   {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  greeting: { fontSize: 14 },
  name:     { fontSize: 24, fontWeight: '700', marginTop: 2 },

  badgeRow:  { flexDirection: 'row', gap: 8 },
  badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  sectionTitle:  { fontSize: 17, fontWeight: '700', marginTop: Spacing.one },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  seeAll: { fontSize: 13, fontWeight: '600' },

  liveDot: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  liveDotText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  ticketSummaryCard:   { borderRadius: 14, padding: Spacing.three, gap: 10 },
  ticketSummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketSummaryTitle:  { fontSize: 15, fontWeight: '600' },
  ticketStatusRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusPill:          { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusPillText:      { fontSize: 12, fontWeight: '500' },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '47%',
    borderRadius: 16,
    padding: Spacing.three,
    gap: 8,
    aspectRatio: 1.5,
    justifyContent: 'flex-end',
  },
  actionIcon:  { fontSize: 28 },
  actionLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },

  loader:    { marginTop: Spacing.four },
  emptyCard: { borderRadius: 12, padding: Spacing.three, alignItems: 'center' },
  emptyText: { fontSize: 14 },

  announcementCard:  { borderRadius: 14, padding: Spacing.three, gap: 4 },
  pinnedLabel:       { fontSize: 11, color: '#D97706', fontWeight: '600' },
  announcementTitle: { fontSize: 15, fontWeight: '600' },
  announcementBody:  { fontSize: 13, lineHeight: 18 },
  announcementDate:  { fontSize: 11, marginTop: 2 },
});
