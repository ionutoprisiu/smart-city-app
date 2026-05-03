import { ApiClient } from '@shared/api/client';
import { Logger } from '@shared/utils/logger';
import { authResponseFromJson, AuthResponse } from '@features/auth/types';
import { ACTIVITIES_CITY } from '../constants';
import {
  ActivityAnnouncement,
  ActivityChatMessage,
  ActivityChatPostResult,
  ActivityEvent,
  announcementFromJson,
  chatMessageFromJson,
  chatPostResultFromJson,
  Club,
  clubFromJson,
  eventFromJson,
} from '../types';

export const ActivitiesApi = {
  async becomeOrganizer(): Promise<AuthResponse> {
    try {
      const data = await ApiClient.post('/activities/become-organizer', {});
      return authResponseFromJson(data);
    } catch (e) {
      Logger.error('Failed to become organizer', e);
      throw e;
    }
  },

  async listEvents(): Promise<ActivityEvent[]> {
    try {
      const data = await ApiClient.getList('/activities/events');
      return data.map((x) => eventFromJson(x));
    } catch (e) {
      Logger.error('Failed to list events', e);
      throw e;
    }
  },

  async listMyEvents(): Promise<ActivityEvent[]> {
    try {
      const data = await ApiClient.getList('/activities/events/mine');
      return data.map((x) => eventFromJson(x));
    } catch (e) {
      Logger.error('Failed to list my events', e);
      throw e;
    }
  },

  async createEvent(args: {
    title: string;
    description?: string;
    category?: string;
    locationName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    startsAt: string;
    endsAt: string;
  }): Promise<ActivityEvent> {
    const data = await ApiClient.post('/activities/events', {
      title: args.title,
      description: args.description ?? null,
      category: args.category ?? 'GENERAL',
      city: ACTIVITIES_CITY,
      locationName: args.locationName ?? null,
      latitude: args.latitude ?? null,
      longitude: args.longitude ?? null,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
    });
    return eventFromJson(data);
  },

  async listClubs(): Promise<Club[]> {
    try {
      const data = await ApiClient.getList('/activities/clubs');
      return data.map((x) => clubFromJson(x));
    } catch (e) {
      Logger.error('Failed to list clubs', e);
      throw e;
    }
  },

  async listMyClubs(): Promise<Club[]> {
    try {
      const data = await ApiClient.getList('/activities/clubs/mine');
      return data.map((x) => clubFromJson(x));
    } catch (e) {
      Logger.error('Failed to list my clubs', e);
      throw e;
    }
  },

  async createClub(args: {
    name: string;
    description?: string;
    category?: string;
    visibility?: string;
  }): Promise<Club> {
    const data = await ApiClient.post('/activities/clubs', {
      name: args.name,
      description: args.description ?? null,
      category: args.category ?? 'OTHER',
      city: ACTIVITIES_CITY,
      visibility: args.visibility ?? 'PUBLIC',
    });
    return clubFromJson(data);
  },

  async joinClub(clubId: number): Promise<Club> {
    const data = await ApiClient.post(`/activities/clubs/${clubId}/join`, {});
    return clubFromJson(data);
  },

  async leaveClub(clubId: number): Promise<Club> {
    const data = await ApiClient.post(`/activities/clubs/${clubId}/leave`, {});
    return clubFromJson(data);
  },

  async cancelEvent(eventId: number): Promise<ActivityEvent> {
    const data = await ApiClient.post(`/activities/events/${eventId}/cancel`, {});
    return eventFromJson(data);
  },

  async listEventAnnouncements(eventId: number): Promise<ActivityAnnouncement[]> {
    const data = await ApiClient.getList(`/activities/events/${eventId}/announcements`);
    return data.map((x) => announcementFromJson(x));
  },

  async createEventAnnouncement(
    eventId: number,
    args: { title: string; body: string },
  ): Promise<ActivityAnnouncement> {
    const data = await ApiClient.post(`/activities/events/${eventId}/announcements`, args);
    return announcementFromJson(data);
  },

  async listClubAnnouncements(clubId: number): Promise<ActivityAnnouncement[]> {
    const data = await ApiClient.getList(`/activities/clubs/${clubId}/announcements`);
    return data.map((x) => announcementFromJson(x));
  },

  async createClubAnnouncement(
    clubId: number,
    args: { title: string; body: string },
  ): Promise<ActivityAnnouncement> {
    const data = await ApiClient.post(`/activities/clubs/${clubId}/announcements`, args);
    return announcementFromJson(data);
  },

  async listEventChat(eventId: number): Promise<ActivityChatMessage[]> {
    const data = await ApiClient.getList(`/activities/events/${eventId}/chat`);
    return data.map((x) => chatMessageFromJson(x));
  },

  async postEventChat(
    eventId: number,
    args: { role: 'USER' | 'ORGANIZER'; body: string; inReplyToMessageId?: number | null },
  ): Promise<ActivityChatPostResult> {
    const data = await ApiClient.post(`/activities/events/${eventId}/chat`, {
      role: args.role,
      body: args.body,
      inReplyToMessageId: args.inReplyToMessageId ?? null,
    });
    return chatPostResultFromJson(data);
  },

  async listClubChat(clubId: number): Promise<ActivityChatMessage[]> {
    const data = await ApiClient.getList(`/activities/clubs/${clubId}/chat`);
    return data.map((x) => chatMessageFromJson(x));
  },

  async postClubChat(
    clubId: number,
    args: { role: 'USER' | 'ORGANIZER'; body: string; inReplyToMessageId?: number | null },
  ): Promise<ActivityChatPostResult> {
    const data = await ApiClient.post(`/activities/clubs/${clubId}/chat`, {
      role: args.role,
      body: args.body,
      inReplyToMessageId: args.inReplyToMessageId ?? null,
    });
    return chatPostResultFromJson(data);
  },
};
