import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
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

import { BrandColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const PRIMARY = BrandColors.primary;
const NAVY = '#1F2A44';
const PAGE_BG = '#F5F7FB';
const CARD_BG = '#FFFFFF';
const MUTED = '#71809A';
const BORDER = '#E8EDF5';
const SOFT_BLUE = '#EAF4FF';
const GREEN = '#16A34A';
const SOFT_GREEN = '#EAF8EF';
const ORANGE = '#F97316';

interface Announcement {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string;
}

interface ActiveTicket {
  id: string;
  category: string | null;
  status: string;
  created_at: string;
  priority: string | null;
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

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const STATUS_COLOR: Record<string, string> = {
  open: PRIMARY,
  in_progress: '#F59E0B',
  pending_review: '#8B5CF6',
  resolved: GREEN,
  closed: '#6B7280',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'In Queue',
  in_progress: 'Serving',
  pending_review: 'Needs Info',
  resolved: 'Resolved',
  closed: 'Closed',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelative(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatCategory(value: string | null) {
  if (!value) return 'Advising Request';
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getTicketReference(id: string) {
  const digits = id.replace(/\D/g, '');
  if (digits.length >= 3) return `T-${digits.slice(-3)}`;

  const compact = id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return compact ? `T-${compact}` : 'Ticket';
}

function statusText(ticket: ActiveTicket) {
  if (ticket.status === 'in_progress') return 'Currently serving';
  if (ticket.status === 'pending_review') return 'Action needed';
  return formatRelative(ticket.created_at).replace('ago', 'waiting');
}

function DashboardIcon({
  name,
  size = 18,
  color = PRIMARY,
}: {
  name: SymbolName;
  size?: number;
  color?: string;
}) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}

function HeroHeader({
  firstName,
  readOnly,
}: {
  firstName: string;
  readOnly: boolean;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroBackdropOne} />
      <View style={styles.heroBackdropTwo} />
      <View style={styles.heroContent}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroLabel}>CAS Assist Student</Text>
          <Text style={styles.heroTitle}>Hello, {firstName} <Text style={styles.wave}>👋</Text></Text>
          <Text style={styles.heroSubtitle}>Here is your academic support overview.</Text>
          {readOnly && (
            <View style={styles.readOnlyBadge}>
              <Text style={styles.readOnlyText}>Read-only</Text>
            </View>
          )}
        </View>
        <Pressable style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}>
          <DashboardIcon
            name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
            color="#FFFFFF"
            size={26}
          />
        </Pressable>
      </View>
    </View>
  );
}

function ActiveRequestCard({ ticket }: { ticket: ActiveTicket }) {
  const color = STATUS_COLOR[ticket.status] ?? '#6B7280';

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestTopRow}>
        <View style={styles.referencePill}>
          <Text style={styles.referenceText}>{getTicketReference(ticket.id)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color + '14' }]}>
          <Text style={[styles.statusBadgeText, { color }]}>
            {(STATUS_LABEL[ticket.status] ?? ticket.status).toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.requestTitle} numberOfLines={2}>
        {formatCategory(ticket.category)}
      </Text>
      <View style={styles.metaRow}>
        <DashboardIcon
          name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
          color={MUTED}
          size={15}
        />
        <Text style={styles.metaText} numberOfLines={1}>{statusText(ticket)}</Text>
      </View>
      {ticket.priority && (
        <Text style={styles.priorityText}>{formatCategory(ticket.priority)} priority</Text>
      )}
    </View>
  );
}

