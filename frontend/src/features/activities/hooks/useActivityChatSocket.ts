import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatConfig } from '@shared/api/chatConfig';
import { StorageService } from '@shared/storage/storageService';
import { Logger } from '@shared/utils/logger';
import { ActivityChatMessage, chatMessageFromJson } from '../types';

type Kind = 'event' | 'club';

type Options = {
  kind: Kind;
  resourceId: number;
  enabled: boolean;
  onMessage: (message: ActivityChatMessage) => void;
  onSocketError?: (message: string) => void;
};

type SendArgs = {
  role: 'USER' | 'ORGANIZER';
  body: string;
};

type AckResult = { ok?: boolean; error?: string; messageId?: number };

export const useActivityChatSocket = ({
  kind,
  resourceId,
  enabled,
  onMessage,
  onSocketError,
}: Options) => {
  const socketRef = useRef<Socket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return undefined;

    const token = StorageService.getUserToken();
    if (!token) {
      onSocketError?.('Sign in to use live chat.');
      return undefined;
    }

    const socket = io(ChatConfig.baseUrl, {
      auth: { token },
      transports: ['websocket'],
      path: '/socket.io',
    });
    socketRef.current = socket;

    const handleIncoming = (payload: unknown) => {
      try {
        onMessageRef.current(chatMessageFromJson(payload));
      } catch (e) {
        Logger.error('Invalid chat:message payload', e);
      }
    };

    socket.on('connect', () => {
      socket.emit('chat_join', { kind, resourceId }, (res: AckResult) => {
        if (!res?.ok) {
          onSocketError?.(res?.error ?? 'Could not join chat room');
        }
      });
    });

    socket.on('chat:message', handleIncoming);
    socket.on('connect_error', () => {
      onSocketError?.('Live chat connection failed. Check chat-service on port 8002.');
    });

    return () => {
      socket.emit('chat_leave', { kind, resourceId });
      socket.off('chat:message', handleIncoming);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, kind, resourceId, onSocketError]);

  const sendMessage = useCallback(
    (args: SendArgs): Promise<void> =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          reject(new Error('Chat is not connected'));
          return;
        }
        socket.emit(
          'chat_send',
          {
            kind,
            resourceId,
            role: args.role,
            body: args.body,
          },
          (res: AckResult) => {
            if (res?.ok) {
              resolve();
              return;
            }
            reject(new Error(res?.error ?? 'Could not send message'));
          },
        );
      }),
    [kind, resourceId],
  );

  return { sendMessage, isConnected: () => Boolean(socketRef.current?.connected) };
};
