import { useRouter } from 'expo-router';
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

import { Academic, AcademicIcon, IconButton, StatusBadge } from '@/components/ui/academic-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { apiPost } from '@/lib/api';

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

const WELCOME: Message = {
  id: 'welcome',
  role: 'system',
  content:
    'Hi! I can help with advising, enrollment, document requests, schedules, and CAS office guidance.',
};

const SUGGESTIONS = [
  'How do I request advising?',
  'Check my queue status',
  'Enrollment requirements',
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      {!isUser ? (
        <View style={styles.botAvatar}>
          <AcademicIcon
            name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
            color={Academic.primary}
            size={18}
          />
        </View>
      ) : null}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.messageText, isUser && styles.userMessageText]}>{message.content}</Text>
        {message.ticketId ? (
          <View style={styles.ticketNotice}>
            <Text style={styles.ticketNoticeText}>Ticket created. CAS staff will follow up shortly.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function ChatbotScreen() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const studentId = profile?.id ?? session?.user.id ?? '';

  function addMessage(msg: Omit<Message, 'id'>) {
    const newMsg: Message = { ...msg, id: `${Date.now()}-${Math.random()}` };
    setMessages(prev => {
      const next = [...prev, newMsg];
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      return next;
    });
    return newMsg;
  }

  async function sendText(rawText: string) {
    const text = rawText.trim();
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
          content: res.answer ?? 'Here is what I found from the CAS knowledge base.',
          isDeflected: true,
        });
      } else {
        addMessage({
          role: 'assistant',
          content:
            'I could not find a direct answer in the knowledge base. I opened a support ticket so CAS staff can follow up.',
          isDeflected: false,
          ticketId: res.ticket?.id,
        });
      }
    } catch {
      addMessage({
        role: 'assistant',
        content:
          'Sorry, I cannot connect right now. Please coordinate with the CAS office directly or try again later.',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton
          icon={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
          onPress={() => router.back()}
          label="Go back"
          bg={Academic.muted}
          color={Academic.textSecondary}
        />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>CAS Assist Helpdesk</Text>
          <Text style={styles.headerSub}>AI Assistant</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <>
              <View style={styles.noticeBanner}>
                <AcademicIcon
                  name={{ ios: 'info.circle', android: 'info', web: 'info' }}
                  color={Academic.primary}
                  size={18}
                />
                <Text style={styles.noticeText}>
                  For official decisions and approvals, please coordinate with the CAS office.
                </Text>
              </View>
              {messages.length === 1 ? (
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map(text => (
                    <Pressable
                      key={text}
                      onPress={() => sendText(text)}
                      style={({ pressed }) => [styles.suggestionChip, pressed && styles.pressed]}>
                      <Text style={styles.suggestionText}>{text}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          }
          renderItem={({ item }) => <MessageBubble message={item} />}
          ListFooterComponent={
            sending ? (
              <View style={styles.typingRow}>
                <View style={styles.botAvatar}>
                  <AcademicIcon
                    name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                    color={Academic.primary}
                    size={18}
                  />
                </View>
                <View style={styles.typingBubble}>
                  <ActivityIndicator size="small" color={Academic.primary} />
                  <StatusBadge label="Thinking" tone="blue" />
                </View>
              </View>
            ) : null
          }
        />

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor={Academic.textSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={400}
            returnKeyType="send"
            onSubmitEditing={() => sendText(input)}
            editable={!sending}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              (!input.trim() || sending || pressed) && styles.sendButtonMuted,
            ]}
            onPress={() => sendText(input)}
            disabled={sending || !input.trim()}>
            <AcademicIcon
              name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
              color="#FFFFFF"
              size={20}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Academic.background },
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: 12,
  },
  headerText: { flex: 1, gap: 2 },
  headerTitle: { color: Academic.navy, fontSize: 19, fontWeight: '900' },
  headerSub: { color: Academic.textSecondary, fontSize: 13, fontWeight: '700' },
  messageList: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: 14,
  },
  noticeBanner: {
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: Academic.softBlue,
  },
  noticeText: { color: Academic.navy, fontSize: 13, lineHeight: 18, flex: 1 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  suggestionChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
  },
  suggestionText: { color: Academic.primary, fontSize: 13, fontWeight: '800' },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  messageRowUser: { flexDirection: 'row-reverse' },
  botAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.softBlue,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  assistantBubble: {
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
    borderBottomLeftRadius: 5,
  },
  userBubble: {
    backgroundColor: Academic.primary,
    borderBottomRightRadius: 5,
  },
  messageText: { color: Academic.navy, fontSize: 14, lineHeight: 20 },
  userMessageText: { color: '#FFFFFF' },
  ticketNotice: { borderRadius: 10, padding: 8, backgroundColor: Academic.warningBg },
  ticketNoticeText: { color: Academic.warningText, fontSize: 12, fontWeight: '800' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Academic.card,
    borderWidth: 1,
    borderColor: Academic.border,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: Academic.card,
    borderTopWidth: 1,
    borderTopColor: Academic.border,
  },
  input: {
    flex: 1,
    maxHeight: 104,
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: Academic.navy,
    backgroundColor: Academic.muted,
    fontSize: 15,
    lineHeight: 20,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Academic.primary,
  },
  sendButtonMuted: { opacity: 0.5 },
});
