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

import {
  Academic,
  AcademicIcon,
  EmptyState,
  SectionHeader,
  StatusBadge,
  SurfaceCard,
  formatCategory,
  shortRef,
} from '@/components/ui/academic-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

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

type AdminTab = 'tickets' | 'announce' | 'documents' | 'users';

const STATUS_LABEL: Record<string, string> = {
  open: 'Submitted',
  in_progress: 'Serving',
  pending_review: 'Action Required',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_TONE: Record<string, 'blue' | 'warning' | 'success' | 'muted' | 'error'> = {
  open: 'warning',
  in_progress: 'blue',
  pending_review: 'error',
  resolved: 'success',
  closed: 'muted',
};

const NEXT_STATUS: Record<string, string | null> = {
  open: 'in_progress',
  in_progress: 'pending_review',
  pending_review: 'resolved',
  resolved: 'closed',
  closed: null,
};

const NEXT_LABEL: Record<string, string> = {
  open: 'Start Serving',
  in_progress: 'Request Action',
  pending_review: 'Resolve',
  resolved: 'Close',
};

const AUDIENCE_OPTIONS = ['all', 'student', 'faculty', 'staff'] as const;

const DOC_LABEL: Record<string, string> = {
  transcript_of_records: 'Transcript of Records',
  certificate_of_enrollment: 'Certificate of Enrollment',
  certificate_of_good_moral: 'Certificate of Good Moral',
  honorable_dismissal: 'Honorable Dismissal',
  diploma: 'Diploma',
  other: 'Other',
};

const DOC_STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  under_evaluation: 'Under Evaluation',
  action_required: 'Action Required',
  processing: 'Processing',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  rejected: 'Rejected',
};

const DOC_STATUS_TONE: Record<string, 'blue' | 'warning' | 'success' | 'error' | 'muted'> = {
  submitted: 'blue',
  under_evaluation: 'warning',
  action_required: 'error',
  processing: 'warning',
  ready_for_pickup: 'success',
  completed: 'success',
  rejected: 'error',
};

