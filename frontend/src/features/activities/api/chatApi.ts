import { ApiError } from '@shared/api/errors';
import { ChatConfig } from '@shared/api/chatConfig';
import { Logger } from '@shared/utils/logger';
import { ActivityChatMessage, chatMessageFromJson } from '../types';

const TIMEOUT_MS = 30_000;

const extractMessage = (body: string): string => {
  try {
    const json = JSON.parse(body);
    if (json && typeof json === 'object') {
      if (typeof (json as { detail?: string }).detail === 'string') return (json as { detail: string }).detail;
    }
  } catch {
    // fall through
  }
  return body || 'Request failed';
};

export const ChatApi = {
  async listEventMessages(eventId: number): Promise<ActivityChatMessage[]> {
    const url = ChatConfig.getUrl(`/events/${eventId}/messages`);
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
      const parsed = body ? JSON.parse(body) : [];
      const list = Array.isArray(parsed) ? parsed : [];
      return list.map((x) => chatMessageFromJson(x));
    } catch (e) {
      Logger.error('Chat list event messages failed', e);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  },

  async listClubMessages(clubId: number): Promise<ActivityChatMessage[]> {
    const url = ChatConfig.getUrl(`/clubs/${clubId}/messages`);
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
      const parsed = body ? JSON.parse(body) : [];
      const list = Array.isArray(parsed) ? parsed : [];
      return list.map((x) => chatMessageFromJson(x));
    } catch (e) {
      Logger.error('Chat list club messages failed', e);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  },
};
