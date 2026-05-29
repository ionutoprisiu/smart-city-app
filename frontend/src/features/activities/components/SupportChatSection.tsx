import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { extractErrorMessage } from '@shared/api/errors';
import { useTheme } from '@theme';
import { ChatApi } from '../api/chatApi';
import { useActivityChatSocket } from '../hooks/useActivityChatSocket';
import { ActivityChatMessage } from '../types';

type Props = {
  kind: 'event' | 'club';
  resourceId: number;
  currentUserId?: number;
  canView: boolean;
  canPostOrganizer: boolean;
  pendingHint?: string | null;
};

const fmtChatDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const roleLabel = (m: ActivityChatMessage, currentUserId?: number) => {
  if (m.isAutoReply) return 'Auto-reply from organizer';
  if (m.senderUserId === currentUserId) return m.role === 'ORGANIZER' ? 'You (organizer)' : 'You';
  return m.role === 'ORGANIZER' ? 'Organizer' : 'User';
};

export const SupportChatSection: React.FC<Props> = ({
  kind,
  resourceId,
  currentUserId,
  canView,
  canPostOrganizer,
  pendingHint = null,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [sendRole, setSendRole] = useState<'USER' | 'ORGANIZER'>('USER');
  const chatScrollRef = useRef<ScrollView>(null);

  const appendMessage = useCallback((message: ActivityChatMessage) => {
    setItems((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
    requestAnimationFrame(() => chatScrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const handleSocketError = useCallback((message: string) => {
    setHint(message);
  }, []);

  const liveEnabled = expanded && canView && currentUserId != null;
  const { sendMessage } = useActivityChatSocket({
    kind,
    resourceId,
    enabled: liveEnabled,
    onMessage: appendMessage,
    onSocketError: handleSocketError,
  });

  const load = useCallback(async () => {
    if (currentUserId == null) {
      setHint('Sign in to open support chat.');
      setItems([]);
      return;
    }
    if (!canView) {
      setHint(
        pendingHint ??
          (kind === 'club'
            ? 'Only approved members can open this club chat.'
            : 'You do not have access to this chat.'),
      );
      setItems([]);
      return;
    }
    setLoading(true);
    setHint(null);
    try {
      const list =
        kind === 'event'
          ? await ChatApi.listEventMessages(resourceId)
          : await ChatApi.listClubMessages(resourceId);
      setItems(list);
    } catch (e: unknown) {
      setHint(extractErrorMessage(e) || 'Could not load chat');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [canView, currentUserId, kind, pendingHint, resourceId]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      load().catch(() => {});
    }
  };

  const onSend = async () => {
    if (!currentUserId || !body.trim()) return;
    if (sendRole === 'ORGANIZER' && !canPostOrganizer) return;
    setPosting(true);
    setHint(null);
    try {
      await sendMessage({ role: sendRole, body: body.trim() });
      setBody('');
    } catch (e: unknown) {
      setHint(extractErrorMessage(e) || 'Could not send message');
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.headerRow, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Icon name="chat" size={18} color={theme.colors.primary} />
        <Text
          style={[
            theme.typography.labelLarge,
            styles.headerTitle,
            { color: theme.colors.primary },
          ]}
        >
          {expanded ? 'Hide support chat' : 'Support chat'}
        </Text>
        <Icon name={expanded ? 'expand-less' : 'expand-more'} size={22} color={theme.colors.onSurfaceVariant} />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {loading ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}
          {hint ? (
            <Text
              style={[
                theme.typography.bodySmall,
                styles.hintText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {hint}
            </Text>
          ) : null}

          <ScrollView
            ref={chatScrollRef}
            nestedScrollEnabled
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
          >
            {items.map((m) => (
              <View
                key={`chat-${m.id}`}
                style={[
                  styles.msgCard,
                  {
                    backgroundColor: m.isAutoReply
                      ? theme.colors.primaryContainer + '66'
                      : theme.colors.surfaceContainerLow,
                    borderColor: theme.colors.outlineVariant + '4D',
                  },
                ]}
              >
                {m.isAutoReply ? (
                  <View style={styles.badgeRow}>
                    <Icon name="smart-toy" size={14} color={theme.colors.primary} />
                    <Text
                      style={[
                        theme.typography.labelSmall,
                        styles.autoReplyLabel,
                        { color: theme.colors.primary },
                      ]}
                    >
                      AUTO REPLY
                    </Text>
                  </View>
                ) : null}
                <Text style={[theme.typography.labelSmall, { color: theme.colors.onSurfaceVariant }]}>
                  {roleLabel(m, currentUserId)} • {fmtChatDate(m.createdAt)}
                </Text>
                <Text
                  style={[theme.typography.bodyMedium, styles.msgBody, { color: theme.colors.onSurface }]}
                >
                  {m.body}
                </Text>
              </View>
            ))}
          </ScrollView>

          {canView && currentUserId ? (
            <View style={[styles.compose, { borderTopColor: theme.colors.outlineVariant + '40' }]}>
              {canPostOrganizer ? (
                <View style={styles.roleRow}>
                  <Pressable
                    onPress={() => setSendRole('USER')}
                    style={[
                      styles.rolePill,
                      {
                        backgroundColor:
                          sendRole === 'USER' ? theme.colors.primaryContainer : theme.colors.surfaceContainerHigh,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.labelSmall,
                        {
                          color:
                            sendRole === 'USER'
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      Ask as user
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSendRole('ORGANIZER')}
                    style={[
                      styles.rolePill,
                      {
                        backgroundColor:
                          sendRole === 'ORGANIZER'
                            ? theme.colors.primaryContainer
                            : theme.colors.surfaceContainerHigh,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.labelSmall,
                        {
                          color:
                            sendRole === 'ORGANIZER'
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      Reply as organizer
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={sendRole === 'ORGANIZER' ? 'Reply to users...' : 'Ask organizer something...'}
                placeholderTextColor={theme.colors.onSurfaceVariant}
                multiline
                maxLength={8000}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surfaceContainerHigh,
                    color: theme.colors.onSurface,
                  },
                ]}
              />
              <View style={styles.composeMetaRow}>
                <Text style={[theme.typography.labelSmall, { color: theme.colors.onSurfaceVariant }]}>
                  {sendRole === 'ORGANIZER'
                    ? 'Tip: answer clearly so AI can reuse this reply for similar questions.'
                    : 'Ask one concrete question for better matching.'}
                </Text>
                <Text style={[theme.typography.labelSmall, { color: theme.colors.onSurfaceVariant }]}>
                  {body.length}/8000
                </Text>
              </View>
              <Pressable
                onPress={onSend}
                disabled={posting || body.trim().length < 1}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: body.trim() ? theme.colors.primary : theme.colors.surfaceContainerHigh,
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.labelLarge,
                    { color: body.trim() ? theme.colors.onPrimary : theme.colors.onSurfaceVariant },
                  ]}
                >
                  {posting ? 'Sending…' : 'Send'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  headerTitle: { marginLeft: 8, flex: 1 },
  hintText: { marginBottom: 8 },
  autoReplyLabel: { marginLeft: 4 },
  msgBody: { marginTop: 6 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  body: { marginTop: 4 },
  loader: { marginVertical: 8 },
  chatList: { maxHeight: 260 },
  chatListContent: { paddingBottom: 4 },
  msgCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  compose: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  rolePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  composeMetaRow: {
    marginTop: 2,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sendBtn: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 8,
  },
});
