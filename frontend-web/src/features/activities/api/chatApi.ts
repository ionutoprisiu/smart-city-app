import { ApiError, messageFromResponseBody } from '@shared/api/errors';
import { ChatConfig } from '@shared/api/chatConfig';
import { Logger } from '@shared/utils/logger';
import {
  ActivityChatMessage,
  ActivityChatMessageDeleteResult,
  ActivityChatThread,
  chatMessageDeleteFromJson,
  chatMessageFromJson,
  chatThreadFromJson,
} from '../types';

const TIMEOUT_MS = 30_000;

const extractMessage = (body: string): string => messageFromResponseBody(body);

const getJson = async (url: string): Promise<unknown> => {
  Logger.debug(`Chat GET: ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: ChatConfig.getHeaders(),
      signal: controller.signal,
    });
    const body = await response.text();
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError(extractMessage(body), response.status);
    }
    return body ? JSON.parse(body) : [];
  } finally {
    clearTimeout(timer);
  }
};

const postJson = async (url: string): Promise<unknown> => {
  Logger.debug(`Chat POST: ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: ChatConfig.getHeaders(),
      signal: controller.signal,
    });
    const body = await response.text();
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError(extractMessage(body), response.status);
    }
    return body ? JSON.parse(body) : null;
  } finally {
    clearTimeout(timer);
  }
};

const threadQuery = (threadUserId?: number | null): string =>
  threadUserId != null ? `?threadUserId=${threadUserId}` : '';

export const ChatApi = {
  async listEventMessages(eventId: number, threadUserId?: number | null): Promise<ActivityChatMessage[]> {
    try {
      const parsed = await getJson(ChatConfig.getUrl(`/events/${eventId}/messages${threadQuery(threadUserId)}`));
      const list = Array.isArray(parsed) ? parsed : [];
      return list.map((x) => chatMessageFromJson(x));
    } catch (e) {
      Logger.error('Chat list event messages failed', e);
      throw e;
    }
  },

  async listClubGroupMessages(clubId: number): Promise<ActivityChatMessage[]> {
    try {
      const parsed = await getJson(ChatConfig.getUrl(`/clubs/${clubId}/group-messages`));
      const list = Array.isArray(parsed) ? parsed : [];
      return list.map((x) => chatMessageFromJson(x));
    } catch (e) {
      Logger.error('Chat list club group messages failed', e);
      throw e;
    }
  },

  async listClubMessages(clubId: number, threadUserId?: number | null): Promise<ActivityChatMessage[]> {
    try {
      const parsed = await getJson(ChatConfig.getUrl(`/clubs/${clubId}/messages${threadQuery(threadUserId)}`));
      const list = Array.isArray(parsed) ? parsed : [];
      return list.map((x) => chatMessageFromJson(x));
    } catch (e) {
      Logger.error('Chat list club messages failed', e);
      throw e;
    }
  },

  async listEventThreads(eventId: number): Promise<ActivityChatThread[]> {
    try {
      const parsed = await getJson(ChatConfig.getUrl(`/events/${eventId}/threads`));
      const list = Array.isArray(parsed) ? parsed : [];
      return list.map((x) => chatThreadFromJson(x));
    } catch (e) {
      Logger.error('Chat list event threads failed', e);
      throw e;
    }
  },

  async listClubThreads(clubId: number): Promise<ActivityChatThread[]> {
    try {
      const parsed = await getJson(ChatConfig.getUrl(`/clubs/${clubId}/threads`));
      const list = Array.isArray(parsed) ? parsed : [];
      return list.map((x) => chatThreadFromJson(x));
    } catch (e) {
      Logger.error('Chat list club threads failed', e);
      throw e;
    }
  },

  async approveEventAutoReply(eventId: number, messageId: number): Promise<ActivityChatMessage> {
    const parsed = await postJson(
      ChatConfig.getUrl(`/events/${eventId}/messages/${messageId}/approve`),
    );
    return chatMessageFromJson(parsed);
  },

  async approveClubAutoReply(clubId: number, messageId: number): Promise<ActivityChatMessage> {
    const parsed = await postJson(
      ChatConfig.getUrl(`/clubs/${clubId}/messages/${messageId}/approve`),
    );
    return chatMessageFromJson(parsed);
  },

  async rejectEventAutoReply(
    eventId: number,
    messageId: number,
  ): Promise<ActivityChatMessageDeleteResult> {
    const parsed = await postJson(
      ChatConfig.getUrl(`/events/${eventId}/messages/${messageId}/reject`),
    );
    return chatMessageDeleteFromJson(parsed);
  },

  async rejectClubAutoReply(
    clubId: number,
    messageId: number,
  ): Promise<ActivityChatMessageDeleteResult> {
    const parsed = await postJson(
      ChatConfig.getUrl(`/clubs/${clubId}/messages/${messageId}/reject`),
    );
    return chatMessageDeleteFromJson(parsed);
  },
};
