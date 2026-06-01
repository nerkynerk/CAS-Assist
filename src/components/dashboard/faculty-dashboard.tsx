import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

const PURPLE = '#8B5CF6';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

interface Schedule {
  id: string;
  subject_code: string;
  subject_name: string;
  section: string;
  room: string;
  time_start: string;
  time_end: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  published_at: string;
}

interface AckedRoomChange {
  id: string;
  original_room: string;
  relocated_room: string;
  subject_code: string | null;
  section: string | null;
  effective_at: string;
  ack_count: number;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

type FacultyView = 'main' | 'room-change';

export default function FacultyDashboard() {
  const theme  = useTheme();
  const router = useRouter();
  const { profile } = useAuth();

  const [view, setView]               = useState<FacultyView>('main');
  const [schedules, setSchedules]     = useState<Schedule[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [myRoomChanges, setMyRoomChanges] = useState<AckedRoomChange[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  // Room change form state
  const [origRoom, setOrigRoom]       = useState('');
  const [newRoom, setNewRoom]         = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [section, setSection]         = useState('');
  const [reason, setReason]           = useState('');
  const [posting, setPosting]         = useState(false);
  const [rcError, setRcError]         = useState<string | null>(null);
  const [rcSuccess, setRcSuccess]     = useState(false);

  const today = DAYS[new Date().getDay()];

  async function fetchData() {
    const userId = profile?.id;
    const [schRes, annRes] = await Promise.all([
      userId
        ? supabase
            .from('schedules')
            .select('id, subject_code, subject_name, section, room, time_start, time_end')
            .eq('faculty_id', userId)
            .eq('day', today)
            .eq('state', 'active')
            .order('time_start', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase
        .from('announcements')
        .select('id, title, body, published_at')
        .eq('state', 'active')
        .order('published_at', { ascending: false })
        .limit(3),
    ]);
    setSchedules(schRes.data ?? []);
    setAnnouncements(annRes.data ?? []);
  }

  async function fetchMyRoomChanges() {
    if (!profile?.id) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: logs } = await supabase
      .from('spatial_logs')
      .select('id, original_room, relocated_room, subject_code, section, effective_at')
      .eq('logged_by', profile.id)
      .gte('effective_at', since)
      .order('effective_at', { ascending: false })
      .limit(5);

    if (!logs || logs.length === 0) { setMyRoomChanges([]); return; }

    const ids = logs.map((l: { id: string }) => l.id);
    const { data: acks } = await supabase
      .from('spatial_log_acknowledgments')
      .select('spatial_log_id')
      .in('spatial_log_id', ids);

    const countMap: Record<string, number> = {};
    for (const ack of (acks ?? [])) {
      countMap[ack.spatial_log_id] = (countMap[ack.spatial_log_id] ?? 0) + 1;
    }

    setMyRoomChanges(logs.map((l: Omit<AckedRoomChange, 'ack_count'>) => ({ ...l, ack_count: countMap[l.id] ?? 0 })));
  }

  async function load() { setLoading(true); await Promise.all([fetchData(), fetchMyRoomChanges()]); setLoading(false); }
  async function onRefresh() { setRefreshing(true); await Promise.all([fetchData(), fetchMyRoomChanges()]); setRefreshing(false); }

  useEffect(() => {
    load();

    const channel = supabase
      .channel('faculty-acks-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'spatial_log_acknowledgments' },
        (payload) => {
          const spatialLogId = (payload.new as { spatial_log_id: string }).spatial_log_id;
          setMyRoomChanges(prev =>
            prev.map(rc => rc.id === spatialLogId ? { ...rc, ack_count: rc.ack_count + 1 } : rc)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  async function handleRoomChange() {
    setRcError(null);
    if (!origRoom.trim() || !newRoom.trim()) {
      setRcError('Original room and new room are required.'); return;
    }
    setPosting(true);
    const { data: insertedLog, error } = await supabase
      .from('spatial_logs')
      .insert({
        logged_by:      profile!.id,
        original_room:  origRoom.trim(),
        relocated_room: newRoom.trim(),
        subject_code:   subjectCode.trim() || null,
        section:        section.trim() || null,
        reason:         reason.trim() || null,
      })
      .select('id, original_room, relocated_room, subject_code, section, effective_at')
      .single();
    setPosting(false);
    if (error) {
      setRcError(error.message);
    } else {
      if (insertedLog) {
        setMyRoomChanges(prev => [{ ...insertedLog, ack_count: 0 }, ...prev]);
      }
      setOrigRoom(''); setNewRoom(''); setSubjectCode(''); setSection(''); setReason('');
      setRcSuccess(true);
      setTimeout(() => { setRcSuccess(false); setView('main'); }, 2000);
    }
  }

  const firstName = profile?.display_name?.split(' ')[0] ?? 'there';
  const todayLabel = today.charAt(0).toUpperCase() + today.slice(1);

  // ── Room change form ─────────────────────────────────────────
  if (view === 'room-change') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => setView('main')} style={styles.backBtn}>
            <Text style={[styles.backText, { color: PURPLE }]}>← Back</Text>
          </Pressable>
          <Text style={[styles.formTitle, { color: theme.text }]}>Log Room Change</Text>
          <Text style={[styles.formSub, { color: theme.textSecondary }]}>
            Notify students of a classroom relocation.
          </Text>

          {rcError && <View style={styles.errorBox}><Text style={styles.errorText}>{rcError}</Text></View>}
          {rcSuccess && <View style={styles.successBox}><Text style={styles.successText}>✓ Room change logged and students notified.</Text></View>}

          {[
            { label: 'Original Room *', value: origRoom, set: setOrigRoom, placeholder: 'e.g. Room 301' },
            { label: 'New Room *', value: newRoom, set: setNewRoom, placeholder: 'e.g. Room 205' },
            { label: 'Subject Code', value: subjectCode, set: setSubjectCode, placeholder: 'e.g. CS101' },
            { label: 'Section', value: section, set: setSection, placeholder: 'e.g. CS3A' },
          ].map(f => (
            <View key={f.label} style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{f.label}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
                placeholder={f.placeholder}
                placeholderTextColor={theme.textSecondary}
                value={f.value}
                onChangeText={f.set}
              />
            </View>
          ))}

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Reason (optional)</Text>
            <TextInput
              style={[styles.textarea, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              placeholder="e.g. Room maintenance"
              placeholderTextColor={theme.textSecondary}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.submitBtn, { backgroundColor: PURPLE, opacity: pressed || posting ? 0.75 : 1 }]}
            onPress={handleRoomChange}
            disabled={posting}>
            {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Room Change</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main dashboard ───────────────────────────────────────────
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
          <View style={[styles.badge, { backgroundColor: PURPLE + '20' }]}>
            <Text style={[styles.badgeText, { color: PURPLE }]}>Faculty</Text>
          </View>
        </View>

        {/* Quick actions */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Access</Text>
        <View style={styles.actionGrid}>
          {[
            { label: 'Submit Ticket', icon: '🎫', color: '#208AEF', nav: () => router.navigate('/tickets') },
            { label: 'Log Room Change', icon: '🚪', color: PURPLE, nav: () => setView('room-change') },
            { label: 'Announcements', icon: '📢', color: '#16A34A', nav: () => router.navigate('/explore') },
            { label: 'Ask AI', icon: '🤖', color: '#F59E0B', nav: () => router.navigate('/chatbot') },
          ].map(a => (
            <Pressable
              key={a.label}
              style={({ pressed }) => [styles.actionCard, { backgroundColor: a.color, opacity: pressed ? 0.85 : 1 }]}
              onPress={a.nav}>
              <Text style={styles.actionIcon}>{a.icon}</Text>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Today's schedule */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Classes</Text>
          <Text style={[styles.todayLabel, { color: theme.textSecondary }]}>{todayLabel}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={PURPLE} style={styles.loader} />
        ) : schedules.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No classes scheduled for today.</Text>
          </View>
        ) : (
          schedules.map(s => (
            <View key={s.id} style={[styles.scheduleCard, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.timeStripe, { backgroundColor: PURPLE }]} />
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleSubject, { color: theme.text }]}>{s.subject_code} — {s.subject_name}</Text>
                <Text style={[styles.scheduleSection, { color: theme.textSecondary }]}>Section {s.section} · {s.room}</Text>
                <Text style={[styles.scheduleTime, { color: PURPLE }]}>{formatTime(s.time_start)} – {formatTime(s.time_end)}</Text>
              </View>
            </View>
          ))
        )}

        {/* My room changes with acknowledgment counts */}
        {myRoomChanges.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>My Room Changes</Text>
              <View style={styles.liveDot}>
                <Text style={styles.liveDotText}>LIVE</Text>
              </View>
            </View>
            {myRoomChanges.map(rc => (
              <View key={rc.id} style={[styles.ackCard, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.ackCardHeader}>
                  <Text style={[styles.ackCardRoom, { color: theme.text }]} numberOfLines={1}>
                    {rc.original_room} → {rc.relocated_room}
                  </Text>
                  <View style={[styles.ackBadge, { backgroundColor: PURPLE + '20' }]}>
                    <Text style={[styles.ackBadgeText, { color: PURPLE }]}>
                      {rc.ack_count} ack{rc.ack_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                {(rc.subject_code || rc.section) && (
                  <Text style={[styles.ackCardSub, { color: theme.textSecondary }]}>
                    {[rc.subject_code, rc.section].filter(Boolean).join(' · ')}
                  </Text>
                )}
                <Text style={[styles.ackCardTime, { color: theme.textSecondary }]}>
                  {formatDate(rc.effective_at)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Recent announcements */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Announcements</Text>
          <Pressable onPress={() => router.navigate('/explore')}>
            <Text style={[styles.seeAll, { color: PURPLE }]}>See all</Text>
          </Pressable>
        </View>
        {announcements.map(a => (
          <View key={a.id} style={[styles.announcementCard, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.announcementTitle, { color: theme.text }]} numberOfLines={1}>{a.title}</Text>
            <Text style={[styles.announcementBody, { color: theme.textSecondary }]} numberOfLines={2}>{a.body}</Text>
            <Text style={[styles.announcementDate, { color: theme.textSecondary }]}>{formatDate(a.published_at)}</Text>
          </View>
        ))}
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
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: Spacing.one },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.one },
  todayLabel: { fontSize: 13 },
  seeAll: { fontSize: 13, fontWeight: '600' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { width: '47%', borderRadius: 16, padding: Spacing.three, gap: 8, aspectRatio: 1.5, justifyContent: 'flex-end' },
  actionIcon: { fontSize: 28 },
  actionLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  loader: { marginTop: Spacing.four },
  emptyCard: { borderRadius: 12, padding: Spacing.three, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  scheduleCard: { borderRadius: 14, flexDirection: 'row', overflow: 'hidden' },
  timeStripe: { width: 5 },
  scheduleInfo: { flex: 1, padding: Spacing.three, gap: 4 },
  scheduleSubject: { fontSize: 15, fontWeight: '600' },
  scheduleSection: { fontSize: 13 },
  scheduleTime: { fontSize: 13, fontWeight: '600' },
  announcementCard: { borderRadius: 14, padding: Spacing.three, gap: 4 },
  announcementTitle: { fontSize: 15, fontWeight: '600' },
  announcementBody: { fontSize: 13, lineHeight: 18 },
  announcementDate: { fontSize: 11, marginTop: 2 },
  liveDot: { backgroundColor: '#16A34A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  liveDotText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  ackCard: { borderRadius: 14, padding: Spacing.three, gap: 5 },
  ackCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  ackCardRoom: { fontSize: 15, fontWeight: '600', flex: 1 },
  ackBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  ackBadgeText: { fontSize: 12, fontWeight: '600' },
  ackCardSub: { fontSize: 13 },
  ackCardTime: { fontSize: 11 },
  // Form
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 15, fontWeight: '600' },
  formTitle: { fontSize: 22, fontWeight: '700' },
  formSub: { fontSize: 14 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '500' },
  input: { height: 50, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  textarea: { borderRadius: 12, padding: 14, fontSize: 15, minHeight: 90 },
  submitBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.two },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12 },
  errorText: { color: '#DC2626', fontSize: 13 },
  successBox: { backgroundColor: '#DCFCE7', borderRadius: 10, padding: 12 },
  successText: { color: '#16A34A', fontSize: 13, fontWeight: '500' },
});
