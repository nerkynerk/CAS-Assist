import React, { useState } from 'react';
import {
  useWindowDimensions,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
} from 'react-native';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const WEB_BREAKPOINT = 768;

const C = {
  bg:          '#0f1117',
  surface:     '#1a1d27',
  surfaceAlt:  '#212535',
  border:      '#2a2d3e',
  accent:      '#4f8ef7',
  accentMuted: '#1e3a6e',
  success:     '#22c55e',
  warning:     '#f59e0b',
  danger:      '#ef4444',
  text:        '#e2e8f0',
  textMuted:   '#94a3b8',
  textDim:     '#64748b',
} as const;

// ─────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[sh.card, style]}>{children}</View>;
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={sh.sectionLabel}>{label.toUpperCase()}</Text>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[sh.badge, { backgroundColor: color + '33', borderColor: color }]}>
      <Text style={[sh.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// WEB LAYOUT  (width > 768)
// ─────────────────────────────────────────────────────────────

// ── Data Matrix ──────────────────────────────────────────────

const MATRIX_STATS = [
  { label: 'Open Tickets',     value: '—', accent: C.accent  },
  { label: 'Avg Wait (min)',   value: '—', accent: C.warning  },
  { label: 'AI Deflection %',  value: '—', accent: C.success  },
  { label: 'Escalations (24h)',value: '—', accent: C.danger   },
];

function DataMatrix() {
  return (
    <Card>
      <SectionLabel label="System Metrics" />
      <View style={web.matrixGrid}>
        {MATRIX_STATS.map((s) => (
          <View key={s.label} style={[web.matrixCell, { borderLeftColor: s.accent }]}>
            <Text style={[sh.value, { color: s.accent }]}>{s.value}</Text>
            <Text style={sh.label}>{s.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ── Ticket Tracking Grid ─────────────────────────────────────

type TicketRow = {
  id: string;
  student: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
};

const PRIORITY_COLOR: Record<TicketRow['priority'], string> = {
  low:    C.textDim,
  medium: C.accent,
  high:   C.warning,
  urgent: C.danger,
};

const MOCK_TICKETS: TicketRow[] = [
  { id: 'TKT-001', student: 'student@neu.edu.ph', category: 'Enrollment',    priority: 'high',   status: 'open'           },
  { id: 'TKT-002', student: 'student@neu.edu.ph', category: 'Grades',        priority: 'medium', status: 'in_progress'    },
  { id: 'TKT-003', student: 'student@neu.edu.ph', category: 'AI Escalation', priority: 'low',    status: 'pending_review' },
];

function TicketGrid() {
  const COLS = ['Ticket ID', 'Student', 'Category', 'Priority', 'Status'];

  return (
    <Card style={{ flex: 1 }}>
      <SectionLabel label="Advising Ticket Pipeline" />

      {/* Header row */}
      <View style={web.gridHeader}>
        {COLS.map((c) => (
          <Text key={c} style={[web.gridCell, sh.label]}>{c}</Text>
        ))}
      </View>

      {/* Data rows */}
      {MOCK_TICKETS.map((t, i) => (
        <View key={t.id} style={[web.gridRow, i % 2 === 1 && web.gridRowAlt]}>
          <Text style={[web.gridCell, sh.mono]}>{t.id}</Text>
          <Text style={[web.gridCell, sh.text]} numberOfLines={1}>{t.student}</Text>
          <Text style={[web.gridCell, sh.text]}>{t.category}</Text>
          <View style={web.gridCell}>
            <Badge label={t.priority} color={PRIORITY_COLOR[t.priority]} />
          </View>
          <Text style={[web.gridCell, sh.text]}>{t.status.replace('_', ' ')}</Text>
        </View>
      ))}
    </Card>
  );
}

// ── Ticket Action Panel ───────────────────────────────────────

const ACTIONS = [
  { label: 'Assign to Me',  color: C.accent   },
  { label: 'Mark Resolved', color: C.success  },
  { label: 'Escalate',      color: C.warning  },
  { label: 'Close Ticket',  color: C.danger   },
];

function TicketActionPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');

  return (
    <Card style={web.actionPanel}>
      <SectionLabel label="Ticket Actions" />

      <Text style={[sh.label, { marginBottom: 8 }]}>Selected: {selected ?? 'None'}</Text>

      <View style={web.actionButtons}>
        {ACTIONS.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={[web.actionBtn, { borderColor: a.color, backgroundColor: selected === a.label ? a.color + '33' : 'transparent' }]}
            onPress={() => setSelected(a.label)}
            activeOpacity={0.7}
          >
            <Text style={[sh.smallBold, { color: a.color }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={web.noteInput}
        placeholder="Add an advisor note…"
        placeholderTextColor={C.textDim}
        multiline
        numberOfLines={4}
        value={note}
        onChangeText={setNote}
      />

      <TouchableOpacity style={web.submitBtn} activeOpacity={0.8}>
        <Text style={sh.smallBold}>Submit Action</Text>
      </TouchableOpacity>
    </Card>
  );
}

// ── Web root ─────────────────────────────────────────────────

function WebLayout() {
  return (
    <SafeAreaView style={sh.root}>
      <View style={web.topbar}>
        <Text style={web.topbarTitle}>CAS-Assist — Advising Console</Text>
        <Text style={sh.label}>Faculty / Staff View</Text>
      </View>

      <ScrollView contentContainerStyle={web.body}>
        <DataMatrix />

        <View style={web.mainRow}>
          <TicketGrid />
          <TicketActionPanel />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// MOBILE LAYOUT  (width ≤ 768)
// ─────────────────────────────────────────────────────────────

// ── OR Queue Countdown ────────────────────────────────────────

function QueueCountdown() {
  // In production this value comes from GET /api/queue/metrics/:student_id
  const dynamicCountdownMinutes: number | null = null;

  return (
    <Card>
      <SectionLabel label="Your Queue Position" />
      <View style={mob.countdownCenter}>
        {dynamicCountdownMinutes !== null ? (
          <>
            <Text style={mob.countdownValue}>{dynamicCountdownMinutes}</Text>
            <Text style={mob.countdownUnit}>estimated minutes</Text>
          </>
        ) : (
          <>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={[sh.label, { marginTop: 12 }]}>Calculating wait time…</Text>
          </>
        )}
        <Text style={[sh.label, { marginTop: 8, textAlign: 'center' }]}>
          Computed via Little's Law · Triangular Distribution (a=5 b=45 c=15)
        </Text>
      </View>
    </Card>
  );
}

// ── Handbook Chat Portal ─────────────────────────────────────

type ChatMessage = { role: 'user' | 'assistant'; text: string; isDeflected?: boolean };

function HandbookChatPortal() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Hi! Ask me anything from the student handbook.', isDeflected: true },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    // Placeholder — wire to POST /api/ai/query in production
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: '(Response from handbook or escalated to ticket)', isDeflected: false },
      ]);
      setLoading(false);
    }, 1000);
  }

  return (
    <Card style={{ flex: 1 }}>
      <SectionLabel label="Handbook Chat Portal" />

      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        style={mob.chatList}
        renderItem={({ item }) => (
          <View style={[mob.bubble, item.role === 'user' ? mob.bubbleUser : mob.bubbleBot]}>
            <Text style={sh.text}>{item.text}</Text>
            {item.role === 'assistant' && item.isDeflected !== undefined && (
              <Badge
                label={item.isDeflected ? 'Handbook' : 'Escalated'}
                color={item.isDeflected ? C.success : C.warning}
              />
            )}
          </View>
        )}
      />

      {loading && <ActivityIndicator color={C.accent} style={{ marginVertical: 4 }} />}

      <View style={mob.chatInputRow}>
        <TextInput
          style={mob.chatInput}
          placeholder="Ask the handbook…"
          placeholderTextColor={C.textDim}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <TouchableOpacity style={mob.sendBtn} onPress={send} activeOpacity={0.8}>
          <Text style={[sh.smallBold, { color: C.bg }]}>Send</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ── Classroom Change Alerts ───────────────────────────────────

type ClassroomAlert = {
  id: string;
  subject: string;
  from: string;
  to: string;
  reason: string;
  effectiveAt: string;
};

const MOCK_ALERTS: ClassroomAlert[] = [
  { id: '1', subject: 'CS301 - A1', from: 'Room 401', to: 'Room 210', reason: 'Maintenance',    effectiveAt: '08:00 AM' },
  { id: '2', subject: 'IT204 - B2', from: 'Room 305', to: 'AVR 1',   reason: 'Faculty Request', effectiveAt: '10:30 AM' },
];

function ClassroomAlerts() {
  return (
    <Card>
      <SectionLabel label="Classroom Change Alerts" />
      {MOCK_ALERTS.length === 0 ? (
        <Text style={sh.label}>No active relocations.</Text>
      ) : (
        MOCK_ALERTS.map((a) => (
          <View key={a.id} style={mob.alertRow}>
            <View style={mob.alertLeft}>
              <Text style={sh.smallBold}>{a.subject}</Text>
              <Text style={sh.label}>
                {a.from} → {a.to}
              </Text>
              <Text style={[sh.label, { color: C.textDim }]}>{a.reason}</Text>
            </View>
            <Text style={[sh.mono, { color: C.warning }]}>{a.effectiveAt}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

// ── Mobile root ───────────────────────────────────────────────

function MobileLayout() {
  return (
    <SafeAreaView style={sh.root}>
      <View style={mob.header}>
        <Text style={mob.headerTitle}>CAS-Assist</Text>
        <Text style={sh.label}>Student Portal</Text>
      </View>

      <ScrollView contentContainerStyle={mob.body}>
        <QueueCountdown />
        <HandbookChatPortal />
        <ClassroomAlerts />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Root — breakpoint switch
// ─────────────────────────────────────────────────────────────

export default function App() {
  const { width } = useWindowDimensions();
  return width > WEB_BREAKPOINT ? <WebLayout /> : <MobileLayout />;
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

/** Shared */
const sh = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  card:         { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: C.textDim, marginBottom: 12 },
  text:         { fontSize: 14, color: C.text, lineHeight: 20 },
  label:        { fontSize: 12, color: C.textMuted },
  smallBold:    { fontSize: 13, fontWeight: '700', color: C.text },
  value:        { fontSize: 28, fontWeight: '700', lineHeight: 32 },
  mono:         { fontFamily: 'monospace', fontSize: 12, color: C.textMuted },
  badge:        { borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText:    { fontSize: 11, fontWeight: '600' },
});

/** Web */
const web = StyleSheet.create({
  topbar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  topbarTitle:   { fontSize: 18, fontWeight: '700', color: C.text },
  body:          { padding: 24, gap: 12 },
  matrixGrid:    { flexDirection: 'row', gap: 12 },
  matrixCell:    { flex: 1, borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 4 },
  mainRow:       { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  gridHeader:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 8, marginBottom: 4 },
  gridRow:       { flexDirection: 'row', paddingVertical: 10 },
  gridRowAlt:    { backgroundColor: C.surfaceAlt },
  gridCell:      { flex: 1, paddingHorizontal: 8, justifyContent: 'center' },
  actionPanel:   { width: 260 },
  actionButtons: { gap: 8, marginBottom: 12 },
  actionBtn:     { borderWidth: 1, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12 },
  noteInput:     { backgroundColor: C.surfaceAlt, borderRadius: 6, borderWidth: 1, borderColor: C.border, color: C.text, padding: 10, minHeight: 80, marginBottom: 10, textAlignVertical: 'top' },
  submitBtn:     { backgroundColor: C.accent, borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
});

/** Mobile */
const mob = StyleSheet.create({
  header:         { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:    { fontSize: 20, fontWeight: '700', color: C.text },
  body:           { padding: 16, gap: 12 },
  countdownCenter:{ alignItems: 'center', paddingVertical: 16 },
  countdownValue: { fontSize: 72, fontWeight: '800', color: C.accent, lineHeight: 80 },
  countdownUnit:  { fontSize: 14, color: C.textMuted, marginTop: 4 },
  chatList:       { maxHeight: 260, marginBottom: 8 },
  bubble:         { borderRadius: 10, padding: 10, marginBottom: 6, maxWidth: '85%', gap: 6 },
  bubbleUser:     { backgroundColor: C.accentMuted, alignSelf: 'flex-end' },
  bubbleBot:      { backgroundColor: C.surfaceAlt, alignSelf: 'flex-start' },
  chatInputRow:   { flexDirection: 'row', gap: 8, marginTop: 4 },
  chatInput:      { flex: 1, backgroundColor: C.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: C.border, color: C.text, paddingHorizontal: 12, paddingVertical: 8 },
  sendBtn:        { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  alertRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  alertLeft:      { flex: 1, gap: 2 },
});