const DOC_NEXT: Record<string, string | null> = {
  submitted: 'under_evaluation',
  under_evaluation: 'processing',
  processing: 'ready_for_pickup',
  ready_for_pickup: 'completed',
  completed: null,
  rejected: null,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ManagementCard({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: 'blue' | 'warning' | 'success' | 'error';
}) {
  return <SurfaceCard style={styles.managementCard} accent={accent}>{children}</SurfaceCard>;
}

function AllTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const fetchTickets = useCallback(async () => {
    let q = supabase
      .from('advising_ticket_pipeline')
      .select('id, category, description, status, priority, created_at, student_id(id, display_name, email)')
      .eq('state', 'active')
      .order('created_at', { ascending: false });

    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setTickets((data as unknown as Ticket[]) ?? []);
  }, [filter]);

  async function load() { setLoading(true); await fetchTickets(); setLoading(false); }
  async function onRefresh() { setRefreshing(true); await fetchTickets(); setRefreshing(false); }

  useEffect(() => { load(); }, [fetchTickets]);

  async function advance(ticket: Ticket) {
    const next = NEXT_STATUS[ticket.status];
    if (!next) return;
    setUpdating(ticket.id);
    const updates: Record<string, unknown> = { status: next };
    if (next === 'resolved') updates.resolved_at = new Date().toISOString();
    await supabase.from('advising_ticket_pipeline').update(updates).eq('id', ticket.id);
    setUpdating(null);
    await fetchTickets();
  }

  const filters = ['all', 'open', 'in_progress', 'pending_review', 'resolved', 'closed'];

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Academic.primary} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.subScroll}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        {filters.map(item => {
          const active = filter === item;
          return (
            <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {item === 'all' ? 'All' : STATUS_LABEL[item] ?? item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={Academic.primary} style={styles.loader} />
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No tickets found"
          message="Requests matching this filter will appear here."
          icon={{ ios: 'tray', android: 'inbox', web: 'inbox' }}
        />
      ) : (
        tickets.map(ticket => {
          const next = NEXT_STATUS[ticket.status];
          const student = ticket.student_id;
          return (
            <ManagementCard key={ticket.id} accent={ticket.status === 'pending_review' ? 'error' : 'blue'}>
              <View style={styles.cardTop}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.refText}>{shortRef(ticket.id)}</Text>
                  <Text style={styles.itemTitle}>{formatCategory(ticket.category)}</Text>
                  {student ? <Text style={styles.itemMeta} numberOfLines={1}>{student.display_name} - {student.email}</Text> : null}
                </View>
                <StatusBadge label={STATUS_LABEL[ticket.status] ?? ticket.status} tone={STATUS_TONE[ticket.status] ?? 'muted'} />
              </View>
              <Text style={styles.itemBody} numberOfLines={2}>{ticket.description}</Text>
              <View style={styles.footerRow}>
                <Text style={styles.itemMeta}>{formatDate(ticket.created_at)}</Text>
                {next ? (
                  <Pressable
                    style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                    onPress={() => advance(ticket)}
                    disabled={updating === ticket.id}>
                    {updating === ticket.id ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.smallButtonText}>{NEXT_LABEL[ticket.status]}</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </ManagementCard>
          );
        })
      )}
    </ScrollView>
  );
}

function PostAnnouncement({ adminId }: { adminId: string }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<string>('all');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
      {success ? <View style={styles.successBox}><Text style={styles.successText}>Announcement posted successfully.</Text></View> : null}

      <SectionHeader title="Announcement Details" />
      <TextInput
        style={styles.input}
        placeholder="Announcement title"
        placeholderTextColor={Academic.textSecondary}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />
      <TextInput
        style={styles.textarea}
        placeholder="Write your announcement..."
        placeholderTextColor={Academic.textSecondary}
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={6}
        maxLength={1000}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{body.length}/1000</Text>

      <SectionHeader title="Audience" />
      <View style={styles.chipRow}>
        {AUDIENCE_OPTIONS.map(item => {
          const active = audience === item;
          return (
            <Pressable key={item} onPress={() => setAudience(item)} style={[styles.choiceChip, active && styles.choiceChipActive]}>
              <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={() => setIsPinned(value => !value)} style={styles.pinToggle}>
        <View style={styles.pinLeft}>
          <AcademicIcon
            name={{ ios: 'pin', android: 'push_pin', web: 'push_pin' }}
            color={isPinned ? Academic.warningText : Academic.textSecondary}
            size={18}
          />
          <Text style={styles.pinText}>Pin this announcement</Text>
        </View>
        <StatusBadge label={isPinned ? 'Pinned' : 'Standard'} tone={isPinned ? 'warning' : 'muted'} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.primaryButton, (pressed || submitting) && styles.pressed]}
        onPress={handlePost}
        disabled={submitting}>
        {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Post Announcement</Text>}
      </Pressable>
    </ScrollView>
  );
}

function DocRequests() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from('document_requests')
      .select('id, document_type, purpose, copies, status, remarks, requested_at, student_id(display_name, email)')
      .eq('state', 'active')
      .order('requested_at', { ascending: false });
    setDocs((data as unknown as DocRow[]) ?? []);
  }, []);

  async function load() { setLoading(true); await fetchDocs(); setLoading(false); }
  async function onRefresh() { setRefreshing(true); await fetchDocs(); setRefreshing(false); }
  useEffect(() => { load(); }, [fetchDocs]);

  async function advance(doc: DocRow) {
    const next = DOC_NEXT[doc.status];
    if (!next) return;
    setUpdating(doc.id);
    await supabase
      .from('document_requests')
      .update({ status: next, remarks: remarks[doc.id] ?? doc.remarks ?? null })
      .eq('id', doc.id);
    setUpdating(null);
    await fetchDocs();
  }

  async function reject(doc: DocRow) {
    setUpdating(`${doc.id}-reject`);
    await supabase
      .from('document_requests')
      .update({ status: 'rejected', remarks: remarks[doc.id] ?? null })
      .eq('id', doc.id);
    setUpdating(null);
    await fetchDocs();
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Academic.primary} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.subScroll}>
      {loading ? (
        <ActivityIndicator color={Academic.primary} style={styles.loader} />
      ) : docs.length === 0 ? (
        <EmptyState
          title="No document requests"
          message="Student document requests will appear here."
          icon={{ ios: 'doc.text', android: 'description', web: 'description' }}
        />
      ) : (
        docs.map(doc => {
          const next = DOC_NEXT[doc.status];
          const isUpdating = updating === doc.id || updating === `${doc.id}-reject`;
          const student = doc.student_id;
          return (
            <ManagementCard key={doc.id} accent={doc.status === 'rejected' ? 'error' : 'blue'}>
              <View style={styles.cardTop}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.itemTitle}>{DOC_LABEL[doc.document_type] ?? formatCategory(doc.document_type)}</Text>
                  {student ? <Text style={styles.itemMeta} numberOfLines={1}>{student.display_name} - {student.email}</Text> : null}
                  <Text style={styles.itemMeta}>{doc.copies} {doc.copies === 1 ? 'copy' : 'copies'} - {doc.purpose}</Text>
                </View>
                <StatusBadge label={DOC_STATUS_LABEL[doc.status] ?? doc.status} tone={DOC_STATUS_TONE[doc.status] ?? 'muted'} />
              </View>

              {next ? (
                <TextInput
                  style={styles.remarksInput}
                  placeholder="Add a note to the student (optional)"
                  placeholderTextColor={Academic.textSecondary}
                  value={remarks[doc.id] ?? ''}
                  onChangeText={value => setRemarks(current => ({ ...current, [doc.id]: value }))}
                />
              ) : doc.remarks ? (
                <Text style={styles.itemBody}>Staff note: {doc.remarks}</Text>
              ) : null}

              <View style={styles.footerRow}>
                <Text style={styles.itemMeta}>{formatDate(doc.requested_at)}</Text>
                {next ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
                      onPress={() => advance(doc)}
                      disabled={isUpdating}>
                      <Text style={styles.smallButtonText}>{DOC_STATUS_LABEL[next]}</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed]}
                      onPress={() => reject(doc)}
                      disabled={isUpdating}>
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </ManagementCard>
          );
        })
      )}
    </ScrollView>
  );
}