function RoomChangeCard({
  item,
  isAcknowledged,
  acknowledging,
  onAcknowledge,
}: {
  item: RoomChange;
  isAcknowledged: boolean;
  acknowledging: boolean;
  onAcknowledge: () => void;
}) {
  const courseTitle = [item.subject_code, item.section].filter(Boolean).join(' - ') || 'Class Update';

  return (
    <View style={[styles.roomCard, isAcknowledged ? styles.roomCardDone : styles.roomCardUrgent]}>
      <View style={styles.roomCardHeader}>
        <View style={styles.locationIconBubble}>
          <DashboardIcon
            name={{ ios: 'location', android: 'location_on', web: 'location_on' }}
            color={PRIMARY}
            size={20}
          />
        </View>
        <View style={styles.roomHeaderText}>
          <Text style={styles.roomTitle} numberOfLines={1}>{courseTitle}</Text>
          <Text style={styles.roomTime}>{formatRelative(item.effective_at)}</Text>
        </View>
        {isAcknowledged && (
          <DashboardIcon
            name={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }}
            color={GREEN}
            size={22}
          />
        )}
      </View>

      <View style={styles.roomPath}>
        <Text style={styles.oldRoom} numberOfLines={1}>{item.original_room}</Text>
        <DashboardIcon
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          color="#8EA0BA"
          size={16}
        />
        <Text style={styles.newRoom} numberOfLines={1}>{item.relocated_room}</Text>
      </View>

      {(item.reason || item.logged_by) && (
        <Text style={styles.roomNote} numberOfLines={2}>
          {[item.reason, item.logged_by && `Posted by ${item.logged_by.display_name}`]
            .filter(Boolean)
            .join(' - ')}
        </Text>
      )}

      {isAcknowledged ? (
        <View style={styles.ackDone}>
          <DashboardIcon
            name={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }}
            color={GREEN}
            size={16}
          />
          <Text style={styles.ackDoneText}>Acknowledged</Text>
        </View>
      ) : (
        <Pressable
          onPress={onAcknowledge}
          disabled={acknowledging}
          style={({ pressed }) => [
            styles.ackButton,
            (pressed || acknowledging) && styles.pressed,
          ]}>
          {acknowledging ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.ackButtonText}>Acknowledge Change</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

function DashboardAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: SymbolName;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.actionChip, pressed && styles.pressed]} onPress={onPress}>
      <DashboardIcon name={icon} color={PRIMARY} size={18} />
      <Text style={styles.actionChipText}>{label}</Text>
    </Pressable>
  );
}

