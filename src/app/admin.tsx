import { useCallback, useEffect, useState } from 'react';
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

const PRIMARY = '#208AEF';
const ERROR   = '#DC2626';

// ── Types ─────────────────────────────────────────────────────

interface Ticket {
  id: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  student_id: { id: string; display_name: string; email: string } | null;
}

interface UserRow {
  id: string;
  display_name: string;
  email: string;
  role: string;
  state: string;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  open:           '#208AEF',
  in_progress:    '#F59E0B',
  pending_review: '#8B5CF6',
  resolved:       '#16A34A',
  closed:         '#6B7280',
};

const STATUS_LABEL: Record<string, string> = {
  open:           'Submitted',
  in_progress:    'Under Evaluation',
  pending_review: 'Action Required',
  resolved:       'Resolved',
  closed:         'Closed',
};

const NEXT_STATUS: Record<string, string | null> = {
  open:           'in_progress',
  in_progress:    'pending_review',
  pending_review: 'resolved',
  resolved:       'closed',
  closed:         null,
};

const NEXT_LABEL: Record<string, string> = {
  open:           'Mark: Under Evaluation',
  in_progress:    'Mark: Action Required',
  pending_review: 'Mark: Resolved',
  resolved:       'Mark: Closed',
};

const AUDIENCE_OPTIONS = ['all', 'student', 'faculty', 'staff'] as const;

type AdminTab = 'tickets' | 'announce' | 'users' | 'documents';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Sub-views ─────────────────────────────────────────────────

