import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatConfig } from '@shared/api/chatConfig';
import { StorageService } from '@shared/storage/storageService';
import { Logger } from '@shared/utils/logger';
import { ActivityChatMessage, chatMessageDeleteFromJson, chatMessageFromJson } from '../types';

type Kind = 'event' | 'club';

export type ChatConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

type Options = {
  kind: Kind;
  resourceId: number;
  enabled: boolean;
  threadUserId?: number | null;
  scope?: 'support' | 'group';
  onMessage: (message: ActivityChatMessage) => void;
  onMessageDeleted?: (payload: { messageId: number; inReplyToMessageId: number | null }) => void;
  onSocketError?: (message: string) => void;
};

type SendArgs = {
  role: 'USER' | 'ORGANIZER';
  body: string;
  inReplyToMessageId?: number | null;
  threadUserId?: number | null;
};

type AckResult = { ok?: boolean; error?: string; messageId?: number; threadUserId?: number | null };

type SendResult = { messageId: number | null };

const SEND_ACK_TIMEOUT_MS = 25_000;

export const useActivityChatSocket = ({
  kind,
  resourceId,
  enabled,
  threadUserId = null,
  scope = 'support',
  onMessage,
  onMessageDeleted,
  onSocketError,
}: Options) => {
  const socketRef = useRef<Socket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onMessageDeletedRef = useRef(onMessageDeleted);
  onMessageDeletedRef.current = onMessageDeleted;
  const onSocketErrorRef = useRef(onSocketError);
  onSocketErrorRef.current = onSocketError;

  const [connectionStatus, setConnectionStatus] = useState<ChatConnectionStatus>('idle');
  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setConnectionStatus('idle');
      return undefined;
    }

    const token = StorageService.getUserToken();
    if (!token) {
      setConnectionStatus('error');
      onSocketErrorRef.current?.('Sign in to use live chat.');
      return undefined;
    }

    setConnectionStatus('connecting');

    const socket = io(ChatConfig.baseUrl, {
      auth: { token },
      transports: ['websocket'],
      path: '/socket.io',
    });
    socketRef.current = socket;

    const joinRoom = () => {
      socket.emit(
        'chat_join',
        { kind, resourceId, threadUserId, scope },
        (res: AckResult) => {
        if (res?.ok) {
          setConnectionStatus('connected');
          return;
        }
        setConnectionStatus('error');
        onSocketErrorRef.current?.(res?.error ?? 'Could not join chat room');
        },
      );
    };

    const handleIncoming = (payload: unknown) => {
      try {
        onMessageRef.current(chatMessageFromJson(payload));
      } catch (e) {
        Logger.error('Invalid chat:message payload', e);
      }
    };

    const handleDeleted = (payload: unknown) => {
      try {
        const parsed = chatMessageDeleteFromJson(payload);
        onMessageDeletedRef.current?.({
          messageId: parsed.messageId,
          inReplyToMessageId: parsed.inReplyToMessageId,
        });
      } catch (e) {
        Logger.error('Invalid chat:message_deleted payload', e);
      }
    };

    socket.on('connect', joinRoom);
    socket.on('chat:message', handleIncoming);
    socket.on('chat:message_deleted', handleDeleted);
    socket.on('disconnect', () => {
      if (enabled) setConnectionStatus('connecting');
    });
    socket.on('connect_error', () => {
      setConnectionStatus('error');
      onSocketErrorRef.current?.('Live chat connection failed. Check that chat-service is running.');
    });

    return () => {
      socket.emit('chat_leave', { kind, resourceId });
      socket.off('connect', joinRoom);
      socket.off('chat:message', handleIncoming);
      socket.off('chat:message_deleted', handleDeleted);
      socket.disconnect();
      socketRef.current = null;
      setConnectionStatus('idle');
    };
  }, [enabled, kind, resourceId, threadUserId, scope, reconnectKey]);

  const retryConnection = useCallback(() => {
    setReconnectKey((k) => k + 1);
  }, []);

  const sendMessage = useCallback(
    (args: SendArgs): Promise<SendResult> =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          reject(new Error('Chat is not connected. Wait a moment or tap Retry.'));
          return;
        }
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(
            new Error(
              'Send timed out. If the message appeared in chat, you can ignore this. Otherwise tap Retry.',
            ),
          );
        }, SEND_ACK_TIMEOUT_MS);

        socket.emit(
          'chat_send',
          {
            kind,
            resourceId,
            role: args.role,
            body: args.body,
            inReplyToMessageId: args.inReplyToMessageId ?? null,
            threadUserId: args.threadUserId ?? null,
          },
          (res: AckResult) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (res?.ok) {
              resolve({ messageId: res.messageId ?? null });
              return;
            }
            reject(new Error(res?.error ?? 'Could not send message'));
          },
        );
      }),
    [kind, resourceId],
  );

  const approveAutoReply = useCallback(
    (messageId: number): Promise<void> =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          reject(new Error('Chat is not connected. Wait a moment or tap Retry.'));
          return;
        }
        socket.emit(
          'chat_approve',
          { kind, resourceId, messageId },
          (res: AckResult) => {
            if (res?.ok) {
              resolve();
              return;
            }
            reject(new Error(res?.error ?? 'Could not approve auto-reply'));
          },
        );
      }),
    [kind, resourceId],
  );

  const rejectAutoReply = useCallback(
    (messageId: number): Promise<{ inReplyToMessageId: number | null }> =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          reject(new Error('Chat is not connected. Wait a moment or tap Retry.'));
          return;
        }
        socket.emit(
          'chat_reject',
          { kind, resourceId, messageId },
          (res: AckResult & { inReplyToMessageId?: number | null }) => {
            if (res?.ok) {
              resolve({
                inReplyToMessageId:
                  res.inReplyToMessageId != null ? Number(res.inReplyToMessageId) : null,
              });
              return;
            }
            reject(new Error(res?.error ?? 'Could not reject auto-reply'));
          },
        );
      }),
    [kind, resourceId],
  );

  return { sendMessage, approveAutoReply, rejectAutoReply, connectionStatus, retryConnection };
};