export default function StudentDashboard() {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeTickets, setActiveTickets] = useState<ActiveTicket[]>([]);
  const [roomChanges, setRoomChanges] = useState<RoomChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const fetchRoomRef = useRef<(() => Promise<void>) | undefined>(undefined);

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
    } else {
      setAcknowledgedIds(new Set());
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
    const [annRes, ticketRes] = await Promise.all([
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
            .select('id, category, status, created_at, priority')
            .eq('student_id', userId)
            .eq('state', 'active')
            .neq('status', 'closed')
            .order('created_at', { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] }),
    ]);

    setAnnouncements(annRes.data ?? []);
    setActiveTickets((ticketRes.data as ActiveTicket[]) ?? []);
  }

  useEffect(() => {
    fetchRoomRef.current = fetchRoomChanges;
  });

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

  useEffect(() => {
    load();

    const channel = supabase
      .channel('room-changes-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'spatial_logs' },
        () => {
          fetchRoomRef.current?.();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const firstName = profile?.display_name?.split(' ')[0] ?? 'there';
  const pageBackground = theme.background === '#000000' ? theme.background : PAGE_BG;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: pageBackground }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        contentContainerStyle={styles.scroll}>
        <HeroHeader
          firstName={firstName}
          readOnly={profile?.state === 'archived_read_only'}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Requests</Text>
          <Pressable onPress={() => router.navigate('/tickets')} hitSlop={8}>
            <Text style={styles.sectionAction}>View all</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : activeTickets.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No active requests</Text>
            <Text style={styles.emptyText}>Your submitted requests will appear here.</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.requestRail}>
            {activeTickets.map(ticket => (
              <ActiveRequestCard key={ticket.id} ticket={ticket} />
            ))}
          </ScrollView>
        )}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Room Changes</Text>
            {roomChanges.filter(change => !acknowledgedIds.has(change.id)).length > 0 && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>
                  {roomChanges.filter(change => !acknowledgedIds.has(change.id)).length} New
                </Text>
              </View>
            )}
          </View>
        </View>

        {roomChanges.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No room changes</Text>
            <Text style={styles.emptyText}>Class relocation notices from the last 24 hours will show here.</Text>
          </View>
        ) : (
          roomChanges.map(change => (
            <RoomChangeCard
              key={change.id}
              item={change}
              isAcknowledged={acknowledgedIds.has(change.id)}
              acknowledging={acknowledgingId === change.id}
              onAcknowledge={() => handleAcknowledge(change.id)}
            />
          ))
        )}

        <View style={styles.secondaryActions}>
          <DashboardAction
            label="News"
            icon={{ ios: 'megaphone', android: 'campaign', web: 'campaign' }}
            onPress={() => router.navigate('/explore')}
          />
          <DashboardAction
            label="Documents"
            icon={{ ios: 'doc.text', android: 'description', web: 'description' }}
            onPress={() => router.navigate('/documents')}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Updates</Text>
          <Pressable onPress={() => router.navigate('/explore')} hitSlop={8}>
            <Text style={styles.sectionAction}>See all</Text>
          </Pressable>
        </View>

        {announcements.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No announcements yet</Text>
            <Text style={styles.emptyText}>Official CAS updates will appear here.</Text>
          </View>
        ) : (
          announcements.map(announcement => (
            <Pressable
              key={announcement.id}
              style={({ pressed }) => [styles.announcementCard, pressed && styles.pressed]}
              onPress={() => router.navigate('/explore')}>
              <View style={styles.announcementTop}>
                <Text style={styles.announcementTitle} numberOfLines={1}>{announcement.title}</Text>
                {announcement.is_pinned && (
                  <DashboardIcon
                    name={{ ios: 'pin', android: 'push_pin', web: 'push_pin' }}
                    color={ORANGE}
                    size={16}
                  />
                )}
              </View>
              <Text style={styles.announcementBody} numberOfLines={2}>{announcement.body}</Text>
              <Text style={styles.announcementDate}>{formatDate(announcement.published_at)}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.navigate('/chatbot')}
        style={({ pressed }) => [styles.chatFab, pressed && styles.pressed]}>
        <DashboardIcon
          name={{ ios: 'message.fill', android: 'chat_bubble', web: 'chat_bubble' }}
          color="#FFFFFF"
          size={26}
        />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 152,
    gap: Spacing.two,
  },
  pressed: { opacity: 0.72 },
  hero: {
    minHeight: 122,
    marginHorizontal: -Spacing.three,
    marginBottom: Spacing.three,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: PRIMARY,
    boxShadow: '0 8px 18px rgba(32, 138, 239, 0.28)',
  },
  heroBackdropOne: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.12)',
    right: -76,
    top: -104,
  },
  heroBackdropTwo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(15, 64, 175, 0.26)',
    left: -72,
    bottom: -112,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  heroCopy: { flex: 1, gap: 3 },
  heroLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 14, fontWeight: '700' },
  heroTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '800' },
  heroSubtitle: { color: '#FFFFFF', fontSize: 15, lineHeight: 21, opacity: 0.96 },
  wave: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  readOnlyBadge: {
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  readOnlyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  notificationButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sectionHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionTitle: { color: NAVY, fontSize: 18, fontWeight: '800' },
  sectionAction: { color: PRIMARY, fontSize: 14, fontWeight: '700' },
  newBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFE4E6',
  },
  newBadgeText: { color: '#EF233C', fontSize: 12, fontWeight: '800' },
  requestRail: { gap: Spacing.three, paddingRight: Spacing.three },
  requestCard: {
    width: 238,
    minHeight: 124,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    boxShadow: '0 6px 16px rgba(31, 42, 68, 0.07)',
  },
  requestTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  referencePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#EDF2F7',
  },
  referenceText: { color: '#60708B', fontSize: 12, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  statusBadgeText: { fontSize: 10, fontWeight: '900' },
  requestTitle: { color: NAVY, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: MUTED, fontSize: 13, flex: 1 },
  priorityText: { color: '#A0AEC0', fontSize: 11, fontWeight: '700' },
  loadingCard: {
    height: 124,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyPanel: {
    borderRadius: 16,
    padding: Spacing.three,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 4,
  },
  emptyTitle: { color: NAVY, fontSize: 15, fontWeight: '800' },
  emptyText: { color: MUTED, fontSize: 13, lineHeight: 18 },
  roomCard: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: 13,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    boxShadow: '0 6px 16px rgba(31, 42, 68, 0.06)',
  },
  roomCardUrgent: { borderLeftWidth: 4, borderLeftColor: '#D92D20' },
  roomCardDone: { borderLeftWidth: 4, borderLeftColor: GREEN },
  roomCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SOFT_BLUE,
  },
  roomHeaderText: { flex: 1, gap: 2 },
  roomTitle: { color: NAVY, fontSize: 16, fontWeight: '800' },
  roomTime: { color: '#8EA0BA', fontSize: 12, fontWeight: '600' },
  roomPath: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F6F8FC',
  },
  oldRoom: {
    flex: 1,
    color: '#697A94',
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  newRoom: {
    flex: 1,
    color: '#0F56E8',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  roomNote: { color: MUTED, fontSize: 12, lineHeight: 17 },
  ackButton: {
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2165F3',
  },
  ackButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  ackDone: {
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    backgroundColor: SOFT_GREEN,
    borderWidth: 1,
    borderColor: '#BFE8CC',
  },
  ackDoneText: { color: GREEN, fontSize: 14, fontWeight: '800' },
  secondaryActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  actionChipText: { color: NAVY, fontSize: 14, fontWeight: '800' },
  announcementCard: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: 6,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  announcementTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  announcementTitle: { color: NAVY, fontSize: 15, fontWeight: '800', flex: 1 },
  announcementBody: { color: MUTED, fontSize: 13, lineHeight: 18 },
  announcementDate: { color: '#9AA8BC', fontSize: 11, fontWeight: '600' },
  chatFab: {
    position: 'absolute',
    right: Spacing.three,
    bottom: 96,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    boxShadow: '0 8px 18px rgba(32, 138, 239, 0.3)',
  },
});
