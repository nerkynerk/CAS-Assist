import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { apiPost } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const PRIMARY = '#208AEF';

// ── Types ─────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant' | 'system';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  isDeflected?: boolean;
  ticketId?: string;
}

interface AIQueryResponse {
  isDeflected: boolean;
  answer?: string;
  source?: string;
  ticket?: { id: string; status: string };
  message?: string;
}

// ── Welcome message ───────────────────────────────────────────

const WELCOME: Message = {
  id: 'welcome',
  role: 'system',
  content:
    'Hi! I\'m your CAS Assist AI.\n\nI can answer questions about the College of Arts and Sciences — programs, requirements, enrollment, schedules, and policies.\n\nIf I can\'t find an answer, I\'ll create a support ticket for you.',
};

// ── Bubble component ──────────────────────────────────────────

function Bubble({
  message,
  bgEl,
  textColor,
  textSec,
}: {
  message: Message;
  bgEl: string;
  textColor: string;
  textSec: string;
}) {
  const isUser   = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowRight]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? styles.bubbleUser
            : isSystem
              ? [styles.bubbleSystem, { backgroundColor: bgEl }]
              : [styles.bubbleAssistant, { backgroundColor: bgEl }],
          { maxWidth: '78%' },
        ]}>
        <Text
          style={[
            styles.bubbleText,
            { color: isUser ? '#fff' : textColor },
          ]}>
          {message.content}
        </Text>
        {message.ticketId && (
          <View style={styles.ticketBadge}>
            <Text style={styles.ticketBadgeText}>
              🎫 Ticket created — our staff will respond shortly.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────

export default function ChatbotScreen() {
  const theme               = useTheme();
  const { profile, session } = useAuth();

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);

  const listRef = useRef<FlatList<Message>>(null);

  const studentId = profile?.id ?? session?.user.id ?? '';

  function addMessage(msg: Omit<Message, 'id'>) {
    const newMsg: Message = { ...msg, id: Date.now().toString() };
    setMessages(prev => {
      const next = [...prev, newMsg];
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      return next;
    });
    return newMsg;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    addMessage({ role: 'user', content: text });
    setSending(true);

    try {
      const res = await apiPost<AIQueryResponse>('/api/ai/query', {
        query: text,
        studentId,
        category: 'general_inquiry',
      });

      if (res.isDeflected) {
        addMessage({
          role: 'assistant',
          content: res.answer!,
          isDeflected: true,
        });
      } else {
        addMessage({
          role: 'assistant',
          content:
            'I couldn\'t find a direct answer in our knowledge base. I\'ve opened a support ticket for you — a CAS staff member will follow up soon.',
          isDeflected: false,
          ticketId: res.ticket?.id,
        });
      }
    } catch (err) {
      addMessage({
        role: 'assistant',
        content:
          'Sorry, I\'m unable to connect right now. Please visit the CAS office directly or try again later.',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* ── Header ────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: theme.backgroundElement }]}>
        <View style={styles.headerDot} />
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>CAS Assistant</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            AI-powered · CAS knowledge base
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>

        {/* ── Messages ──────────────────────────── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <Bubble
              message={item}
              bgEl={theme.backgroundElement}
              textColor={theme.text}
              textSec={theme.textSecondary}
            />
          )}
          ListFooterComponent={
            sending ? (
              <View style={styles.typingRow}>
                <View style={[styles.avatar, { backgroundColor: PRIMARY + '20' }]}>
                  <Text style={styles.avatarText}>AI</Text>
                </View>
                <View style={[styles.typingBubble, { backgroundColor: theme.backgroundElement }]}>
                  <ActivityIndicator size="small" color={PRIMARY} />
                </View>
              </View>
            ) : null
          }
        />

        {/* ── Input bar ─────────────────────────── */}
        <View style={[styles.inputBar, { backgroundColor: theme.background, borderTopColor: theme.backgroundElement }]}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
            placeholder="Ask a question..."
            placeholderTextColor={theme.textSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={400}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={!sending}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: PRIMARY, opacity: pressed || sending || !input.trim() ? 0.5 : 1 },
            ]}
            onPress={handleSend}
            disabled={sending || !input.trim()}>
            <Text style={styles.sendIcon}>↑</Text>
          </Pressable>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },

  // Messages
  messageList: {
    padding: Spacing.three,
    gap: 12,
    paddingBottom: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bubbleRowRight: { flexDirection: 'row-reverse' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  bubbleUser: {
    backgroundColor: PRIMARY,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: { borderBottomLeftRadius: 4 },
  bubbleSystem: {
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    maxWidth: '90%',
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  ticketBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  ticketBadgeText: { fontSize: 12, color: '#92400E' },

  // Typing indicator
  typingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  typingBubble: {
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