function AllTickets({
  theme,
}: {
  theme: ReturnType<typeof import('@/hooks/use-theme').useTheme>;
}) {
  const [tickets, setTickets]     = useState<Ticket[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating]   = useState<string | null>(null);
  const [filter, setFilter]       = useState<string>('all');

  const fetch_ = useCallback(async () => {
    let q = supabase
      .from('advising_ticket_pipeline')
      .select('id, category, description, status, priority, created_at, student_id(id, display_name, email)')
      .eq('state', 'active')
      .order('created_at', { ascending: false });

    if (filter !== 'all') q = q.eq('status', filter);

    const { data } = await q;
    setTickets((data as unknown as Ticket[]) ?? []);
  }, [filter]);

  async function load() { setLoading(true); await fetch_(); setLoading(false); }
  async function onRefresh() { setRefreshing(true); await fetch_(); setRefreshing(false); }

  useEffect(() => { load(); }, [fetch_]);

  async function advance(ticket: Ticket) {
    const next = NEXT_STATUS[ticket.status];
    if (!next) return;
    setUpdating(ticket.id);
    const updates: Record<string, unknown> = { status: next };
    if (next === 'resolved') updates.resolved_at = new Date().toISOString();
    await supabase.from('advising_ticket_pipeline').update(updates).eq('id', ticket.id);
    setUpdating(null);
    await fetch_();
  }

  const filters = ['all', 'open', 'in_progress', 'pending_review', 'resolved', 'closed'];
  const filterLabel: Record<string, string> = {
    all: 'All', open: 'Submitted', in_progress: 'Evaluating',
    pending_review: 'Action Req.', resolved: 'Resolved', closed: 'Closed',
  };

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.subScroll}>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {filters.map(f => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterChip,
              { backgroundColor: filter === f ? PRIMARY : theme.backgroundElement },
            ]}>
            <Text style={[styles.filterChipText, { color: filter === f ? '#fff' : theme.textSecondary }]}>
              {filterLabel[f]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={styles.loader} />
      ) : tickets.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No tickets found.</Text>
        </View>
      ) : (
        tickets.map(t => {
          const statusColor = STATUS_COLOR[t.status] ?? '#6B7280';
          const nextStatus  = NEXT_STATUS[t.status];
          const student     = t.student_id;

          return (
            <View key={t.id} style={[styles.ticketCard, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.ticketCardTop}>
                <View style={styles.ticketCardLeft}>
                  <Text style={[styles.ticketCategory, { color: theme.text }]}>{t.category}</Text>
                  {student && (
                    <Text style={[styles.ticketStudent, { color: theme.textSecondary }]}>
                      {student.display_name} · {student.email}
                    </Text>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </Text>
                </View>
              </View>

              <Text style={[styles.ticketDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                {t.description}
              </Text>
              <Text style={[styles.ticketDate, { color: theme.textSecondary }]}>
                {formatDate(t.created_at)}
              </Text>

              {nextStatus && (
                <Pressable
                  style={({ pressed }) => [
                    styles.advanceBtn,
                    { backgroundColor: STATUS_COLOR[nextStatus] + '15', opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => advance(t)}
                  disabled={updating === t.id}>
                  {updating === t.id ? (
                    <ActivityIndicator size="small" color={STATUS_COLOR[nextStatus]} />
                  ) : (
                    <Text style={[styles.advanceBtnText, { color: STATUS_COLOR[nextStatus] }]}>
                      {NEXT_LABEL[t.status]}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function PostAnnouncement({
  theme,
  adminId,
}: {
  theme: ReturnType<typeof import('@/hooks/use-theme').useTheme>;
  adminId: string;
}) {
  const [title, setTitle]         = useState('');
  const [body, setBody]           = useState('');
  const [audience, setAudience]   = useState<string>('all');
  const [isPinned, setIsPinned]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  async function handlePost() {
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.');
      return;
    }
    setSubmitting(true);
    const { error: dbErr } = await supabase.from('announcements').insert({
      posted_by: adminId,
      title: title.trim(),
      body: body.trim(),
      audience,
      is_pinned: isPinned,
    });
    setSubmitting(false);

    if (dbErr) {
      setError(dbErr.message);
    } else {
      setTitle('');
      setBody('');
      setAudience('all');
      setIsPinned(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.subScroll}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {success && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>✓  Announcement posted successfully.</Text>
        </View>
      )}

      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Title</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        placeholder="Announcement title"
        placeholderTextColor={theme.textSecondary}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />

      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Body</Text>
      <TextInput
        style={[styles.textarea, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        placeholder="Write your announcement..."
        placeholderTextColor={theme.textSecondary}
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={6}
        maxLength={1000}
        textAlignVertical="top"
      />
      <Text style={[styles.charCount, { color: theme.textSecondary }]}>{body.length}/1000</Text>

      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Audience</Text>
      <View style={styles.chipRow}>
        {AUDIENCE_OPTIONS.map(a => (
          <Pressable
            key={a}
            onPress={() => setAudience(a)}
            style={[
              styles.chip,
              { backgroundColor: audience === a ? PRIMARY : theme.backgroundElement },
            ]}>
            <Text style={[styles.chipText, { color: audience === a ? '#fff' : theme.textSecondary }]}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.pinToggle, { backgroundColor: theme.backgroundElement }]}
        onPress={() => setIsPinned(v => !v)}>
        <Text style={[styles.pinLabel, { color: theme.text }]}>📌  Pin this announcement</Text>
        <View style={[styles.toggle, { backgroundColor: isPinned ? PRIMARY : theme.backgroundElement, borderColor: isPinned ? PRIMARY : theme.textSecondary }]}>
          <View style={[styles.toggleThumb, { alignSelf: isPinned ? 'flex-end' : 'flex-start' }]} />
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.submitBtn, { opacity: pressed || submitting ? 0.75 : 1 }]}
        onPress={handlePost}
        disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Post Announcement</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function UserList({
  theme,
}: {
  theme: ReturnType<typeof import('@/hooks/use-theme').useTheme>;
}) {
  const [users, setUsers]         = useState<UserRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const ROLE_COLOR: Record<string, string> = {
    student: '#208AEF', faculty: '#8B5CF6', staff: '#16A34A', super_admin: '#DC2626',
  };

  async function fetchUsers() {
    const { data } = await supabase
      .from('users_account_registry')
      .select('id, display_name, email, role, state, created_at')
      .order('created_at', { ascending: false });
    setUsers(data ?? []);
  }

  async function load() { setLoading(true); await fetchUsers(); setLoading(false); }
  async function onRefresh() { setRefreshing(true); await fetchUsers(); setRefreshing(false); }

  useEffect(() => { load(); }, []);

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.subScroll}>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={styles.loader} />
      ) : users.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No users registered yet.</Text>
        </View>
      ) : (
        users.map(u => (
          <View key={u.id} style={[styles.userCard, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.userCardLeft}>
              <Text style={[styles.userName, { color: theme.text }]}>{u.display_name}</Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{u.email}</Text>
              <Text style={[styles.userDate, { color: theme.textSecondary }]}>
                Joined {formatDate(u.created_at)}
              </Text>
            </View>
            <View style={styles.userBadges}>
              <View style={[styles.rolePill, { backgroundColor: (ROLE_COLOR[u.role] ?? '#6B7280') + '20' }]}>
                <Text style={[styles.rolePillText, { color: ROLE_COLOR[u.role] ?? '#6B7280' }]}>
                  {u.role}
                </Text>
              </View>
              {u.state === 'archived_read_only' && (
                <View style={[styles.rolePill, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.rolePillText, { color: '#D97706' }]}>archived</Text>
                </View>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ── Doc requests (admin view) ─────────────────────────────────

const DOC_LABEL: Record<string, string> = {
  transcript_of_records:     'Transcript of Records',
  certificate_of_enrollment: 'Certificate of Enrollment',
  certificate_of_good_moral: 'Certificate of Good Moral',
  honorable_dismissal:       'Honorable Dismissal',
  diploma:                   'Diploma',
  other:                     'Other',
};

const DOC_STATUS_COLOR: Record<string, string> = {
  submitted:        '#208AEF',
  under_evaluation: '#F59E0B',
  action_required:  '#EF4444',
  processing:       '#8B5CF6',
  ready_for_pickup: '#10B981',
  completed:        '#16A34A',
  rejected:         '#DC2626',
};

const DOC_STATUS_LABEL: Record<string, string> = {
  submitted:        'Submitted',
  under_evaluation: 'Under Evaluation',
  action_required:  'Action Required',
  processing:       'Processing',
  ready_for_pickup: 'Ready for Pickup',
  completed:        'Completed',
  rejected:         'Rejected',
};

const DOC_NEXT: Record<string, string | null> = {
  submitted:        'under_evaluation',
  under_evaluation: 'processing',
  processing:       'ready_for_pickup',
  ready_for_pickup: 'completed',
  completed:        null,
  rejected:         null,
};

interface DocRow {
  id: string;
  document_type: string;
  purpose: string;
  copies: number;
  status: string;
  remarks: string | null;
  requested_at: string;
  student_id: { display_name: string; email: string } | null;
}

function DocRequests({
  theme,
}: {
  theme: ReturnType<typeof import('@/hooks/use-theme').useTheme>;
}) {
  const [docs, setDocs]         = useState<DocRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [remarks, setRemarks]   = useState<Record<string, string>>({});

  const fetch_ = useCallback(async () => {
    const { data } = await supabase
      .from('document_requests')
      .select('id, document_type, purpose, copies, status, remarks, requested_at, student_id(display_name, email)')
      .eq('state', 'active')
      .order('requested_at', { ascending: false });
    setDocs((data as unknown as DocRow[]) ?? []);
  }, []);

  async function load() { setLoading(true); await fetch_(); setLoading(false); }
  async function onRefresh() { setRefreshing(true); await fetch_(); setRefreshing(false); }
  useEffect(() => { load(); }, [fetch_]);

  async function advance(doc: DocRow) {
    const next = DOC_NEXT[doc.status];
    if (!next) return;
    setUpdating(doc.id);
    await supabase
      .from('document_requests')
      .update({ status: next, remarks: remarks[doc.id] ?? doc.remarks ?? null })
      .eq('id', doc.id);
    setUpdating(null);
    await fetch_();
  }

  async function reject(doc: DocRow) {
    setUpdating(doc.id + '-reject');
    await supabase
      .from('document_requests')
      .update({ status: 'rejected', remarks: remarks[doc.id] ?? null })
      .eq('id', doc.id);
    setUpdating(null);
    await fetch_();
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.subScroll}>
      {loading ? (
        <ActivityIndicator color={PRIMARY} style={styles.loader} />
      ) : docs.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No document requests yet.</Text>
        </View>
      ) : (
        docs.map(d => {
          const sc      = DOC_STATUS_COLOR[d.status] ?? '#6B7280';
          const next    = DOC_NEXT[d.status];
          const student = d.student_id;
          const isUpdating = updating === d.id || updating === d.id + '-reject';

          return (
            <View key={d.id} style={[styles.ticketCard, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.ticketCardTop}>
                <View style={styles.ticketCardLeft}>
                  <Text style={[styles.ticketCategory, { color: theme.text }]}>
                    {DOC_LABEL[d.document_type] ?? d.document_type}
                  </Text>
                  {student && (
                    <Text style={[styles.ticketStudent, { color: theme.textSecondary }]}>
                      {student.display_name} · {student.email}
                    </Text>
                  )}
                  <Text style={[styles.ticketStudent, { color: theme.textSecondary }]}>
                    {d.copies} {d.copies === 1 ? 'copy' : 'copies'} · {d.purpose}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sc + '20' }]}>
                  <Text style={[styles.statusText, { color: sc }]}>
                    {DOC_STATUS_LABEL[d.status] ?? d.status}
                  </Text>
                </View>
              </View>

              {/* Remarks input */}
              {next && (
                <TextInput
                  style={[styles.remarksInput, { backgroundColor: theme.background, color: theme.text }]}
                  placeholder="Add a note to the student (optional)"
                  placeholderTextColor={theme.textSecondary}
                  value={remarks[d.id] ?? ''}
                  onChangeText={v => setRemarks(r => ({ ...r, [d.id]: v }))}
                />
              )}

              {/* Action buttons */}
              {next && (
                <View style={styles.docActionRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.advanceBtn,
                      { backgroundColor: DOC_STATUS_COLOR[next] + '15', opacity: pressed ? 0.7 : 1, flex: 2 },
                    ]}
                    onPress={() => advance(d)}
                    disabled={isUpdating}>
                    {isUpdating && updating === d.id ? (
                      <ActivityIndicator size="small" color={DOC_STATUS_COLOR[next]} />
                    ) : (
                      <Text style={[styles.advanceBtnText, { color: DOC_STATUS_COLOR[next] }]}>
                        → {DOC_STATUS_LABEL[next]}
                      </Text>
                    )}
                  </Pressable>

                  {d.status !== 'completed' && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.advanceBtn,
                        { backgroundColor: '#FEE2E2', opacity: pressed ? 0.7 : 1, flex: 1 },
                      ]}
                      onPress={() => reject(d)}
                      disabled={isUpdating}>
                      <Text style={[styles.advanceBtnText, { color: '#DC2626' }]}>Reject</Text>
                    </Pressable>
                  )}
                </View>
              )}

              <Text style={[styles.ticketDate, { color: theme.textSecondary }]}>
                {formatDate(d.requested_at)}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

// ── Main screen ───────────────────────────────────────────────

export default function AdminScreen() {
  const theme               = useTheme();
  const { profile }         = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('tickets');

  const isAdmin = profile?.role === 'staff' || profile?.role === 'super_admin';

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessIcon}>🔒</Text>
          <Text style={[styles.accessTitle, { color: theme.text }]}>Access Restricted</Text>
          <Text style={[styles.accessBody, { color: theme.textSecondary }]}>
            This section is only available to CAS staff and administrators.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'tickets',   label: 'Tickets'  },
    { id: 'announce',  label: 'Announce' },
    { id: 'documents', label: 'Docs'     },
    { id: 'users',     label: 'Users'    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* ── Header ──────────────────────────── */}
      <View style={styles.screenHeader}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>Admin Panel</Text>
        <View style={[styles.rolePill, { backgroundColor: '#DC262620' }]}>
          <Text style={[styles.rolePillText, { color: '#DC2626' }]}>
            {profile?.role === 'super_admin' ? 'Super Admin' : 'Staff'}
          </Text>
        </View>
      </View>

      {/* ── Inner tab bar ───────────────────── */}
      <View style={[styles.innerTabBar, { backgroundColor: theme.backgroundElement }]}>
        {tabs.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setActiveTab(t.id)}
            style={[
              styles.innerTab,
              activeTab === t.id && { backgroundColor: PRIMARY },
            ]}>
            <Text style={[
              styles.innerTabText,
              { color: activeTab === t.id ? '#fff' : theme.textSecondary },
            ]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Content ─────────────────────────── */}
      {activeTab === 'tickets'   && <AllTickets theme={theme} />}
      {activeTab === 'announce'  && <PostAnnouncement theme={theme} adminId={profile!.id} />}
      {activeTab === 'documents' && <DocRequests theme={theme} />}
      {activeTab === 'users'     && <UserList theme={theme} />}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  subScroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 100,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },

  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  screenTitle: { fontSize: 24, fontWeight: '700' },

  innerTabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.three,
    marginVertical: Spacing.two,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  innerTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  innerTabText: { fontSize: 13, fontWeight: '600' },

  // Tickets
  filterRow: { marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipText: { fontSize: 12, fontWeight: '500' },
  loader: { marginTop: Spacing.four },
  emptyCard: { borderRadius: 12, padding: Spacing.three, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  ticketCard: { borderRadius: 14, padding: Spacing.three, gap: 6 },
  ticketCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  ticketCardLeft: { flex: 1, gap: 2 },
  ticketCategory: { fontSize: 15, fontWeight: '600' },
  ticketStudent: { fontSize: 12 },
  ticketDesc: { fontSize: 13, lineHeight: 18 },
  ticketDate: { fontSize: 11 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '600' },
  advanceBtn: { borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  advanceBtnText: { fontSize: 13, fontWeight: '600' },

  // Announcement form
  fieldLabel: { fontSize: 13, fontWeight: '500', marginTop: Spacing.one },
  input: { height: 50, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  textarea: { borderRadius: 12, padding: 14, fontSize: 15, minHeight: 130 },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: '500' },
  pinToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  pinLabel: { fontSize: 14 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  submitBtn: {
    height: 52,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12 },
  errorText: { color: ERROR, fontSize: 13 },
  successBox: { backgroundColor: '#DCFCE7', borderRadius: 10, padding: 12 },
  successText: { color: '#16A34A', fontSize: 13, fontWeight: '500' },

  // Users
  userCard: {
    borderRadius: 14,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  userCardLeft: { flex: 1, gap: 3 },
  userName: { fontSize: 15, fontWeight: '600' },
  userEmail: { fontSize: 12 },
  userDate: { fontSize: 11 },
  userBadges: { gap: 4, alignItems: 'flex-end' },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  rolePillText: { fontSize: 11, fontWeight: '600' },

  // Doc requests
  remarksInput: {
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    marginTop: 4,
  },
  docActionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },

  // Access denied
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  accessIcon: { fontSize: 48 },
  accessTitle: { fontSize: 22, fontWeight: '700' },
  accessBody: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
