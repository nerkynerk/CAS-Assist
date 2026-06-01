import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const PRIMARY = '#208AEF';

// ── Types ─────────────────────────────────────────────────────

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const AUDIENCE_COLOR: Record<string, string> = {
  all:     '#208AEF',
  student: '#16A34A',
  faculty: '#8B5CF6',
  staff:   '#F59E0B',
};

const AUDIENCE_LABEL: Record<string, string> = {
  all:     'Everyone',
  student: 'Students',
  faculty: 'Faculty',
  staff:   'Staff',
};

// ── Announcement card ─────────────────────────────────────────

function AnnouncementCard({
  item,
  bgEl,
  textColor,
  textSec,
}: {
  item: Announcement;
  bgEl: string;
  textColor: string;
  textSec: string;
}) {
  const audienceColor = AUDIENCE_COLOR[item.audience] ?? '#208AEF';

  return (
    <View style={[styles.card, { backgroundColor: bgEl }, item.is_pinned && styles.cardPinned]}>
      {item.is_pinned && (
        <View style={styles.pinnedRow}>
          <Text style={styles.pinnedText}>📌  Pinned</Text>
        </View>
      )}

      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: textColor }]}>{item.title}</Text>
        <View style={[styles.audienceBadge, { backgroundColor: audienceColor + '20' }]}>
          <Text style={[styles.audienceText, { color: audienceColor }]}>
            {AUDIENCE_LABEL[item.audience] ?? item.audience}
          </Text>
        </View>
      </View>

      <Text style={[styles.cardBody, { color: textSec }]}>{item.body}</Text>

      <Text style={[styles.cardDate, { color: textSec }]}>{formatDate(item.published_at)}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────

export default function AnnouncementsScreen() {
  const theme = useTheme();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [liveTag, setLiveTag]             = useState(false);
  const fetchRef = useRef(fetchAnnouncements);

  async function fetchAnnouncements() {
    setError(null);
    const now = new Date().toISOString();

    const { data, error: dbErr } = await supabase
      .from('announcements')
      .select('id, title, body, audience, is_pinned, published_at, expires_at')
      .eq('state', 'active')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false });

    if (dbErr) {
      setError('Failed to load announcements. Pull down to retry.');
    } else {
      setAnnouncements(data ?? []);
    }
  }

  async function load() {
    setLoading(true);
    await fetchAnnouncements();
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchAnnouncements();
    setRefreshing(false);
  }

  useEffect(() => { fetchRef.current = fetchAnnouncements; });

  useEffect(() => {
    load();

    // ── Supabase Realtime subscription ───────────────────────
    // Listens for INSERT/UPDATE on announcements and refreshes
    // the list automatically — no manual pull-to-refresh needed.
    const channel = supabase
      .channel('announcements-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          setLiveTag(true);
          fetchRef.current();
          setTimeout(() => setLiveTag(false), 3000);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}>

        <View style={styles.titleRow}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>Announcements</Text>
          {liveTag && (
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>● LIVE</Text>
            </View>
          )}
        </View>
        <Text style={[styles.screenSub, { color: theme.textSecondary }]}>
          Official updates from the College of Arts and Sciences
        </Text>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={styles.loader} />
        ) : error ? (
          <View style={[styles.errorCard, { backgroundColor: '#FEE2E2' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : announcements.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
            <Text style={styles.emptyIcon}>📢</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No announcements</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Check back later for updates from CAS.
            </Text>
          </View>
        ) : (
          announcements.map(item => (
            <AnnouncementCard
              key={item.id}
              item={item}
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
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },

  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  screenTitle: { fontSize: 24, fontWeight: '700' },
  screenSub:   { fontSize: 14, marginTop: 2, marginBottom: Spacing.one },
  liveBadge:   { backgroundColor: '#16A34A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  liveText:    { color: '#fff', fontSize: 11, fontWeight: '700' },
  loader: { marginTop: Spacing.four },

  // Cards
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: 8,
  },
  cardPinned: {
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  pinnedRow: { flexDirection: 'row', alignItems: 'center' },
  pinnedText: { fontSize: 12, color: '#D97706', fontWeight: '600' },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  audienceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  audienceText: { fontSize: 11, fontWeight: '600' },
  cardBody: { fontSize: 14, lineHeight: 20 },
  cardDate: { fontSize: 12, marginTop: 2 },

  // Error / Empty
  errorCard: {
    borderRadius: 12,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  errorText: { color: '#DC2626', fontSize: 14 },
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
});
