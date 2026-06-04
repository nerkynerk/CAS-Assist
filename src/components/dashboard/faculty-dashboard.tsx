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

import {
  Academic,
  AcademicIcon,
  EmptyState,
  IconButton,
  MetricCard,
  RoleHeroHeader,
  SectionHeader,
  StatusBadge,
  SurfaceCard,
} from '@/components/ui/academic-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

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

type FacultyView = 'main' | 'room-change';

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function QuickAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: Parameters<typeof AcademicIcon>[0]['name'];
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.quickIcon}>
        <AcademicIcon name={icon} color={Academic.primary} size={22} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

export default function FacultyDashboard() {
  const router = useRouter();
  const { profile } = useAuth();

  const [view, setView] = useState<FacultyView>('main');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [myRoomChanges, setMyRoomChanges] = useState<AckedRoomChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [origRoom, setOrigRoom] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [section, setSection] = useState('');
  const [reason, setReason] = useState('');
  const [posting, setPosting] = useState(false);
  const [rcError, setRcError] = useState<string | null>(null);
  const [rcSuccess, setRcSuccess] = useState(false);

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

  async function load() {
    setLoading(true);
    await Promise.all([fetchData(), fetchMyRoomChanges()]);
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([fetchData(), fetchMyRoomChanges()]);
    setRefreshing(false);
  }

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
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  async function handleRoomChange() {
    setRcError(null);
    if (!origRoom.trim() || !newRoom.trim()) {
      setRcError('Original room and new room are required.');
      return;
    }
    setPosting(true);
    const { data: insertedLog, error } = await supabase
      .from('spatial_logs')
      .insert({
        logged_by: profile!.id,
        original_room: origRoom.trim(),
        relocated_room: newRoom.trim(),
        subject_code: subjectCode.trim() || null,
        section: section.trim() || null,
        reason: reason.trim() || null,
      })
      .select('id, original_room, relocated_room, subject_code, section, effective_at')
      .single();
    setPosting(false);
    if (error) {
      setRcError(error.message);
    } else {
      if (insertedLog) setMyRoomChanges(prev => [{ ...insertedLog, ack_count: 0 }, ...prev]);
      setOrigRoom(''); setNewRoom(''); setSubjectCode(''); setSection(''); setReason('');
      setRcSuccess(true);
      setTimeout(() => { setRcSuccess(false); setView('main'); }, 1600);
    }
  }

  const firstName = profile?.display_name?.split(' ')[0] ?? 'there';
  const todayLabel = today.charAt(0).toUpperCase() + today.slice(1);

  if (view === 'room-change') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.formHeader}>
            <IconButton
              icon={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              onPress={() => setView('main')}
              label="Back"
              bg={Academic.muted}
              color={Academic.textSecondary}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>Log Room Change</Text>
              <Text style={styles.pageSubtitle}>Notify students of a classroom relocation.</Text>
            </View>
          </View>

          {rcError ? <View style={styles.errorBox}><Text style={styles.errorText}>{rcError}</Text></View> : null}
          {rcSuccess ? <View style={styles.successBox}><Text style={styles.successText}>Room change logged and students notified.</Text></View> : null}

          {[
            { label: 'Original Room *', value: origRoom, set: setOrigRoom, placeholder: 'e.g. CAS 402' },
            { label: 'New Room *', value: newRoom, set: setNewRoom, placeholder: 'e.g. Main Lib 2' },
            { label: 'Subject Code', value: subjectCode, set: setSubjectCode, placeholder: 'e.g. CS 201' },
            { label: 'Section', value: section, set: setSection, placeholder: 'e.g. BSCS 3A' },
          ].map(field => (
            <View key={field.label} style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                style={styles.input}
                placeholder={field.placeholder}
                placeholderTextColor={Academic.textSecondary}
                value={field.value}
                onChangeText={field.set}
              />
            </View>
          ))}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.textarea}
              placeholder="e.g. Room maintenance"
              placeholderTextColor={Academic.textSecondary}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, (pressed || posting) && styles.pressed]}
            onPress={handleRoomChange}
            disabled={posting}>
            {posting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Submit Room Change</Text>}
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
        <RoleHeroHeader
          label="CAS Assist Faculty"
          title={`Hello, ${firstName}`}
          subtitle="Manage academic concerns and class updates."
        />

        <View style={styles.metricsRow}>
          <MetricCard
            label="Classes today"
            value={schedules.length}
            icon={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
            tone="blue"
          />
          <MetricCard
            label="Room updates"
            value={myRoomChanges.length}
            icon={{ ios: 'location', android: 'location_on', web: 'location_on' }}
            tone="warning"
          />
        </View>

        <SectionHeader title="Faculty Actions" />
        <View style={styles.quickGrid}>
          <QuickAction
            label="Log Room Change"
            icon={{ ios: 'location', android: 'location_on', web: 'location_on' }}
            onPress={() => setView('room-change')}
          />
          <QuickAction
            label="Advising Requests"
            icon={{ ios: 'doc.text', android: 'assignment', web: 'assignment' }}
            onPress={() => router.navigate('/tickets')}
          />
          <QuickAction
            label="Updates"
            icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
            onPress={() => router.navigate('/explore')}
          />
          <QuickAction
            label="Helpdesk"
            icon={{ ios: 'message', android: 'chat_bubble', web: 'chat_bubble' }}
            onPress={() => router.navigate('/chatbot')}
          />
        </View>

        <SectionHeader title="Today's Classes" action={todayLabel} onAction={() => {}} />
        {loading ? (
          <ActivityIndicator color={Academic.primary} style={styles.loader} />
        ) : schedules.length === 0 ? (
          <EmptyState
            title="No classes scheduled"
            message="There are no active class schedules assigned for today."
            icon={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
          />
        ) : (
          schedules.map(schedule => (
            <SurfaceCard key={schedule.id} accent="blue" style={styles.scheduleCard}>
              <View style={styles.scheduleTop}>
                <View style={styles.scheduleIcon}>
                  <AcademicIcon
                    name={{ ios: 'book.closed', android: 'menu_book', web: 'menu_book' }}
                    color={Academic.primary}
                    size={21}
                  />
                </View>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleTitle} numberOfLines={1}>
                    {schedule.subject_code} - {schedule.subject_name}
                  </Text>
                  <Text style={styles.scheduleMeta}>
                    Section {schedule.section} - {schedule.room}
                  </Text>
                </View>
              </View>
              <Text style={styles.scheduleTime}>
                {formatTime(schedule.time_start)} - {formatTime(schedule.time_end)}
              </Text>
            </SurfaceCard>
          ))
        )}

        <SectionHeader title="My Room Changes" />
        {myRoomChanges.length === 0 ? (
          <EmptyState
            title="No active room changes"
            message="Room changes you post in the last 24 hours will show acknowledgment counts here."
            icon={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }}
          />
        ) : (
          myRoomChanges.map(change => (
            <SurfaceCard key={change.id} style={styles.roomCard} accent="warning">
              <View style={styles.roomCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roomTitle} numberOfLines={1}>
                    {`${change.original_room} -> ${change.relocated_room}`}
                  </Text>
                  <Text style={styles.roomSub}>
                    {[change.subject_code, change.section].filter(Boolean).join(' - ') || 'Room relocation'}
                  </Text>
                </View>
                <StatusBadge label={`${change.ack_count} ack${change.ack_count === 1 ? '' : 's'}`} tone="blue" />
              </View>
              <Text style={styles.roomTime}>{formatDate(change.effective_at)}</Text>
            </SurfaceCard>
          ))
        )}

        <SectionHeader title="Recent Announcements" action="See all" onAction={() => router.navigate('/explore')} />
        {announcements.length === 0 ? (
          <EmptyState
            title="No announcements"
            message="Active CAS announcements will appear here."
            icon={{ ios: 'megaphone', android: 'campaign', web: 'campaign' }}
          />
        ) : (
          announcements.map(item => (
            <SurfaceCard key={item.id} style={styles.announcementCard}>
              <Text style={styles.announcementTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.announcementBody} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.announcementDate}>{formatDate(item.published_at)}</Text>
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
  metricsRow: { flexDirection: 'row', gap: Spacing.three },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  quickAction: {
    width: '48%',
    minHeight: 88,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.softBlue,
  },
  quickLabel: { color: Academic.navy, fontSize: 13, lineHeight: 17, fontWeight: '900' },
  loader: { marginTop: Spacing.four },
  scheduleCard: { gap: 10 },
  scheduleTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scheduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.softBlue,
  },
  scheduleInfo: { flex: 1, gap: 2 },
  scheduleTitle: { color: Academic.navy, fontSize: 15, fontWeight: '900' },
  scheduleMeta: { color: Academic.textSecondary, fontSize: 13 },
  scheduleTime: { color: Academic.primary, fontSize: 13, fontWeight: '900' },
  roomCard: { gap: 8 },
  roomCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  roomTitle: { color: Academic.navy, fontSize: 15, fontWeight: '900' },
  roomSub: { color: Academic.textSecondary, fontSize: 13 },
  roomTime: { color: Academic.textSecondary, fontSize: 12 },
  announcementCard: { gap: 5 },
  announcementTitle: { color: Academic.navy, fontSize: 15, fontWeight: '900' },
  announcementBody: { color: Academic.textSecondary, fontSize: 13, lineHeight: 18 },
  announcementDate: { color: Academic.textSecondary, fontSize: 12, fontWeight: '700' },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: Spacing.four },
  pageTitle: { color: Academic.navy, fontSize: 24, fontWeight: '900' },
  pageSubtitle: { color: Academic.textSecondary, fontSize: 13, marginTop: 3 },
  fieldGroup: { gap: 7 },
  fieldLabel: { color: Academic.textSecondary, fontSize: 13, fontWeight: '800' },
  input: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: Academic.navy,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
    fontSize: 15,
  },
  textarea: {
    minHeight: 100,
    borderRadius: 14,
    padding: 14,
    color: Academic.navy,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
    fontSize: 15,
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.primary,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  errorBox: { borderRadius: 14, padding: 12, backgroundColor: Academic.errorBg },
  errorText: { color: Academic.error, fontSize: 13, fontWeight: '800' },
  successBox: { borderRadius: 14, padding: 12, backgroundColor: Academic.successBg },
  successText: { color: Academic.success, fontSize: 13, fontWeight: '800' },
});
