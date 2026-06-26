import React, { useCallback, useEffect, useRef, useState } from 'react';
import { extractErrorMessage } from '@shared/api/errors';
import { Icon } from '@shared/components/Icon';
import { Spinner } from '@shared/components/Spinner';
import { ChatApi } from '../api/chatApi';
import { useActivityChatSocket } from '../hooks/useActivityChatSocket';
import { ActivityChatMessage } from '../types';

type Props = {
  clubId: number;
  currentUserId?: number;
  canView: boolean;
  pendingHint?: string | null;
};

const fmtTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const senderLabel = (m: ActivityChatMessage, currentUserId?: number) => {
  if (m.senderIsOrganizer && m.senderUserId !== currentUserId) return 'Organizer';
  if (m.senderUserId === currentUserId) return m.senderIsOrganizer ? 'You (organizer)' : 'You';
  const email = m.senderEmail ?? '';
  if (email.includes('@')) return email.split('@')[0];
  return `Member #${m.senderUserId}`;
};

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

export const GroupChatSection: React.FC<Props> = ({
  clubId,
  currentUserId,
  canView,
  pendingHint = null,
}) => {
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityChatMessage[]>([]);
  const [body, setBody] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollChatToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = chatScrollRef.current;
      if (el != null) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const appendMessage = useCallback(
    (message: ActivityChatMessage) => {
      if (message.threadUserId != null) return;
      setItems((prev) => mergeMessages(prev, [message]));
      scrollChatToEnd();
    },
    [scrollChatToEnd],
  );

  const liveEnabled = canView && currentUserId != null;
  const { sendMessage, connectionStatus, retryConnection } = useActivityChatSocket({
    kind: 'club',
    resourceId: clubId,
    enabled: liveEnabled,
    threadUserId: null,
    scope: 'group',
    onMessage: appendMessage,
    onSocketError: setHint,
  });

  const load = useCallback(async () => {
    if (!canView) {
      setItems([]);
      setHint(pendingHint ?? 'Join this group and get approved to open group chat.');
      return;
    }
    setLoading(true);
    setHint(null);
    try {
      const list = await ChatApi.listClubGroupMessages(clubId);
      setItems(list);
      scrollChatToEnd();
    } catch (e: unknown) {
      setHint(extractErrorMessage(e) || 'Could not load group chat.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [canView, clubId, pendingHint, scrollChatToEnd]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const onSend = async () => {
    const text = body.trim();
    if (!text || posting || !canView) return;
    setPosting(true);
    setHint(null);
    try {
      await sendMessage({ role: 'USER', body: text, threadUserId: null });
      setBody('');
    } catch (e: unknown) {
      setHint(extractErrorMessage(e) || 'Could not send message.');
    } finally {
      setPosting(false);
    }
  };

  if (!canView) {
    return (
      <div
        className="body-medium"
        style={{ color: 'var(--on-surface-variant)', padding: '16px 0', lineHeight: '22px' }}
      >
        {pendingHint ?? 'Join this group and get approved to open group chat.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {connectionStatus === 'error' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '8px 12px',
            marginBottom: 8,
            borderRadius: 10,
            background: 'color-mix(in srgb, var(--error-container) 45%, transparent)',
            color: 'var(--on-error-container, var(--error))',
            fontSize: 13,
          }}
        >
          <span>Live chat disconnected</span>
          <button type="button" onClick={retryConnection} style={{ fontWeight: 600 }}>
            Retry
          </button>
        </div>
      ) : null}

      <div
        ref={chatScrollRef}
        style={{
          flex: 1,
          minHeight: 200,
          maxHeight: 'min(52vh, 480px)',
          overflowY: 'auto',
          padding: '8px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="body-medium" style={{ color: 'var(--on-surface-variant)', textAlign: 'center', padding: 24 }}>
            No messages yet. Say hello to the group.
          </div>
        ) : (
          items.map((m) => {
            const outgoing = m.senderUserId === currentUserId;
            const isOrganizer = Boolean(m.senderIsOrganizer);
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: outgoing ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                    marginLeft: outgoing ? 0 : 4,
                    marginRight: outgoing ? 4 : 0,
                    justifyContent: outgoing ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span className="label-small" style={{ color: 'var(--on-surface-variant)' }}>
                    {senderLabel(m, currentUserId)}
                  </span>
                  {isOrganizer ? (
                    <span
                      className="label-small"
                      style={{
                        borderRadius: 999,
                        padding: '2px 8px',
                        background: 'color-mix(in srgb, var(--tertiary, var(--primary)) 22%, transparent)',
                        color: 'var(--tertiary, var(--primary))',
                        fontWeight: 600,
                      }}
                    >
                      Organizer
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: outgoing ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: outgoing
                      ? isOrganizer
                        ? 'color-mix(in srgb, var(--tertiary, var(--primary)) 88%, var(--primary))'
                        : 'var(--primary)'
                      : isOrganizer
                        ? 'color-mix(in srgb, var(--tertiary-container, var(--primary-container)) 75%, transparent)'
                        : 'var(--surface-container-high)',
                    color: outgoing ? 'var(--on-primary)' : 'var(--on-surface)',
                    border: isOrganizer
                      ? '1px solid color-mix(in srgb, var(--tertiary, var(--primary)) 45%, transparent)'
                      : undefined,
                    fontSize: 14,
                    lineHeight: '20px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.body}
                </div>
                <div
                  className="label-small"
                  style={{
                    color: 'var(--on-surface-variant)',
                    marginTop: 4,
                    textAlign: outgoing ? 'right' : 'left',
                    marginRight: outgoing ? 4 : 0,
                    marginLeft: outgoing ? 0 : 4,
                  }}
                >
                  {fmtTime(m.createdAt)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {hint ? (
        <div className="body-small" style={{ color: 'var(--error)', marginBottom: 8 }}>
          {hint}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend().catch(() => {});
            }
          }}
          placeholder="Message the group…"
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            borderRadius: 12,
            padding: '10px 12px',
            background: 'var(--surface-container-high)',
            color: 'var(--on-surface)',
            fontSize: 14,
            border: '1px solid color-mix(in srgb, var(--outline-variant) 40%, transparent)',
          }}
        />
        <button
          type="button"
          onClick={() => onSend().catch(() => {})}
          disabled={posting || !body.trim() || connectionStatus === 'connecting'}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--primary)',
            color: 'var(--on-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: posting || !body.trim() ? 0.5 : 1,
          }}
          aria-label="Send message"
        >
          <Icon name="send" size={20} color="var(--on-primary)" />
        </button>
      </div>
    </div>
  );
};