function UserList() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Academic.primary} />}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.subScroll}>
      {loading ? (
        <ActivityIndicator color={Academic.primary} style={styles.loader} />
      ) : users.length === 0 ? (
        <EmptyState
          title="No users registered"
          message="Authenticated account registry rows will appear here."
          icon={{ ios: 'person.2', android: 'groups', web: 'groups' }}
        />
      ) : (
        users.map(user => (
          <ManagementCard key={user.id}>
            <View style={styles.userRow}>
              <View style={styles.userAvatar}>
                <Text style={styles.userInitial}>{(user.display_name || 'U')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.itemTitle} numberOfLines={1}>{user.display_name}</Text>
                <Text style={styles.itemMeta} numberOfLines={1}>{user.email}</Text>
                <Text style={styles.itemMeta}>Joined {formatDate(user.created_at)}</Text>
              </View>
              <View style={styles.userBadges}>
                <StatusBadge label={user.role.replace('_', ' ')} tone={user.role === 'super_admin' ? 'error' : user.role === 'staff' ? 'success' : 'blue'} />
                {user.state === 'archived_read_only' ? <StatusBadge label="Archived" tone="warning" /> : null}
              </View>
            </View>
          </ManagementCard>
        ))
      )}
    </ScrollView>
  );
}

export default function AdminScreen() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('tickets');
  const isAdmin = profile?.role === 'staff' || profile?.role === 'super_admin';

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.accessDenied}>
          <AcademicIcon
            name={{ ios: 'lock', android: 'lock', web: 'lock' }}
            color={Academic.error}
            size={42}
          />
          <Text style={styles.accessTitle}>Access Restricted</Text>
          <Text style={styles.accessBody}>This section is only available to CAS staff and administrators.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'tickets', label: 'Queue' },
    { id: 'announce', label: 'Updates' },
    { id: 'documents', label: 'Docs' },
    { id: 'users', label: 'Users' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>
            {profile?.role === 'super_admin' ? 'Management' : 'Operations'}
          </Text>
          <Text style={styles.screenSub}>CAS service tools and request processing</Text>
        </View>
        <StatusBadge label={profile?.role === 'super_admin' ? 'Super Admin' : 'Staff'} tone={profile?.role === 'super_admin' ? 'error' : 'success'} />
      </View>

      <View style={styles.innerTabBar}>
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.innerTab, active && styles.innerTabActive]}>
              <Text style={[styles.innerTabText, active && styles.innerTabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'tickets' ? <AllTickets /> : null}
      {activeTab === 'announce' ? <PostAnnouncement adminId={profile!.id} /> : null}
      {activeTab === 'documents' ? <DocRequests /> : null}
      {activeTab === 'users' ? <UserList /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Academic.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.two,
  },
  screenTitle: { color: Academic.navy, fontSize: 26, fontWeight: '900' },
  screenSub: { color: Academic.textSecondary, fontSize: 13, marginTop: 3 },
  innerTabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.three,
    marginVertical: Spacing.two,
    padding: 4,
    gap: 4,
    borderRadius: 14,
    backgroundColor: '#E9EEF6',
  },
  innerTab: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerTabActive: {
    backgroundColor: Academic.card,
    boxShadow: '0 1px 4px rgba(16, 33, 62, 0.14)',
  },
  innerTabText: { color: Academic.textSecondary, fontSize: 13, fontWeight: '900' },
  innerTabTextActive: { color: Academic.navy },
  subScroll: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: 128,
    gap: Spacing.three,
  },
  pressed: { opacity: 0.72 },
  loader: { marginTop: Spacing.four },
  filterRail: { gap: Spacing.two, paddingRight: Spacing.three },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#E9EEF6',
  },
  filterChipActive: { backgroundColor: Academic.primary },
  filterText: { color: Academic.textSecondary, fontSize: 13, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  managementCard: { gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  cardTitleGroup: { flex: 1, gap: 3 },
  refText: { color: Academic.primary, fontSize: 13, fontWeight: '900' },
  itemTitle: { color: Academic.navy, fontSize: 15, fontWeight: '900' },
  itemMeta: { color: Academic.textSecondary, fontSize: 12, lineHeight: 17 },
  itemBody: { color: Academic.textSecondary, fontSize: 13, lineHeight: 19 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  smallButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.primary,
  },
  smallButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  rejectButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.errorBg,
  },
  rejectButtonText: { color: Academic.error, fontSize: 12, fontWeight: '900' },
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
    minHeight: 140,
    borderRadius: 14,
    padding: 14,
    color: Academic.navy,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
    fontSize: 15,
  },
  remarksInput: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: Academic.navy,
    backgroundColor: Academic.muted,
    fontSize: 13,
  },
  charCount: { color: Academic.textSecondary, fontSize: 12, textAlign: 'right' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
  },
  choiceChipActive: { backgroundColor: Academic.primary, borderColor: Academic.primary },
  choiceText: { color: Academic.textSecondary, fontSize: 13, fontWeight: '900' },
  choiceTextActive: { color: '#FFFFFF' },
  pinToggle: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
  },
  pinLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinText: { color: Academic.navy, fontSize: 14, fontWeight: '800' },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.primary,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  userBadges: { alignItems: 'flex-end', gap: 4 },
  errorBox: { borderRadius: 14, padding: 12, backgroundColor: Academic.errorBg },
  errorText: { color: Academic.error, fontSize: 13, fontWeight: '800' },
  successBox: { borderRadius: 14, padding: 12, backgroundColor: Academic.successBg },
  successText: { color: Academic.success, fontSize: 13, fontWeight: '800' },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  accessTitle: { color: Academic.navy, fontSize: 22, fontWeight: '900' },
  accessBody: { color: Academic.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
