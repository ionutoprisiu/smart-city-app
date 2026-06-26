import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { extractErrorMessage } from '@shared/api/errors';
import { Icon } from '@shared/components/Icon';
import { Spinner } from '@shared/components/Spinner';
import { ChatApi } from '../api/chatApi';
import { useActivityChatSocket } from '../hooks/useActivityChatSocket';
import { ActivityChatMessage, ActivityChatThread } from '../types';

type Props = {
  variant?: 'inline' | 'page';
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

const fmtRelative = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleDateString();
};

const emailLabel = (email: string) => (email.includes('@') ? email.split('@')[0] : email);

const roleLabel = (m: ActivityChatMessage, currentUserId?: number, isOrganizer?: boolean) => {
  if (m.isAutoReply) {
    if (isOrganizer) return m.isApproved ? 'AI reply · verified' : 'AI reply · pending review';
    return 'Organizer';
  }
  if (m.senderUserId === currentUserId) return m.role === 'ORGANIZER' ? 'You (organizer)' : 'You';
  return m.role === 'ORGANIZER' ? 'Organizer' : 'Member';
};

const hasResolvedAnswer = (items: ActivityChatMessage[], questionId: number) =>
  items.some(
    (m) =>
      m.role === 'ORGANIZER' &&
      m.inReplyToMessageId === questionId &&
      (!m.isAutoReply || m.isApproved),
  );

const hasManualAnswer = (items: ActivityChatMessage[], questionId: number) =>
  items.some(
    (m) =>
      m.role === 'ORGANIZER' &&
      m.inReplyToMessageId === questionId &&
      !m.isAutoReply,
  );

const hasPendingAutoReply = (items: ActivityChatMessage[], questionId: number) =>
  items.some(
    (m) =>
      m.role === 'ORGANIZER' &&
      m.inReplyToMessageId === questionId &&
      m.isAutoReply &&
      !m.isApproved,
  );

const threadNeedsAttention = (t: ActivityChatThread) => t.lastMessageRole === 'USER';

const mergeMessages = (
  existing: ActivityChatMessage[],
  incoming: ActivityChatMessage[],
): ActivityChatMessage[] => {
  const byId = new Map<number, ActivityChatMessage>();
  for (const message of existing) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => {
    const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return byTime !== 0 ? byTime : a.id - b.id;
  });
};

const bubbleRadius = (outgoing: boolean) =>
  outgoing ? '16px 16px 4px 16px' : '16px 16px 16px 4px';

