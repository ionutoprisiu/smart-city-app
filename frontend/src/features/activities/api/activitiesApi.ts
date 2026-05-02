import { ApiClient } from '../../../shared/api/client';
import { Logger } from '../../../shared/utils/logger';
import { authResponseFromJson, AuthResponse } from '../../auth/types';
import { ACTIVITIES_CITY } from '../constants';
import {
  ActivityAnnouncement,
  ActivityEvent,
  announcementFromJson,
  Club,
  clubFromJson,
  eventFromJson,
} from '../types';

export const ActivitiesApi = {
  async becomeOrganizer(userId: number): Promise<AuthResponse> {
    try {
      const data = await ApiClient.post('/activities/become-organizer', { userId });
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

  async listMyEvents(userId: number): Promise<ActivityEvent[]> {
    try {
      const data = await ApiClient.getList(`/activities/events/mine?userId=${encodeURIComponent(String(userId))}`);
      return data.map((x) => eventFromJson(x));
    } catch (e) {
      Logger.error('Failed to list my events', e);
      throw e;
    }
  },

  async createEvent(args: {
    creatorUserId: number;
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
      creatorUserId: args.creatorUserId,
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

  async listClubs(userId?: number): Promise<Club[]> {
    const suffix = userId != null ? `?userId=${encodeURIComponent(String(userId))}` : '';
    try {
      const data = await ApiClient.getList(`/activities/clubs${suffix}`);
      return data.map((x) => clubFromJson(x));
    } catch (e) {
      Logger.error('Failed to list clubs', e);
      throw e;
    }
  },

  async listMyClubs(userId: number): Promise<Club[]> {
    try {
      const data = await ApiClient.getList(`/activities/clubs/mine?userId=${encodeURIComponent(String(userId))}`);
      return data.map((x) => clubFromJson(x));
    } catch (e) {
      Logger.error('Failed to list my clubs', e);
      throw e;
    }
  },

  async createClub(args: {
    creatorUserId: number;
    name: string;
    description?: string;
    category?: string;
    visibility?: string;
  }): Promise<Club> {
    const data = await ApiClient.post('/activities/clubs', {
      creatorUserId: args.creatorUserId,
      name: args.name,
      description: args.description ?? null,
      category: args.category ?? 'OTHER',
      city: ACTIVITIES_CITY,
      visibility: args.visibility ?? 'PUBLIC',
    });
    return clubFromJson(data);
  },

  async joinClub(clubId: number, userId: number): Promise<Club> {
    const data = await ApiClient.post(`/activities/clubs/${clubId}/join`, { userId });
    return clubFromJson(data);
  },

  async leaveClub(clubId: number, userId: number): Promise<Club> {
    const data = await ApiClient.post(`/activities/clubs/${clubId}/leave`, { userId });
    return clubFromJson(data);
  },

  async cancelEvent(eventId: number, userId: number): Promise<ActivityEvent> {
    const data = await ApiClient.post(`/activities/events/${eventId}/cancel`, { userId });
    return eventFromJson(data);
  },

  async listEventAnnouncements(eventId: number): Promise<ActivityAnnouncement[]> {
    const data = await ApiClient.getList(`/activities/events/${eventId}/announcements`);
    return data.map((x) => announcementFromJson(x));
  },

  async createEventAnnouncement(
    eventId: number,
    args: { userId: number; title: string; body: string },
  ): Promise<ActivityAnnouncement> {
    const data = await ApiClient.post(`/activities/events/${eventId}/announcements`, args);
    return announcementFromJson(data);
  },

  async listClubAnnouncements(clubId: number, userId: number): Promise<ActivityAnnouncement[]> {
    const data = await ApiClient.getList(
      `/activities/clubs/${clubId}/announcements?userId=${encodeURIComponent(String(userId))}`,
    );
    return data.map((x) => announcementFromJson(x));
  },

  async createClubAnnouncement(
    clubId: number,
    args: { userId: number; title: string; body: string },
  ): Promise<ActivityAnnouncement> {
    const data = await ApiClient.post(`/activities/clubs/${clubId}/announcements`, args);
    return announcementFromJson(data);
  },
};