export const SupportChatSection: React.FC<Props> = ({
  variant = 'inline',
  kind,
  resourceId,
  currentUserId,
  canView,
  canPostOrganizer,
  pendingHint = null,
}) => {
  const isPage = variant === 'page';
  const isOrganizer = canPostOrganizer;

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const [threads, setThreads] = useState<ActivityChatThread[]>([]);
  const [activeThreadUserId, setActiveThreadUserId] = useState<number | null>(null);
  const [activeThreadEmail, setActiveThreadEmail] = useState<string | null>(null);

  const [items, setItems] = useState<ActivityChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<ActivityChatMessage | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const composeInputRef = useRef<HTMLTextAreaElement | null>(null);
  const loadSeqRef = useRef(0);
  const pollTimersRef = useRef<number[]>([]);
  const wasSocketConnectedRef = useRef(false);
  const lastPolledUserMessageRef = useRef<number | null>(null);

  const conversationOpen = isOrganizer ? activeThreadUserId != null : true;
  const threadUserId = isOrganizer ? activeThreadUserId : currentUserId ?? null;

  const findMessage = useCallback(
    (id: number | null) => (id == null ? null : items.find((m) => m.id === id) ?? null),
    [items],
  );

  const selectQuestionToAnswer = useCallback((target: ActivityChatMessage) => {
    setReplyTo(target);
    setHint(null);
    requestAnimationFrame(() => composeInputRef.current?.focus());
  }, []);

  const scrollChatToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = chatScrollRef.current;
      if (el != null) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const appendMessage = useCallback(
    (message: ActivityChatMessage) => {
      if (
        threadUserId != null &&
        message.threadUserId != null &&
        message.threadUserId !== threadUserId
      ) {
        return;
      }
      setItems((prev) => {
        const idx = prev.findIndex((m) => m.id === message.id);
        const next =
          idx >= 0
            ? (() => {
                const copy = [...prev];
                copy[idx] = message;
                return copy;
              })()
            : mergeMessages(prev, [message]);
        return next;
      });
      scrollChatToEnd();
    },
    [threadUserId, scrollChatToEnd],
  );

  const handleMessageDeleted = useCallback(
    (payload: { messageId: number; inReplyToMessageId: number | null }) => {
      setItems((prev) => {
        if (isOrganizer && payload.inReplyToMessageId != null) {
          const question = prev.find((m) => m.id === payload.inReplyToMessageId);
          if (question) {
            requestAnimationFrame(() => selectQuestionToAnswer(question));
          }
        }
        return prev.filter((m) => m.id !== payload.messageId);
      });
    },
    [isOrganizer, selectQuestionToAnswer],
  );

  const handleSocketError = useCallback((message: string) => {
    setHint(message);
  }, []);

  const chatActive = isPage || expanded;
  const liveEnabled = chatActive && canView && currentUserId != null && conversationOpen;
  const { sendMessage, approveAutoReply, rejectAutoReply, connectionStatus, retryConnection } =
    useActivityChatSocket({
    kind,
    resourceId,
    enabled: liveEnabled,
    threadUserId,
    onMessage: appendMessage,
    onMessageDeleted: handleMessageDeleted,
    onSocketError: handleSocketError,
  });

  const chatReady = connectionStatus === 'connected';
  const chatConnecting = connectionStatus === 'connecting';
  const chatOffline = liveEnabled && connectionStatus === 'error';

  const threadsNeedingAttention = threads.filter(threadNeedsAttention).length;

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setHint(null);
    try {
      const list =
        kind === 'event'
          ? await ChatApi.listEventThreads(resourceId)
          : await ChatApi.listClubThreads(resourceId);
      setThreads(list);
      if (list.length === 0) {
        setHint('No support conversations yet. Members will appear here when they message you.');
      }
    } catch (e: unknown) {
      setHint(extractErrorMessage(e) || 'Could not load conversations');
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [kind, resourceId]);

  const loadConversation = useCallback(
    async (forThreadUserId?: number | null) => {
      const seq = ++loadSeqRef.current;
      setLoading(true);
      setHint(null);
      try {
        const list =
          kind === 'event'
            ? await ChatApi.listEventMessages(resourceId, forThreadUserId ?? undefined)
            : await ChatApi.listClubMessages(resourceId, forThreadUserId ?? undefined);
        if (seq !== loadSeqRef.current) return;
        setItems((prev) => mergeMessages(prev, list));
        lastPolledUserMessageRef.current = null;
        scrollChatToEnd();
      } catch (e: unknown) {
        if (seq !== loadSeqRef.current) return;
        setHint(extractErrorMessage(e) || 'Could not load chat');
        setItems([]);
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [kind, resourceId, scrollChatToEnd],
  );

  const clearPollTimers = useCallback(() => {
    pollTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    pollTimersRef.current = [];
  }, []);

  const pollForAutoReply = useCallback(
    (_questionMessageId: number, forThreadUserId: number | null | undefined) => {
      if (forThreadUserId == null) return;
      clearPollTimers();

      const delays = [2500, 6000, 12000, 25000, 45000, 90000, 120000];
      delays.forEach((delay) => {
        const timer = window.setTimeout(async () => {
          try {
            const list =
              kind === 'event'
                ? await ChatApi.listEventMessages(resourceId, forThreadUserId)
                : await ChatApi.listClubMessages(resourceId, forThreadUserId);
            setItems((prev) => mergeMessages(prev, list));
          } catch {
            /* silent background refresh */
          }
        }, delay);
        pollTimersRef.current.push(timer);
      });
    },
    [clearPollTimers, kind, resourceId],
  );

  useEffect(() => () => clearPollTimers(), [clearPollTimers]);

  useEffect(() => {
    if (!canView || !conversationOpen) return;
    const thread = isOrganizer ? activeThreadUserId : currentUserId;
    if (thread == null) return;
    const userMessages = items.filter((m) => m.role === 'USER');
    const latest = userMessages[userMessages.length - 1];
    if (!latest) return;
    if (hasResolvedAnswer(items, latest.id)) return;
    if (hasPendingAutoReply(items, latest.id)) return;
    const hasAutoReply = items.some(
      (m) => m.isAutoReply && m.inReplyToMessageId === latest.id,
    );
    if (hasAutoReply || lastPolledUserMessageRef.current === latest.id) return;
    lastPolledUserMessageRef.current = latest.id;
    pollForAutoReply(latest.id, thread);
  }, [
    items,
    isOrganizer,
    activeThreadUserId,
    currentUserId,
    canView,
    conversationOpen,
    pollForAutoReply,
  ]);

  useEffect(() => {
    if (!isPage || !canView) return undefined;
    const refreshConversation = () => {
      if (document.visibilityState !== 'visible') return;
      const thread = isOrganizer ? activeThreadUserId : currentUserId;
      if (thread == null) return;
      lastPolledUserMessageRef.current = null;
      loadConversation(thread).catch(() => {});
    };
    document.addEventListener('visibilitychange', refreshConversation);
    return () => document.removeEventListener('visibilitychange', refreshConversation);
  }, [isPage, canView, isOrganizer, activeThreadUserId, currentUserId, loadConversation]);

  const openThread = useCallback(
    (thread: ActivityChatThread) => {
      lastPolledUserMessageRef.current = null;
      clearPollTimers();
      setActiveThreadUserId(thread.threadUserId);
      setActiveThreadEmail(thread.userEmail);
      setItems([]);
      setReplyTo(null);
      loadConversation(thread.threadUserId).catch(() => {});
    },
    [clearPollTimers, loadConversation],
  );

  const backToInbox = useCallback(() => {
    lastPolledUserMessageRef.current = null;
    clearPollTimers();
    setActiveThreadUserId(null);
    setActiveThreadEmail(null);
    setItems([]);
    setReplyTo(null);
    loadThreads().catch(() => {});
  }, [clearPollTimers, loadThreads]);

  const openChat = useCallback(() => {
    if (currentUserId == null) {
      setHint('Sign in to open support chat.');
      return;
    }
    if (!canView) {
      setHint(
        pendingHint ??
          (kind === 'club'
            ? 'Only approved members can open this club chat.'
            : 'You do not have access to this chat.'),
      );
      return;
    }
    if (isOrganizer) {
      loadThreads().catch(() => {});
    } else if (currentUserId != null) {
      lastPolledUserMessageRef.current = null;
      loadConversation(currentUserId).catch(() => {});
    }
  }, [canView, currentUserId, isOrganizer, kind, loadConversation, loadThreads, pendingHint]);

  useEffect(() => {
    if (isPage) {
      openChat();
    }
  }, [isPage, openChat]);

  useEffect(() => {
    if (!chatReady || !liveEnabled || !conversationOpen) {
      if (!chatReady) wasSocketConnectedRef.current = false;
      return;
    }
    if (wasSocketConnectedRef.current) return;
    wasSocketConnectedRef.current = true;

    const thread = isOrganizer ? activeThreadUserId : currentUserId;
    if (thread == null) return;
    loadConversation(thread).catch(() => {});
  }, [
    chatReady,
    liveEnabled,
    conversationOpen,
    isOrganizer,
    activeThreadUserId,
    currentUserId,
    loadConversation,
  ]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      openChat();
    }
  };

  const showBody = chatActive;

  const canSendMessage = chatReady && !posting && body.trim().length > 0;

  const onApproveAutoReply = async (messageId: number) => {
    setApprovingId(messageId);
    setHint(null);
    try {
      if (chatReady) {
        await approveAutoReply(messageId);
      } else {
        const updated =
          kind === 'event'
            ? await ChatApi.approveEventAutoReply(resourceId, messageId)
            : await ChatApi.approveClubAutoReply(resourceId, messageId);
        setItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      }
    } catch (e: unknown) {
      setHint(extractErrorMessage(e) || 'Could not approve auto-reply');
    } finally {
      setApprovingId(null);
    }
  };

  const onRejectAutoReply = async (messageId: number) => {
    setRejectingId(messageId);
    setHint(null);
    try {
      if (chatReady) {
        await rejectAutoReply(messageId);
      } else {
        const deleted =
          kind === 'event'
            ? await ChatApi.rejectEventAutoReply(resourceId, messageId)
            : await ChatApi.rejectClubAutoReply(resourceId, messageId);
        handleMessageDeleted({
          messageId: deleted.messageId,
          inReplyToMessageId: deleted.inReplyToMessageId,
        });
      }
    } catch (e: unknown) {
      setHint(extractErrorMessage(e) || 'Could not reject auto-reply');
    } finally {
      setRejectingId(null);
    }
  };

  const onSend = async () => {
    if (!currentUserId || !body.trim()) return;
    if (!chatReady) {
      setHint('Chat is not connected. Wait a moment or tap Retry.');
      return;
    }
    if (isOrganizer && activeThreadUserId == null) return;

    setPosting(true);
    setHint(null);
    const sentBody = body.trim();
    const replyTargetId = isOrganizer ? replyTo?.id ?? null : null;
    try {
      const result = await sendMessage({
        role: isOrganizer ? 'ORGANIZER' : 'USER',
        body: sentBody,
        inReplyToMessageId: isOrganizer ? replyTargetId : null,
        threadUserId: isOrganizer ? activeThreadUserId : currentUserId,
      });
      setBody('');
      if (isOrganizer) {
        setReplyTo(null);
        clearPollTimers();
      } else if (result.messageId != null) {
        pollForAutoReply(result.messageId, currentUserId);
      }
    } catch (e: unknown) {
      const msg = extractErrorMessage(e) || 'Could not send message';
      setHint(msg);
      if (msg.toLowerCase().includes('timed out')) {
        setBody('');
        setReplyTo(null);
      }
    } finally {
      setPosting(false);
    }
  };

  const showInbox = isOrganizer && activeThreadUserId == null;
  const showConversation = !isOrganizer || activeThreadUserId != null;

  const displayItems = useMemo(
    () =>
      isOrganizer
        ? items
        : items.filter((m) => !(m.isAutoReply && !m.isApproved)),
    [items, isOrganizer],
  );

  const inboxBadgeCount =
    threadsNeedingAttention > 0 ? threadsNeedingAttention : threads.length;

  return (
    <div
      style={
        isPage
          ? { marginTop: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
          : { marginTop: 12 }
      }
    >
      {!isPage ? (
        <button
          type="button"
          onClick={toggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 0',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <Icon name={isOrganizer ? 'forum' : 'chat'} size={18} color="var(--primary)" />
          <span className="label-large" style={{ color: 'var(--primary)', marginLeft: 8, flex: 1 }}>
            {expanded
              ? 'Hide support chat'
              : isOrganizer
                ? 'Member messages'
                : 'Support chat'}
          </span>
          {isOrganizer && !expanded && threads.length > 0 ? (
            <span
              className="label-small"
              style={{
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                padding: '0 6px',
                marginRight: 8,
                background: threadsNeedingAttention > 0 ? 'var(--error)' : 'var(--primary)',
                color: threadsNeedingAttention > 0 ? 'var(--on-error, #fff)' : 'var(--on-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {inboxBadgeCount}
            </span>
          ) : null}
          <Icon
            name={expanded ? 'expand-less' : 'expand-more'}
            size={22}
            color="var(--on-surface-variant)"
          />
        </button>
      ) : null}

      {showBody ? (
        <div
          style={
            isPage
              ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginTop: 4 }
              : { marginTop: 4 }
          }
        >
          {loading ? <Spinner size="small" style={{ margin: '8px auto' }} /> : null}

          {showConversation && liveEnabled && !chatReady ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 10,
                padding: '8px 10px',
                marginBottom: 8,
                background: chatOffline ? 'var(--error-container)' : 'var(--surface-container-high)',
              }}
            >
              {chatConnecting ? (
                <Spinner size="small" />
              ) : (
                <Icon name="wifi-off" size={18} color="var(--error)" />
              )}
              <span
                className="label-medium"
                style={{
                  flex: 1,
                  color: chatOffline ? 'var(--error)' : 'var(--on-surface-variant)',
                }}
              >
                {chatOffline ? 'Could not connect to chat' : 'Connecting to chat…'}
              </span>
              {chatOffline ? (
                <button
                  type="button"
                  onClick={() => {
                    setHint(null);
                    retryConnection();
                  }}
                  style={{
                    borderRadius: 8,
                    padding: '6px 10px',
                    background: 'var(--error)',
                    color: 'var(--on-error, #fff)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}

          {hint ? (
            <div
              className="body-small"
              style={{
                marginBottom: 8,
                color: chatOffline ? 'var(--error)' : 'var(--on-surface-variant)',
              }}
            >
              {hint}
            </div>
          ) : null}

          {showInbox ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span className="label-medium" style={{ color: 'var(--on-surface-variant)' }}>
                  Private conversations with members
                </span>
                <button type="button" onClick={() => loadThreads().catch(() => {})}>
                  <Icon name="refresh" size={18} color="var(--primary)" />
                </button>
              </div>
              {threads.map((t) => {
                const needsAttention = threadNeedsAttention(t);
                return (
                  <button
                    key={`thread-${t.threadUserId}`}
                    type="button"
                    onClick={() => openThread(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      border: `1px solid ${
                        needsAttention
                          ? 'color-mix(in srgb, var(--primary) 45%, transparent)'
                          : 'color-mix(in srgb, var(--outline-variant) 30%, transparent)'
                      }`,
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 8,
                      width: '100%',
                      textAlign: 'left',
                      background: needsAttention
                        ? 'color-mix(in srgb, var(--primary-container) 25%, var(--surface-container-low))'
                        : 'var(--surface-container-low)',
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        background: 'var(--primary-container)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span className="title-small" style={{ color: 'var(--on-primary-container)' }}>
                        {emailLabel(t.userEmail).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span
                          className="title-small"
                          style={{
                            flex: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {emailLabel(t.userEmail)}
                        </span>
                        <span className="label-small" style={{ color: 'var(--on-surface-variant)' }}>
                          {fmtRelative(t.lastMessageAt)}
                        </span>
                      </div>
                      <div
                        className="body-small"
                        style={{
                          color: 'var(--on-surface-variant)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {needsAttention ? (
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            Needs reply ·{' '}
                          </span>
                        ) : t.lastMessageRole === 'ORGANIZER' ? (
                          'Tu: '
                        ) : (
                          ''
                        )}
                        {t.lastMessageBody}
                      </div>
                    </div>
                    <Icon name="chevron-right" size={20} color="var(--on-surface-variant)" />
                  </button>
                );
              })}
            </div>
          ) : null}

          {showConversation ? (
            <div
              style={
                isPage
                  ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
                  : undefined
              }
            >
              {isOrganizer ? (
                <button
                  type="button"
                  onClick={backToInbox}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 0',
                    marginBottom: 2,
                  }}
                >
                  <Icon name="arrow-back" size={18} color="var(--primary)" />
                  <span className="label-large" style={{ color: 'var(--primary)', marginLeft: 6 }}>
                    {activeThreadEmail ? emailLabel(activeThreadEmail) : 'Conversation'}
                  </span>
                </button>
              ) : null}

              <div
                ref={chatScrollRef}
                style={
                  isPage
                    ? {
                        flex: 1,
                        minHeight: 200,
                        overflowY: 'auto',
                        paddingBottom: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }
                    : {
                        maxHeight: 260,
                        overflowY: 'auto',
                        paddingBottom: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }
                }
              >
                {displayItems.length === 0 && !loading ? (
                  <div
                    className="body-small"
                    style={{
                      textAlign: 'center',
                      padding: '16px 0',
                      color: 'var(--on-surface-variant)',
                    }}
                  >
                    {isOrganizer
                      ? 'No messages in this conversation yet.'
                      : 'Send a message to start a private conversation with the organizer.'}
                  </div>
                ) : null}

                {displayItems.map((m) => {
                  const quoted = findMessage(m.inReplyToMessageId);
                  const isOutgoing = isOrganizer ? m.role === 'ORGANIZER' : m.role === 'USER';
                  const isMemberQuestion = isOrganizer && m.role === 'USER';
                  const isReplyTarget = replyTo?.id === m.id;
                  const resolved = isMemberQuestion ? hasResolvedAnswer(items, m.id) : false;
                  const manualAnswered = isMemberQuestion ? hasManualAnswer(items, m.id) : false;
                  const pendingAuto = isMemberQuestion ? hasPendingAutoReply(items, m.id) : false;
                  const pendingAutoMessage =
                    isOrganizer && m.isAutoReply && !m.isApproved ? m : null;

                  const bubbleBg = m.isAutoReply
                    ? m.isApproved
                      ? 'color-mix(in srgb, var(--primary-container) 55%, var(--surface-container-low))'
                      : 'color-mix(in srgb, var(--tertiary-container, var(--secondary-container)) 60%, var(--surface-container-low))'
                    : isOutgoing
                      ? 'var(--primary)'
                      : 'var(--surface-container-high)';

                  const bubbleColor = isOutgoing && !m.isAutoReply
                    ? 'var(--on-primary)'
                    : 'var(--on-surface)';

                  const metaColor = isOutgoing && !m.isAutoReply
                    ? 'color-mix(in srgb, var(--on-primary) 75%, transparent)'
                    : 'var(--on-surface-variant)';

                  return (
                    <div
                      key={`chat-${m.id}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isOutgoing ? 'flex-end' : 'flex-start',
                        maxWidth: '88%',
                        alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          borderRadius: bubbleRadius(isOutgoing),
                          padding: '10px 12px',
                          background: bubbleBg,
                          color: bubbleColor,
                          width: '100%',
                          border: isReplyTarget
                            ? '2px solid var(--primary)'
                            : '1px solid color-mix(in srgb, var(--outline-variant) 20%, transparent)',
                          boxShadow: isReplyTarget
                            ? '0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent)'
                            : undefined,
                        }}
                      >
                        {m.isAutoReply && isOrganizer ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: 4,
                              gap: 4,
                            }}
                          >
                            <Icon
                              name={m.isApproved ? 'verified' : 'smart-toy'}
                              size={13}
                              color={m.isApproved ? 'var(--primary)' : 'var(--tertiary, var(--primary))'}
                            />
                            <span
                              className="label-small"
                              style={{
                                color: m.isApproved ? 'var(--primary)' : 'var(--on-surface-variant)',
                              }}
                            >
                              {m.isApproved ? 'Verified answer' : 'AI answer · needs review'}
                            </span>
                            {m.isApproved ? (
                              <Icon name="check-circle" size={14} color="var(--primary)" />
                            ) : null}
                          </div>
                        ) : null}

                        {quoted ? (
                          <div
                            style={{
                              borderLeft: `3px solid ${
                                isOutgoing && !m.isAutoReply ? 'var(--on-primary)' : 'var(--primary)'
                              }`,
                              borderRadius: 6,
                              padding: '4px 8px',
                              marginBottom: 6,
                              background: isOutgoing && !m.isAutoReply
                                ? 'color-mix(in srgb, var(--on-primary) 12%, transparent)'
                                : 'var(--surface-container-low)',
                              opacity: 0.92,
                            }}
                          >
                            <span
                              className="label-small"
                              style={{
                                color: isOutgoing && !m.isAutoReply
                                  ? 'color-mix(in srgb, var(--on-primary) 80%, transparent)'
                                  : 'var(--on-surface-variant)',
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {quoted.body}
                            </span>
                          </div>
                        ) : null}

                        <div className="label-small" style={{ color: metaColor }}>
                          {roleLabel(m, currentUserId, isOrganizer)} · {fmtChatDate(m.createdAt)}
                        </div>
                        <div className="body-medium" style={{ marginTop: 4, lineHeight: '22px' }}>
                          {m.body}
                        </div>
                      </div>

                      {pendingAutoMessage ? (
                        <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => onApproveAutoReply(pendingAutoMessage.id)}
                            disabled={
                              approvingId === pendingAutoMessage.id ||
                              rejectingId === pendingAutoMessage.id
                            }
                            style={{
                              borderRadius: 8,
                              padding: '6px 12px',
                              background: 'var(--primary)',
                              color: 'var(--on-primary)',
                              fontSize: 13,
                              fontWeight: 600,
                              opacity: approvingId === pendingAutoMessage.id ? 0.7 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Icon name="check" size={16} color="var(--on-primary)" />
                            {approvingId === pendingAutoMessage.id ? 'Approving…' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectAutoReply(pendingAutoMessage.id)}
                            disabled={
                              approvingId === pendingAutoMessage.id ||
                              rejectingId === pendingAutoMessage.id
                            }
                            style={{
                              borderRadius: 8,
                              padding: '6px 12px',
                              background: 'var(--error-container)',
                              color: 'var(--error)',
                              fontSize: 13,
                              fontWeight: 600,
                              opacity: rejectingId === pendingAutoMessage.id ? 0.7 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Icon name="close" size={16} color="var(--error)" />
                            {rejectingId === pendingAutoMessage.id ? 'Removing…' : 'Deny & reply'}
                          </button>
                        </div>
                      ) : null}

                      {isMemberQuestion ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          {!resolved && !pendingAuto ? (
                            <span
                              className="label-small"
                              style={{
                                color: 'var(--error)',
                                background: 'var(--error-container)',
                                borderRadius: 8,
                                padding: '2px 8px',
                              }}
                            >
                              Needs reply
                            </span>
                          ) : null}
                          {pendingAuto && !manualAnswered ? (
                            <span
                              className="label-small"
                              style={{
                                color: 'var(--primary)',
                                background: 'color-mix(in srgb, var(--primary-container) 50%, transparent)',
                                borderRadius: 8,
                                padding: '2px 8px',
                              }}
                            >
                              AI sent answer · approve or deny
                            </span>
                          ) : null}
                          {!resolved && !pendingAuto ? (
                            <button
                              type="button"
                              onClick={() => selectQuestionToAnswer(m)}
                              style={{
                                borderRadius: 8,
                                padding: '6px 12px',
                                background: isReplyTarget
                                  ? 'var(--primary)'
                                  : 'var(--surface-container-high)',
                                color: isReplyTarget ? 'var(--on-primary)' : 'var(--primary)',
                                fontSize: 13,
                                fontWeight: 600,
                                border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
                              }}
                            >
                              Reply to question
                            </button>
                          ) : resolved ? (
                            <span
                              className="label-small"
                              style={{
                                color: 'var(--on-surface-variant)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {manualAnswered ? (
                                'Reply sent'
                              ) : (
                                <>
                                  <Icon name="check-circle" size={14} color="var(--primary)" />
                                  AI answer verified
                                </>
                              )}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {!isOrganizer && m.role === 'USER' && !hasResolvedAnswer(items, m.id) ? (
                        <span
                          className="label-small"
                          style={{
                            marginTop: 6,
                            color: 'var(--on-surface-variant)',
                            background: 'var(--surface-container-high)',
                            borderRadius: 8,
                            padding: '2px 8px',
                          }}
                        >
                          Awaiting organizer reply
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {canView && currentUserId ? (
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 12,
                    borderTop: '1px solid color-mix(in srgb, var(--outline-variant) 25%, transparent)',
                  }}
                >
                  {isOrganizer && replyTo ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        borderLeft: '3px solid var(--primary)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        marginBottom: 8,
                        background: 'color-mix(in srgb, var(--primary-container) 30%, transparent)',
                      }}
                    >
                      <Icon name="format-quote" size={16} color="var(--primary)" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="label-small" style={{ color: 'var(--primary)' }}>
                          Replying to question
                        </div>
                        <div
                          className="body-small"
                          style={{
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {replyTo.body}
                        </div>
                      </div>
                      <button type="button" onClick={() => setReplyTo(null)} aria-label="Clear reply target">
                        <Icon name="close" size={18} color="var(--on-surface-variant)" />
                      </button>
                    </div>
                  ) : null}

                  <textarea
                    ref={composeInputRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={
                      isOrganizer
                        ? 'Write a message to this member…'
                        : 'Ask the organizer something…'
                    }
                    maxLength={8000}
                    style={{
                      borderRadius: 10,
                      padding: '10px 12px',
                      minHeight: 70,
                      width: '100%',
                      resize: 'vertical',
                      background: 'var(--surface-container-high)',
                      color: 'var(--on-surface)',
                      fontSize: 14,
                    }}
                  />
                  <div
                    style={{
                      marginTop: 2,
                      marginBottom: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {isOrganizer ? (
                      <span className="label-small" style={{ color: 'var(--on-surface-variant)' }}>
                        {replyTo
                          ? 'Linked to a question for AI reuse.'
                          : 'Free message — use Reply to question when answering a specific ask.'}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="label-small" style={{ color: 'var(--on-surface-variant)' }}>
                      {body.length}/8000
                    </span>
                  </div>
                  {!chatReady && body.trim().length > 0 ? (
                    <div className="label-small" style={{ color: 'var(--error)', marginBottom: 6 }}>
                      {chatConnecting
                        ? 'Wait until chat connects…'
                        : 'Tap Retry above to reconnect'}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={onSend}
                    disabled={!canSendMessage}
                    style={{
                      borderRadius: 10,
                      padding: '11px 0',
                      width: '100%',
                      marginTop: 8,
                      background: canSendMessage
                        ? 'var(--primary)'
                        : 'var(--surface-container-high)',
                      color: canSendMessage ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                      fontWeight: 600,
                      fontSize: 14,
                      opacity: canSendMessage ? 1 : 0.65,
                    }}
                  >
                    {posting
                      ? 'Sending…'
                      : chatConnecting
                        ? 'Connecting…'
                        : isOrganizer
                          ? 'Send message'
                          : 'Send'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
